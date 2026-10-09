// BSafe program client: account parsers, readers and instruction builders.
// Mirrors src/hooks/useProgram.ts in the web app, without React or wallet state.
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { readI64, readU16, readU64, u16, u64 } from './bytes';
import { PROGRAM_ID, TIMER_UNIT_SECONDS } from './config';
import {
  beneficiaryPda, bsafeTreasuryPda, membershipPda, multisigTxPda, nameToBytes32, planPda, proofPda,
  signerPda, treasuryPda, vaultPda, verifierPda,
} from './pda';

// ==================== TYPES ====================

export interface Vault {
  address: PublicKey;
  treasury: PublicKey;
  owner: PublicKey;
  balance: number;
  /** Balance tracked in the vault account (lamports); used as the multisig proposal nonce */
  trackedBalanceLamports: bigint;
  name: string;
  status: 'active' | 'locked' | 'inheritance';
  signerCount: number;
  multisigEnabled: boolean;
  multisigThreshold: number;
  beneficiaryCount: number;
  lastActivity: number;
  createdAt: number;
}

export interface Beneficiary {
  address: PublicKey;
  vault: PublicKey;
  wallet: PublicKey;
  shareBps: number;
  sharePercent: number;
  status: 'active' | 'removed' | 'claimed';
  index: number;
  claimedAmount: number;
  addedAt: number;
}

export type TriggerType = 'deathCertificate' | 'deadmanSwitch' | 'both';
export type PlanStatus = 'configured' | 'proofSubmitted' | 'cooldownActive' | 'claimReady' | 'completed' | 'cancelled';

export interface InheritancePlan {
  address: PublicKey;
  vault: PublicKey;
  status: PlanStatus;
  triggerType: TriggerType;
  cooldownSeconds: number;
  deadmanSwitchSeconds: number;
  triggeredAt: number;
  cooldownEndsAt: number;
  distributionAmount: number;
  requiredVerifications: number;
  currentVerifications: number;
  createdAt: number;
}

export interface MultisigSigner {
  address: PublicKey;
  vault: PublicKey;
  signer: PublicKey;
  index: number;
  isActive: boolean;
  addedAt: number;
}

export type MultisigTxStatus = 'pending' | 'approved' | 'executed' | 'cancelled';

export interface MultisigTransaction {
  address: PublicKey;
  vault: PublicKey;
  txType: number;
  status: MultisigTxStatus;
  amount: number;
  destination: PublicKey;
  proposer: PublicKey;
  threshold: number;
  approvalCount: number;
  approvals: bigint;
  proposedAt: number;
  executedAt: number;
}

export interface Verifier {
  address: PublicKey;
  inheritancePlan: PublicKey;
  verifier: PublicKey;
  hasVerified: boolean;
  verifiedAt: number;
}

export interface DeathCertificateProof {
  address: PublicKey;
  inheritancePlan: PublicKey;
  documentHash: string; // hex
  submittedBy: PublicKey;
  submittedAt: number;
  verified: boolean;
  verificationCount: number;
}

/** A vault seen from a beneficiary's or verifier's perspective. */
export interface InheritanceView {
  vault: Vault;
  plan: InheritancePlan | null;
  proof: DeathCertificateProof | null;
  beneficiary: Beneficiary | null;
  verifier: Verifier | null;
}

// ==================== ENCODING ====================

const ixDiscriminator = (name: string) => Buffer.from(sha256(new TextEncoder().encode(`global:${name}`)).slice(0, 8));

/** Anchor account discriminator, base58-encoded for getProgramAccounts memcmp filters */
function accountFilter(accountName: string) {
  const disc = sha256(new TextEncoder().encode(`account:${accountName}`)).slice(0, 8);
  return { memcmp: { offset: 0, bytes: bs58.encode(disc) } };
}

const lamports = (sol: number) => BigInt(Math.floor(sol * LAMPORTS_PER_SOL));

type Meta = TransactionInstruction['keys'][number];
const w = (pubkey: PublicKey, isSigner = false): Meta => ({ pubkey, isSigner, isWritable: true });
const r = (pubkey: PublicKey, isSigner = false): Meta => ({ pubkey, isSigner, isWritable: false });
const SYSTEM = r(SystemProgram.programId);

const ix = (name: string, args: Buffer, keys: Meta[]) =>
  new TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.concat([ixDiscriminator(name), args]) });

// ==================== PARSERS ====================

