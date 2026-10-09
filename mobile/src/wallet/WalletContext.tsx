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

export function WalletProvider({ children }: { children: ReactNode }) {
  const connection = useMemo(() => new Connection(RPC_ENDPOINT, 'confirmed'), []);
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
    const signed = await transact(async wallet => {
      const current = await authorize(wallet, auth?.authToken);
      const latest = await connection.getLatestBlockhash();
      const tx = new Transaction({ feePayer: new PublicKey(current.address), ...latest }).add(...instructions);
      const [result] = await wallet.signTransactions({ transactions: [tx] });
      return { result, latest };
    });
    const signature = await connection.sendRawTransaction(signed.result.serialize());
    const confirmation = await connection.confirmTransaction({ signature, ...signed.latest }, 'confirmed');
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
