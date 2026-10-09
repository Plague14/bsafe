import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getVaults, type Vault } from '../lib/program';
import { useWallet } from './WalletContext';

interface VaultsValue {
  vaults: Vault[];
  loading: boolean;
  selected: Vault | null;
  select: (address: string) => void;
  refresh: () => Promise<void>;
}

const VaultsContext = createContext<VaultsValue | null>(null);

/** The connected owner's vaults, plus which one the Heirs/Plan tabs are working on. */
export function VaultsProvider({ children }: { children: ReactNode }) {
  const { connection, publicKey } = useWallet();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setVaults([]);
      return;
    }
    setLoading(true);
    try {
      const list = (await getVaults(connection, publicKey)).sort((a, b) => a.createdAt - b.createdAt);
      setVaults(list);
    } catch (err) {
      console.warn('[bsafe] failed to load vaults', err);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    setSelectedKey(null);
    refresh();
  }, [refresh]);

  const selected = useMemo(
    () => vaults.find(v => v.address.toBase58() === selectedKey) ?? vaults[0] ?? null,
    [vaults, selectedKey],
  );

  const value = useMemo<VaultsValue>(
    () => ({ vaults, loading, selected, select: setSelectedKey, refresh }),
    [vaults, loading, selected, refresh],
  );
  return <VaultsContext.Provider value={value}>{children}</VaultsContext.Provider>;
}

export function useVaults(): VaultsValue {
  const ctx = useContext(VaultsContext);
  if (!ctx) throw new Error('useVaults must be used inside <VaultsProvider>');
  return ctx;
}
