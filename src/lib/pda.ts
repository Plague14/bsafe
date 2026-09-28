import { PublicKey } from '@solana/web3.js';
import { PROGRAM_ID, SEEDS } from './constants';

// Pad or truncate string to exactly 32 bytes
export function nameToBytes32(name: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(name);
  const result = new Uint8Array(32);
  result.set(bytes.slice(0, 32));
  return result;
}

export function findVaultPDA(owner: PublicKey, name: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VAULT), owner.toBuffer(), Buffer.from(name)],
    PROGRAM_ID
  );
}

export function findVaultTreasuryPDA(vault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VAULT_TREASURY), vault.toBuffer()],
    PROGRAM_ID
  );
}

export function findBeneficiaryPDA(vault: PublicKey, wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.BENEFICIARY), vault.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID
  );
}

export function findInheritancePlanPDA(vault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.INHERITANCE), vault.toBuffer()],
    PROGRAM_ID
  );
}

export function findProofPDA(inheritancePlan: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.PROOF), inheritancePlan.toBuffer()],
    PROGRAM_ID
  );
}

export function findVerifierPDA(inheritancePlan: PublicKey, verifier: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VERIFIER), inheritancePlan.toBuffer(), verifier.toBuffer()],
    PROGRAM_ID
  );
}

export function findSignerPDA(vault: PublicKey, signer: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.SIGNER), vault.toBuffer(), signer.toBuffer()],
    PROGRAM_ID
  );
}

export function findMultisigTxPDA(vault: PublicKey, nonce: number): [PublicKey, number] {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.MULTISIG_TX), vault.toBuffer(), nonceBuffer],
    PROGRAM_ID
  );
}

export function findMembershipPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.MEMBERSHIP), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function findBsafeTreasuryPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.BSAFE_TREASURY)],
    PROGRAM_ID
  );
}
