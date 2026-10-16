import { CairoCustomEnum, Contract, RpcProvider, cairo, num, shortString, type Call } from 'starknet';
import abi from './abi.json';
import { SN_CONTRACT, SN_RPC_URL, SN_TOKENS, type SnToken } from './config';

export const snProvider = new RpcProvider({ nodeUrl: SN_RPC_URL });
const bsafe = new Contract({ abi, address: SN_CONTRACT, providerOrAccount: snProvider });

// ---------- types (mirror starknet/src/types.cairo) ----------

export type VaultStatus = 'Active' | 'InheritanceInitiated' | 'InheritanceCompleted';
export type BeneficiaryStatus = 'None' | 'Active' | 'Removed' | 'Claimed';
export type InheritanceStatus =
  | 'None' | 'Configured' | 'ProofSubmitted' | 'CooldownActive' | 'ClaimReady' | 'Completed' | 'Cancelled';
export type TriggerType = 'DeathCertificate' | 'DeadmanSwitch' | 'Both';

export interface SnVault {
  id: bigint;
  owner: string;
  name: string;
  token: SnToken;
  status: VaultStatus;
  balance: bigint;
  beneficiaryCount: number;
  beneficiaryListLen: number;
  totalShareBps: number;
  lastActivity: number;
  createdAt: number;
}

export interface SnBeneficiary {
  wallet: string;
  shareBps: number;
  status: BeneficiaryStatus;
  claimedAmount: bigint;
}

export interface SnPlan {
  status: InheritanceStatus;
  triggerType: TriggerType;
  cooldownSeconds: number;
  deadmanSeconds: number;
  requiredVerifications: number;
  currentVerifications: number;
  verifierCount: number;
  triggeredAt: number;
  cooldownEndsAt: number;
  distributionAmount: bigint;
  claimsCount: number;
  beneficiariesSnapshot: number;
}

export interface SnProof {
  documentHash: string;
  submittedBy: string;
  submittedAt: number;
  verified: boolean;
  nonce: number;
}

export interface SnVerifier {
  address: string;
  verifiedNonce: number;
}

// ---------- helpers ----------

type Raw = Record<string, unknown>;

export const toAddress = (v: unknown) => num.toHex64(num.toBigInt(v as bigint));
export const sameAddress = (a: string, b: string) => {
  try {
    return num.toBigInt(a) === num.toBigInt(b);
  } catch {
    return false;
  }
};
const variant = <T extends string>(v: unknown) => (v as CairoCustomEnum).activeVariant() as T;
const n = (v: unknown) => Number(v as bigint);
const big = (v: unknown) => BigInt(v as bigint);

export function tokenFor(address: unknown): SnToken {
  const hex = toAddress(address);
  return (
    SN_TOKENS.find(t => sameAddress(t.address, hex)) ?? { symbol: 'TOKEN', address: hex, decimals: 18 }
  );
}