function parseVault(pubkey: PublicKey, data: Buffer, treasuryLamports: number): Vault {
  const status = data[72];
  return {
    address: pubkey,
    treasury: treasuryPda(pubkey),
    owner: new PublicKey(data.subarray(8, 40)),
    balance: treasuryLamports / LAMPORTS_PER_SOL,
    trackedBalanceLamports: readU64(data, 73),
    name: new TextDecoder().decode(data.subarray(40, 72)).replace(/\0+$/, ''),
    status: status === 0 ? 'active' : status === 1 ? 'locked' : 'inheritance',
    signerCount: data[84],
    multisigEnabled: data[82] === 1,
    multisigThreshold: data[83],
    beneficiaryCount: data[81],
    lastActivity: Number(readI64(data, 85)) * 1000,
    createdAt: Number(readI64(data, 93)) * 1000,
  };
}

function parseBeneficiary(pubkey: PublicKey, data: Buffer): Beneficiary {
  const shareBps = readU16(data, 72);
  const status = data[74];
  return {
    address: pubkey,
    vault: new PublicKey(data.subarray(8, 40)),
    wallet: new PublicKey(data.subarray(40, 72)),
    shareBps,
    sharePercent: shareBps / 100,
    status: status === 0 ? 'active' : status === 1 ? 'removed' : 'claimed',
    index: data[75],
    claimedAmount: Number(readU64(data, 76)) / LAMPORTS_PER_SOL,
    addedAt: Number(readI64(data, 84)) * 1000,
  };
}

function parsePlan(address: PublicKey, data: Buffer): InheritancePlan {
  const statusMap: PlanStatus[] = ['configured', 'proofSubmitted', 'cooldownActive', 'claimReady', 'completed', 'cancelled'];
  const triggerMap: TriggerType[] = ['deathCertificate', 'deadmanSwitch', 'both'];
  return {
    address,
    vault: new PublicKey(data.subarray(8, 40)),
    status: statusMap[data[40]] ?? 'configured',
    triggerType: triggerMap[data[41]] ?? 'both',
    cooldownSeconds: Number(readU64(data, 42)),
    deadmanSwitchSeconds: Number(readU64(data, 50)),
    triggeredAt: Number(readI64(data, 58)) * 1000,
    cooldownEndsAt: Number(readI64(data, 66)) * 1000,
    distributionAmount: Number(readU64(data, 74)) / LAMPORTS_PER_SOL,
    requiredVerifications: data[82],
    currentVerifications: data[83],
    createdAt: Number(readI64(data, 84)) * 1000,
  };
}

function parseVerifier(pubkey: PublicKey, data: Buffer): Verifier {
  return {
    address: pubkey,
    inheritancePlan: new PublicKey(data.subarray(8, 40)),
    verifier: new PublicKey(data.subarray(40, 72)),
    hasVerified: data[72] === 1,
    verifiedAt: Number(readI64(data, 73)) * 1000,
  };
}

function parseProof(pubkey: PublicKey, data: Buffer): DeathCertificateProof {
  return {
    address: pubkey,
    inheritancePlan: new PublicKey(data.subarray(8, 40)),
    documentHash: Buffer.from(data.subarray(40, 72)).toString('hex'),
    submittedBy: new PublicKey(data.subarray(72, 104)),
    submittedAt: Number(readI64(data, 104)) * 1000,
    verified: data[112] === 1,
    verificationCount: data[113],
  };
}

function parseSigner(pubkey: PublicKey, data: Buffer): MultisigSigner {
  return {
    address: pubkey,
    vault: new PublicKey(data.subarray(8, 40)),
    signer: new PublicKey(data.subarray(40, 72)),
    index: data[72],
    isActive: data[73] === 1,
    addedAt: Number(readI64(data, 74)) * 1000,
  };
}

function parseMultisigTx(pubkey: PublicKey, data: Buffer): MultisigTransaction {
  const statusMap: MultisigTxStatus[] = ['pending', 'approved', 'executed', 'cancelled'];
  return {
    address: pubkey,
    vault: new PublicKey(data.subarray(8, 40)),
    txType: data[48],
    status: statusMap[data[49]] ?? 'pending',
    amount: Number(readU64(data, 50)) / LAMPORTS_PER_SOL,
    destination: new PublicKey(data.subarray(58, 90)),
    proposer: new PublicKey(data.subarray(122, 154)),
    threshold: data[154],
    approvalCount: data[155],
    approvals: readU64(data, 156),
    proposedAt: Number(readI64(data, 164)) * 1000,
    executedAt: Number(readI64(data, 172)) * 1000,
  };
}

