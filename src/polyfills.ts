// Solana libraries and our PDA/instruction code use Node's Buffer. Browsers don't have it, and the
// dev server only works by accident (a dependency leaks it), so install it globally before anything else.
import { Buffer } from 'buffer';

if (!('Buffer' in globalThis)) {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
