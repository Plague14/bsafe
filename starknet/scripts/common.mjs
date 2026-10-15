import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { RpcProvider, ec, hash, CallData, encode } from 'starknet';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_FILE = path.join(ROOT, '.env');
dotenv.config({ path: ENV_FILE, quiet: true });

export const RPC_URL = process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.drpc.org';
// OpenZeppelin account (v0.8.1), declared on Sepolia and mainnet
export const OZ_ACCOUNT_CLASS_HASH =
  '0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f';
export const STRK_SEPOLIA =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

export const provider = new RpcProvider({ nodeUrl: RPC_URL });

/** Account key from .env, or a new one written there (the file is gitignored) */
export function loadOrCreateKey(envName = 'DEPLOYER_PRIVATE_KEY') {
  let privateKey = process.env[envName];
  if (!privateKey) {
    privateKey = '0x' + encode.buf2hex(ec.starkCurve.utils.randomPrivateKey());
    fs.appendFileSync(ENV_FILE, `${envName}=${privateKey}\n`);
    process.env[envName] = privateKey;
  }
  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  const constructorCalldata = CallData.compile({ publicKey });
  const address = hash.calculateContractAddressFromHash(
    publicKey,
    OZ_ACCOUNT_CLASS_HASH,
    constructorCalldata,
    0,
  );
  return { privateKey, publicKey, constructorCalldata, address };
}

export async function strkBalance(address) {
  const res = await provider.callContract({
    contractAddress: STRK_SEPOLIA,
    entrypoint: 'balance_of',
    calldata: [address],
  });
  return BigInt(res[0]) + (BigInt(res[1]) << 128n);
}

export async function isDeployed(address) {
  try {
    await provider.getClassHashAt(address);
    return true;
  } catch {
    return false;
  }
}

export const fmt = (wei) => (Number(wei) / 1e18).toFixed(4);