const toBuffer = (data: Uint8Array) => (Buffer.isBuffer(data) ? data : Buffer.from(data));

// ==================== READS ====================

// Vault account size: 8 (discriminator) + 32 + 32 + 1 + 8 + 1 + 1 + 1 + 1 + 8 + 8 + 1 + 32 + 32
const VAULT_SIZE = 166;
// Beneficiary account size: 8 + 32 + 32 + 2 + 1 + 1 + 8 + 8 + 1 + 32
const BENEFICIARY_SIZE = 125;

export async function fetchVault(connection: Connection, address: PublicKey): Promise<Vault | null> {
  const info = await connection.getAccountInfo(address);
  if (!info) return null;
  return parseVault(address, toBuffer(info.data), await connection.getBalance(treasuryPda(address)));
}

export async function getVaults(connection: Connection, owner: PublicKey): Promise<Vault[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: VAULT_SIZE }, { memcmp: { offset: 8, bytes: owner.toBase58() } }],
  });
  return Promise.all(
    accounts.map(async ({ pubkey, account }) =>
      parseVault(pubkey, toBuffer(account.data), await connection.getBalance(treasuryPda(pubkey)).catch(() => 0)),
    ),
  );
}

export async function getBeneficiaries(connection: Connection, vault: PublicKey): Promise<Beneficiary[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: BENEFICIARY_SIZE }, { memcmp: { offset: 8, bytes: vault.toBase58() } }],
  });
  return accounts
    .map(({ pubkey, account }) => parseBeneficiary(pubkey, toBuffer(account.data)))
    .filter(b => b.status !== 'removed')
    .sort((a, b) => a.index - b.index);
}

export async function getPlan(connection: Connection, vault: PublicKey): Promise<InheritancePlan | null> {
  const address = planPda(vault);
  const info = await connection.getAccountInfo(address);
  return info ? parsePlan(address, toBuffer(info.data)) : null;
}

export async function getProof(connection: Connection, vault: PublicKey): Promise<DeathCertificateProof | null> {
  const address = proofPda(planPda(vault));
  const info = await connection.getAccountInfo(address);
  return info ? parseProof(address, toBuffer(info.data)) : null;
}

export async function getVerifiers(connection: Connection, vault: PublicKey): Promise<Verifier[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [accountFilter('Verifier'), { memcmp: { offset: 8, bytes: planPda(vault).toBase58() } }],
  });
  return accounts.map(({ pubkey, account }) => parseVerifier(pubkey, toBuffer(account.data)));
}

export async function getSigners(connection: Connection, vault: PublicKey): Promise<MultisigSigner[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [accountFilter('MultisigSigner'), { memcmp: { offset: 8, bytes: vault.toBase58() } }],
  });
  return accounts.map(({ pubkey, account }) => parseSigner(pubkey, toBuffer(account.data))).sort((a, b) => a.index - b.index);
}

export async function getMultisigTransactions(connection: Connection, vault: PublicKey): Promise<MultisigTransaction[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [accountFilter('MultisigTransaction'), { memcmp: { offset: 8, bytes: vault.toBase58() } }],
  });
  return accounts.map(({ pubkey, account }) => parseMultisigTx(pubkey, toBuffer(account.data))).sort((a, b) => b.proposedAt - a.proposedAt);
}

/** Vaults where the wallet is an active co-signer (not necessarily the owner). */
export async function getSignerVaults(connection: Connection, wallet: PublicKey): Promise<Vault[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [accountFilter('MultisigSigner'), { memcmp: { offset: 40, bytes: wallet.toBase58() } }],
  });
  const vaults: Vault[] = [];
  for (const { pubkey, account } of accounts) {
    const signer = parseSigner(pubkey, toBuffer(account.data));
    if (!signer.isActive) continue;
    const vault = await fetchVault(connection, signer.vault);
    if (vault) vaults.push(vault);
  }
  return vaults;
}

