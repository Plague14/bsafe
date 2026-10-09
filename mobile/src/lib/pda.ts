import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { u64 } from './bytes';
import { PROGRAM_ID, SEEDS } from './config';

const find = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

/** Pad or truncate a vault name to exactly 32 bytes */
export function nameToBytes32(name: string): Uint8Array {
  const result = new Uint8Array(32);
  result.set(new TextEncoder().encode(name).slice(0, 32));
  return result;
}

export const vaultPda = (owner: PublicKey, name: Uint8Array) =>
  find([Buffer.from(SEEDS.VAULT), owner.toBuffer(), Buffer.from(name)]);
export const treasuryPda = (vault: PublicKey) => find([Buffer.from(SEEDS.VAULT_TREASURY), vault.toBuffer()]);
export const beneficiaryPda = (vault: PublicKey, wallet: PublicKey) =>
  find([Buffer.from(SEEDS.BENEFICIARY), vault.toBuffer(), wallet.toBuffer()]);
export const planPda = (vault: PublicKey) => find([Buffer.from(SEEDS.INHERITANCE), vault.toBuffer()]);
export const proofPda = (plan: PublicKey) => find([Buffer.from(SEEDS.PROOF), plan.toBuffer()]);
export const verifierPda = (plan: PublicKey, verifier: PublicKey) =>
  find([Buffer.from(SEEDS.VERIFIER), plan.toBuffer(), verifier.toBuffer()]);
export const signerPda = (vault: PublicKey, signer: PublicKey) =>
  find([Buffer.from(SEEDS.SIGNER), vault.toBuffer(), signer.toBuffer()]);
export const membershipPda = (owner: PublicKey) => find([Buffer.from(SEEDS.MEMBERSHIP), owner.toBuffer()]);
export const bsafeTreasuryPda = () => find([Buffer.from(SEEDS.BSAFE_TREASURY)]);

/** Multisig proposal PDA; the program uses `vault.balance + 1` (lamports) as the nonce. */
export function multisigTxPda(vault: PublicKey, nonce: bigint) {
  return find([Buffer.from(SEEDS.MULTISIG_TX), vault.toBuffer(), u64(nonce)]);
}
