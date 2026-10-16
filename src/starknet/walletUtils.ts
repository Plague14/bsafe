/** Injected wallet (Argent X / Ready, Braavos): the get-starknet v3 window object */
export interface InjectedWallet {
  id: string;
  name: string;
  icon: string | { light: string; dark: string };
  request: (call: { type: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb: (...args: unknown[]) => void) => void;
}

export function discoverWallets(): InjectedWallet[] {
  const seen = new Map<string, InjectedWallet>();
  const w = window as unknown as Record<string, unknown>;
  for (const key of Object.keys(w)) {
    if (!key.startsWith('starknet')) continue;
    const obj = w[key] as InjectedWallet | undefined;
    if (obj && typeof obj === 'object' && typeof obj.request === 'function' && obj.id && !seen.has(obj.id)) {
      seen.set(obj.id, obj);
    }
  }
  return [...seen.values()];
}

/** Turns wallet / revert errors into one readable line */
export function describeSnError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/reject|declin|cancel|abort/i.test(msg)) return 'cancelled';
  // Cairo panics arrive as hex-encoded short strings inside the revert trace
  const hexes = msg.match(/0x[0-9a-f]{10,62}/gi) ?? [];
  for (const h of hexes) {
    try {
      const text = new TextDecoder().decode(
        Uint8Array.from((h.slice(2).length % 2 ? '0' + h.slice(2) : h.slice(2)).match(/../g)!.map(b => parseInt(b, 16))),
      );
      if (/^[\x20-\x7e]{4,31}$/.test(text) && !/ENTRYPOINT|argent|Failure/.test(text)) return text;
    } catch {
      /* not text */
    }
  }
  const quoted = msg.match(/'([^']{4,31})'/);
  if (quoted) return quoted[1];
  return msg.length > 160 ? msg.slice(0, 160) + '…' : msg;
}