/** Vaults where the wallet is a beneficiary or a verifier. */
export async function getMyInheritances(connection: Connection, wallet: PublicKey): Promise<InheritanceView[]> {
  const me = wallet.toBase58();
  const [beneficiaryAccounts, verifierAccounts] = await Promise.all([
    connection.getProgramAccounts(PROGRAM_ID, { filters: [accountFilter('Beneficiary'), { memcmp: { offset: 40, bytes: me } }] }),
    connection.getProgramAccounts(PROGRAM_ID, { filters: [accountFilter('Verifier'), { memcmp: { offset: 40, bytes: me } }] }),
  ]);

  const byVault = new Map<string, { beneficiary: Beneficiary | null; verifier: Verifier | null }>();
  for (const { pubkey, account } of beneficiaryAccounts) {
    const b = parseBeneficiary(pubkey, toBuffer(account.data));
    if (b.status === 'removed') continue;
    byVault.set(b.vault.toBase58(), { beneficiary: b, verifier: null });
  }
  for (const { pubkey, account } of verifierAccounts) {
    const v = parseVerifier(pubkey, toBuffer(account.data));
    const planInfo = await connection.getAccountInfo(v.inheritancePlan);
    if (!planInfo) continue;
    const vaultKey = new PublicKey(planInfo.data.subarray(8, 40)).toBase58();
    const entry = byVault.get(vaultKey) ?? { beneficiary: null, verifier: null };
    entry.verifier = v;
    byVault.set(vaultKey, entry);
  }

  const views: InheritanceView[] = [];
  for (const [vaultKey, roles] of byVault) {
    const vault = await fetchVault(connection, new PublicKey(vaultKey));
    if (!vault) continue;
    views.push({ vault, plan: await getPlan(connection, vault.address), proof: await getProof(connection, vault.address), ...roles });
  }
  return views;
}

// ==================== INSTRUCTIONS ====================
// Each builder returns the instruction(s) for one user action; `me` is the connected wallet.

