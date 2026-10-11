import AsyncStorage from '@react-native-async-storage/async-storage';
import { transact, type Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Connection, PublicKey, Transaction, type TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { APP_IDENTITY, CHAIN, RPC_ENDPOINT } from '../lib/config';

const STORAGE_KEY = 'bsafe-wallet';

interface StoredAuth {
  authToken: string;
  address: string; // base58
}

interface WalletValue {
  connection: Connection;
  publicKey: PublicKey | null;
  /** Restoring a saved session on app start */
  restoring: boolean;
  connect: () => Promise<PublicKey>;
  disconnect: () => Promise<void>;
  /** Signs the instructions in the wallet, sends them through our RPC and waits for confirmation. */
  send: (instructions: TransactionInstruction[]) => Promise<string>;
}

const WalletContext = createContext<WalletValue | null>(null);

const toPublicKey = (base64Address: string) => new PublicKey(Buffer.from(base64Address, 'base64'));

/** fetch that retries network-level failures (flaky mobile data, DNS hiccups) before giving up. */
const retryingFetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const connection = useMemo(() => new Connection(RPC_ENDPOINT, { commitment: 'confirmed', fetch: retryingFetch as typeof fetch }), []);
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => raw && setAuth(JSON.parse(raw) as StoredAuth))
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  const saveAuth = useCallback(async (next: StoredAuth | null) => {
    setAuth(next);
    if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  /** Authorizes inside an open MWA session, reusing the saved token when the wallet still accepts it. */
  const authorize = useCallback(async (wallet: Web3MobileWallet, token?: string) => {
    let result;
    try {
      result = await wallet.authorize({ identity: APP_IDENTITY, chain: CHAIN, auth_token: token });
    } catch (err) {
      if (!token) throw err;
      // Expired or revoked token: ask the user to approve again
      result = await wallet.authorize({ identity: APP_IDENTITY, chain: CHAIN });
    }
    const next: StoredAuth = { authToken: result.auth_token, address: toPublicKey(result.accounts[0].address).toBase58() };
    await saveAuth(next);
    return next;
  }, [saveAuth]);

  const connect = useCallback(async () => {
    const next = await transact(wallet => authorize(wallet));
    return new PublicKey(next.address);
  }, [authorize]);

  const disconnect = useCallback(async () => {
    const token = auth?.authToken;
    await saveAuth(null);
    if (token) {
      // Best effort: the wallet may already have dropped the session
      await transact(wallet => wallet.deauthorize({ auth_token: token })).catch(() => {});
    }
  }, [auth, saveAuth]);

  const send = useCallback(async (instructions: TransactionInstruction[]) => {
    // Fetch the blockhash while BSafe is still in the foreground; once the wallet opens, Android may throttle our network
    const latest = await connection.getLatestBlockhash();
    const signed = await transact(async wallet => {
      const current = await authorize(wallet, auth?.authToken);
      const tx = new Transaction({ feePayer: new PublicKey(current.address), ...latest }).add(...instructions);
      const [result] = await wallet.signTransactions({ transactions: [tx] });
      return { result };
    });
    const raw = signed.result.serialize();
    const submit = () => connection.sendRawTransaction(raw, { preflightCommitment: 'confirmed', maxRetries: 5 });
    let signature: string;
    try {
      signature = await submit();
    } catch (err) {
      // Load-balanced RPCs can simulate on a node that hasn't seen our blockhash yet; it is still valid, so retry once
      if (!/Blockhash not found/i.test(String((err as Error)?.message ?? err))) throw err;
      await new Promise(resolve => setTimeout(resolve, 1500));
      signature = await submit();
    }
    const confirmation = await connection.confirmTransaction({ signature, ...latest }, 'confirmed');
    if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    return signature;
  }, [auth, authorize, connection]);

  const value = useMemo<WalletValue>(() => ({
    connection,
    publicKey: auth ? new PublicKey(auth.address) : null,
    restoring,
    connect,
    disconnect,
    send,
  }), [auth, connection, connect, disconnect, restoring, send]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
