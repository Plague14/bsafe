import 'react-native-get-random-values';
import { Buffer } from 'buffer';

if (!('Buffer' in globalThis)) {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