export const ixs = {
  createVault(me: PublicKey, name: string) {
    const nameBytes = nameToBytes32(name);
    return ix('create_vault', Buffer.from(nameBytes), [w(vaultPda(me, nameBytes)), w(me, true), SYSTEM]);
  },

  deposit(me: PublicKey, vault: PublicKey, sol: number) {
    return ix('deposit', u64(lamports(sol)), [w(vault), w(treasuryPda(vault)), w(me, true), SYSTEM]);
  },

  /** Direct withdrawal by the owner (only when multisig is off or threshold is 1). */
  withdraw(me: PublicKey, vault: PublicKey, sol: number, destination: PublicKey) {
    return ix('withdraw', u64(lamports(sol)), [w(vault), w(treasuryPda(vault)), w(me, true), w(destination), SYSTEM]);
  },

  addBeneficiary(me: PublicKey, vault: PublicKey, heir: PublicKey, sharePercent: number) {
    const bps = u16(Math.floor(sharePercent * 100));
    return ix('add_beneficiary', Buffer.concat([heir.toBuffer(), bps]), [w(vault), w(beneficiaryPda(vault, heir)), w(me, true), SYSTEM]);
  },

  updateShares(me: PublicKey, vault: PublicKey, beneficiaryAccount: PublicKey, sharePercent: number) {
    return ix('update_shares', u16(Math.floor(sharePercent * 100)), [w(vault), w(beneficiaryAccount), r(me, true)]);
  },

  removeBeneficiary(me: PublicKey, vault: PublicKey, heir: PublicKey) {
    return ix('remove_beneficiary', Buffer.alloc(0), [w(vault), w(beneficiaryPda(vault, heir)), w(me, true), SYSTEM]);
  },

  /** Timer values are in form units (minutes in demo builds, days otherwise). */
  createPlan(me: PublicKey, vault: PublicKey, trigger: TriggerType, cooldownUnits: number, deadmanUnits: number, requiredVerifications: number) {
    const args = Buffer.concat([
      Buffer.from([trigger === 'deathCertificate' ? 0 : trigger === 'deadmanSwitch' ? 1 : 2]),
      u64(BigInt(cooldownUnits * TIMER_UNIT_SECONDS)),
      u64(BigInt(deadmanUnits * TIMER_UNIT_SECONDS)),
      Buffer.from([requiredVerifications]),
    ]);
    return ix('create_inheritance_plan', args, [w(vault), w(planPda(vault)), w(me, true), SYSTEM]);
  },

  /** `hasProof`: whether the certificate proof account exists (Anchor expects the program ID when absent). */
  initiate(me: PublicKey, vault: PublicKey, hasProof: boolean) {
    const plan = planPda(vault);
    return ix('initiate_inheritance', Buffer.alloc(0), [
      w(vault), w(plan), r(treasuryPda(vault)), r(hasProof ? proofPda(plan) : PROGRAM_ID), r(me, true),
    ]);
  },

  /** Cancelling also closes the certificate proof so it can't re-trigger inheritance. */
  cancel(me: PublicKey, vault: PublicKey) {
    const plan = planPda(vault);
    return ix('cancel_inheritance', Buffer.alloc(0), [w(vault), w(plan), w(proofPda(plan)), w(me, true), SYSTEM]);
  },

  /** Re-arms a plan the owner cancelled during cooldown. */
  resetPlan(me: PublicKey, vault: PublicKey) {
    return ix('reset_inheritance_plan', Buffer.alloc(0), [w(vault), w(planPda(vault)), r(me, true)]);
  },

  /** `hasMembership`: whether the owner's membership account exists (program ID when absent). */
  claim(me: PublicKey, vault: PublicKey, owner: PublicKey, hasMembership: boolean) {
    return ix('claim_inheritance', Buffer.alloc(0), [
      w(vault), w(planPda(vault)), w(beneficiaryPda(vault, me)), w(treasuryPda(vault)),
      r(hasMembership ? membershipPda(owner) : PROGRAM_ID), w(bsafeTreasuryPda()), w(me, true), SYSTEM,
    ]);
  },

  addVerifier(me: PublicKey, vault: PublicKey, verifier: PublicKey) {
    const plan = planPda(vault);
    return ix('add_verifier', Buffer.alloc(0), [r(vault), r(plan), w(verifierPda(plan, verifier)), r(verifier), w(me, true), SYSTEM]);
  },

  /** Heir submits the SHA-256 hash of the death certificate (the document never leaves the device). */
  submitCertificate(me: PublicKey, vault: PublicKey, documentHash: Uint8Array) {
    const plan = planPda(vault);
    return ix('submit_death_certificate', Buffer.from(documentHash), [
      r(vault), w(plan), r(beneficiaryPda(vault, me)), w(proofPda(plan)), w(me, true), SYSTEM,
    ]);
  },

  verifyCertificate(me: PublicKey, vault: PublicKey) {
    const plan = planPda(vault);
    return ix('verify_death_certificate', Buffer.alloc(0), [r(vault), w(plan), w(proofPda(plan)), w(verifierPda(plan, me)), r(me, true)]);
  },

  addSigner(me: PublicKey, vault: PublicKey, signer: PublicKey) {
    return ix('add_signer', signer.toBuffer(), [w(vault), w(signerPda(vault, signer)), w(me, true), SYSTEM]);
  },

  removeSigner(me: PublicKey, vault: PublicKey, signer: PublicKey) {
    return ix('remove_signer', Buffer.alloc(0), [w(vault), w(signerPda(vault, signer)), w(me, true)]);
  },

  updateThreshold(me: PublicKey, vault: PublicKey, threshold: number) {
    return ix('update_threshold', Buffer.from([threshold]), [w(vault), r(me, true)]);
  },

  /** Proposes a withdrawal; the proposer's approval counts automatically. */
  proposeWithdrawal(me: PublicKey, vault: Vault, sol: number, destination: PublicKey) {
    // TransactionType::Withdrawal, amount, destination, then 32 unused bytes for other tx types
    const args = Buffer.concat([Buffer.from([0]), u64(lamports(sol)), destination.toBuffer(), Buffer.alloc(32)]);
    return ix('propose_transaction', args, [
      w(vault.address), r(signerPda(vault.address, me)), w(multisigTxPda(vault.address, vault.trackedBalanceLamports + 1n)), w(me, true), SYSTEM,
    ]);
  },

  approve(me: PublicKey, vault: PublicKey, tx: PublicKey) {
    return ix('approve_transaction', Buffer.alloc(0), [r(vault), r(signerPda(vault, me)), w(tx), r(me, true)]);
  },

  reject(me: PublicKey, vault: PublicKey, tx: PublicKey) {
    return ix('reject_transaction', Buffer.alloc(0), [r(vault), w(tx), r(me, true)]);
  },

  execute(me: PublicKey, vault: PublicKey, tx: MultisigTransaction) {
    return ix('execute_transaction', Buffer.alloc(0), [w(vault), w(tx.address), w(treasuryPda(vault)), w(tx.destination), r(me, true), SYSTEM]);
  },
};

export { membershipPda, multisigTxPda, proofPda, planPda };