export function formatAmount(amount: bigint, decimals = 18, maxFraction = 4): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = (amount % base).toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function parseAmount(value: string, decimals = 18): bigint {
  const clean = value.trim().replace(',', '.');
  if (!/^\d*\.?\d*$/.test(clean) || clean === '' || clean === '.') throw new Error('invalid amount');
  const [whole, frac = ''] = clean.split('.');
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// ---------- reads ----------

function parseVault(id: bigint, r: Raw): SnVault {
  return {
    id,
    owner: toAddress(r.owner),
    name: shortString.decodeShortString(num.toHex(r.name as bigint)),
    token: tokenFor(r.token),
    status: variant<VaultStatus>(r.status),
    balance: big(r.balance),
    beneficiaryCount: n(r.beneficiary_count),
    beneficiaryListLen: n(r.beneficiary_list_len),
    totalShareBps: n(r.total_share_bps),
    lastActivity: n(r.last_activity),
    createdAt: n(r.created_at),
  };
}

export async function getVault(id: bigint): Promise<SnVault> {
  return parseVault(id, (await bsafe.get_vault(id)) as Raw);
}

async function getIds(fn: string, addr: string): Promise<bigint[]> {
  const ids = (await bsafe.call(fn, [addr])) as bigint[];
  // Role lists are append-only and may repeat; keep first occurrence
  return [...new Set(ids.map(i => BigInt(i)))];
}

export const getOwnerVaultIds = (a: string) => getIds('get_owner_vaults', a);
export const getHeirVaultIds = (a: string) => getIds('get_heir_vaults', a);
export const getVerifierVaultIds = (a: string) => getIds('get_verifier_vaults', a);

export async function getBeneficiaries(vault: SnVault): Promise<SnBeneficiary[]> {
  const out: SnBeneficiary[] = [];
  for (let i = 0; i < vault.beneficiaryListLen; i++) {
    const wallet = toAddress(await bsafe.get_beneficiary_at(vault.id, i));
    const b = (await bsafe.get_beneficiary(vault.id, wallet)) as Raw;
    out.push({
      wallet,
      shareBps: n(b.share_bps),
      status: variant<BeneficiaryStatus>(b.status),
      claimedAmount: big(b.claimed_amount),
    });
  }
  return out;
}

export async function getBeneficiary(vaultId: bigint, wallet: string): Promise<SnBeneficiary> {
  const b = (await bsafe.get_beneficiary(vaultId, wallet)) as Raw;
  return {
    wallet,
    shareBps: n(b.share_bps),
    status: variant<BeneficiaryStatus>(b.status),
    claimedAmount: big(b.claimed_amount),
  };
}

export async function getPlan(vaultId: bigint): Promise<SnPlan> {
  const p = (await bsafe.get_plan(vaultId)) as Raw;
  return {
    status: variant<InheritanceStatus>(p.status),
    triggerType: variant<TriggerType>(p.trigger_type),
    cooldownSeconds: n(p.cooldown_seconds),
    deadmanSeconds: n(p.deadman_seconds),
    requiredVerifications: n(p.required_verifications),
    currentVerifications: n(p.current_verifications),
    verifierCount: n(p.verifier_count),
    triggeredAt: n(p.triggered_at),
    cooldownEndsAt: n(p.cooldown_ends_at),
    distributionAmount: big(p.distribution_amount),
    claimsCount: n(p.claims_count),
    beneficiariesSnapshot: n(p.beneficiaries_snapshot),
  };
}

export async function getProof(vaultId: bigint): Promise<SnProof> {
  const p = (await bsafe.get_proof(vaultId)) as Raw;
  return {
    documentHash: num.toHex(p.document_hash as bigint),
    submittedBy: toAddress(p.submitted_by),
    submittedAt: n(p.submitted_at),
    verified: Boolean(p.verified),
    nonce: n(p.nonce),
  };
}

export async function getVerifiers(vaultId: bigint, count: number): Promise<SnVerifier[]> {
  const out: SnVerifier[] = [];
  for (let i = 0; i < count; i++) {
    const address = toAddress(await bsafe.get_verifier_at(vaultId, i));
    const v = (await bsafe.get_verifier(vaultId, address)) as Raw;
    out.push({ address, verifiedNonce: n(v.verified_nonce) });
  }
  return out;
}

export async function getVerifier(vaultId: bigint, address: string): Promise<SnVerifier & { exists: boolean }> {
  const v = (await bsafe.get_verifier(vaultId, address)) as Raw;
  return { address, exists: Boolean(v.exists), verifiedNonce: n(v.verified_nonce) };
}

export async function getTokenBalance(token: string, account: string): Promise<bigint> {
  const res = await snProvider.callContract({ contractAddress: token, entrypoint: 'balance_of', calldata: [account] });
  return BigInt(res[0]) + (BigInt(res[1] ?? 0) << 128n);
}

export async function chainNow(): Promise<number> {
  const block = await snProvider.getBlockWithTxHashes('latest');
  return Number(block.timestamp);
}

// ---------- write calls ----------

const u256 = (v: bigint) => cairo.uint256(v);

export const calls = {
  createVault: (name: string, token: string): Call =>
    bsafe.populate('create_vault', { name: shortString.encodeShortString(name), token }),
  /** approve + deposit in one multicall */
  deposit: (vault: SnVault, amount: bigint): Call[] => [
    {
      contractAddress: vault.token.address,
      entrypoint: 'approve',
      calldata: [SN_CONTRACT, ...Object.values(u256(amount))].map(String),
    },
    bsafe.populate('deposit', { vault_id: vault.id, amount: u256(amount) }),
  ],
  withdraw: (id: bigint, amount: bigint, to: string): Call =>
    bsafe.populate('withdraw', { vault_id: id, amount: u256(amount), to }),
  heartbeat: (id: bigint): Call => bsafe.populate('heartbeat', { vault_id: id }),
  addBeneficiary: (id: bigint, wallet: string, shareBps: number): Call =>
    bsafe.populate('add_beneficiary', { vault_id: id, wallet, share_bps: shareBps }),
  removeBeneficiary: (id: bigint, wallet: string): Call =>
    bsafe.populate('remove_beneficiary', { vault_id: id, wallet }),
  createPlan: (id: bigint, trigger: TriggerType, cooldown: number, deadman: number, verifications: number): Call =>
    bsafe.populate('create_inheritance_plan', {
      vault_id: id,
      trigger_type: new CairoCustomEnum({ [trigger]: {} }),
      cooldown_seconds: cooldown,
      deadman_seconds: deadman,
      required_verifications: verifications,
    }),
  addVerifier: (id: bigint, verifier: string): Call =>
    bsafe.populate('add_verifier', { vault_id: id, verifier }),
  submitCertificate: (id: bigint, documentHash: string): Call =>
    bsafe.populate('submit_death_certificate', { vault_id: id, document_hash: documentHash }),
  verifyCertificate: (id: bigint): Call => bsafe.populate('verify_death_certificate', { vault_id: id }),
  initiate: (id: bigint): Call => bsafe.populate('initiate_inheritance', { vault_id: id }),
  claim: (id: bigint): Call => bsafe.populate('claim_inheritance', { vault_id: id }),
  cancel: (id: bigint): Call => bsafe.populate('cancel_inheritance', { vault_id: id }),
  reset: (id: bigint): Call => bsafe.populate('reset_inheritance_plan', { vault_id: id }),
};

/** SHA-256 of a file, truncated to fit a felt (251 bits) */
export async function hashDocument(file: File): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  digest[0] &= 0x03;
  return '0x' + Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
}
