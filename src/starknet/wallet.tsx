import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { WalletAccount, type Call } from 'starknet';
import { SN_CHAIN_ID } from './config';
import { snProvider } from './client';
import { discoverWallets, type InjectedWallet } from './walletUtils';

interface SnWalletValue {
  wallets: InjectedWallet[];
  address: string | null;
  walletName: string | null;
  connecting: boolean;
  wrongNetwork: boolean;
  connect: (wallet: InjectedWallet) => Promise<void>;
  disconnect: () => void;
  refreshWallets: () => void;
  /** Sends a multicall and waits for it; returns the tx hash */
  execute: (calls: Call | Call[]) => Promise<string>;
}

const Ctx = createContext<SnWalletValue | null>(null);
const LAST_WALLET = 'bsafe-sn-wallet';

export function SnWalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<InjectedWallet[]>([]);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const refreshWallets = useCallback(() => setWallets(discoverWallets()), []);

  const connect = useCallback(async (wallet: InjectedWallet) => {
    setConnecting(true);
    try {
      const acc = await WalletAccount.connect(snProvider, wallet as never);
      let chainId = (await wallet.request({ type: 'wallet_requestChainId' })) as string;
      if (BigInt(chainId) !== BigInt(SN_CHAIN_ID)) {
        try {
          await wallet.request({ type: 'wallet_switchStarknetChain', params: { chainId: SN_CHAIN_ID } });
          chainId = (await wallet.request({ type: 'wallet_requestChainId' })) as string;
        } catch {
          /* user declined; flagged below */
        }
      }
      setWrongNetwork(BigInt(chainId) !== BigInt(SN_CHAIN_ID));
      setAccount(acc);
      setWalletName(wallet.name);
      try {
        localStorage.setItem(LAST_WALLET, wallet.id);
      } catch {
        /* storage unavailable */
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setWalletName(null);
    try {
      localStorage.removeItem(LAST_WALLET);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Extensions inject late; look again after load, and reconnect silently to the last wallet
  useEffect(() => {
    refreshWallets();
    const timer = setTimeout(async () => {
      const found = discoverWallets();
      setWallets(found);
      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_WALLET);
      } catch {
        /* storage unavailable */
      }
      const wallet = found.find(w => w.id === last);
      if (wallet) {
        try {
          const acc = await WalletAccount.connectSilent(snProvider, wallet as never);
          if (acc.address && BigInt(acc.address) !== 0n) {
            const chainId = (await wallet.request({ type: 'wallet_requestChainId' })) as string;
            setWrongNetwork(BigInt(chainId) !== BigInt(SN_CHAIN_ID));
            setAccount(acc);
            setWalletName(wallet.name);
          }
        } catch {
          /* not authorized anymore */
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [refreshWallets]);

  // Follow account / network switches in the extension
  useEffect(() => {
    if (!account) return;
    const wallet = account.walletProvider as unknown as InjectedWallet;
    const onAccounts = (accounts?: unknown) => {
      const list = accounts as string[] | undefined;
      if (!list?.length) disconnect();
      else void connect(wallet);
    };
    const onNetwork = (chainId?: unknown) => {
      if (chainId) setWrongNetwork(BigInt(chainId as string) !== BigInt(SN_CHAIN_ID));
    };
    wallet.on?.('accountsChanged', onAccounts);
    wallet.on?.('networkChanged', onNetwork);
    return () => {
      wallet.off?.('accountsChanged', onAccounts);
      wallet.off?.('networkChanged', onNetwork);
    };
  }, [account, connect, disconnect]);

  const execute = useCallback(
    async (calls: Call | Call[]) => {
      if (!account) throw new Error('Wallet not connected');
      const { transaction_hash } = await account.execute(calls);
      const receipt = await snProvider.waitForTransaction(transaction_hash);
      if (!receipt.isSuccess()) {
        const reason = (receipt.value as { revert_reason?: string }).revert_reason;
        throw new Error(reason || 'Transaction reverted');
      }
      return transaction_hash;
    },
    [account],
  );

  const value = useMemo<SnWalletValue>(
    () => ({
      wallets,
      address: account?.address ? account.address : null,
      walletName,
      connecting,
      wrongNetwork,
      connect,
      disconnect,
      refreshWallets,
      execute,
    }),
    [wallets, account, walletName, connecting, wrongNetwork, connect, disconnect, refreshWallets, execute],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSnWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSnWallet outside SnWalletProvider');
  return v;
}
