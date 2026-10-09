// Little-endian integer helpers on DataView; the `buffer` polyfill's BigInt methods are unreliable on Hermes.
import { Buffer } from 'buffer';

const view = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength);

export const readU8 = (data: Uint8Array, offset: number) => data[offset];
export const readU16 = (data: Uint8Array, offset: number) => view(data).getUint16(offset, true);
export const readU64 = (data: Uint8Array, offset: number) => view(data).getBigUint64(offset, true);
export const readI64 = (data: Uint8Array, offset: number) => view(data).getBigInt64(offset, true);

export function u16(value: number): Buffer {
  const b = Buffer.alloc(2);
  view(b).setUint16(0, value, true);
  return b;
}

export function u64(value: bigint): Buffer {
  const b = Buffer.alloc(8);
  view(b).setBigUint64(0, value, true);
  return b;
}
