import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv');

export const CLUSTER = 'devnet' as const;
/** MWA 2.0 chain identifier passed to the wallet on authorize */
export const CHAIN = 'solana:devnet';

// The public devnet RPC is rate-limited; EXPO_PUBLIC_RPC_URL can point at a dedicated endpoint
export const RPC_ENDPOINT = process.env.EXPO_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

export const APP_IDENTITY = {
  name: 'BSafe',
  uri: 'https://bsafe-jade.vercel.app',
  icon: 'images/logo-fundo-azul.png',
};

// The devnet program is built with the `demo-timers` feature: timer minimums are minutes
// (cooldown >= 1 min, deadman >= 2 min) so the whole inheritance flow can be shown live.
export const DEMO_TIMERS = (process.env.EXPO_PUBLIC_DEMO_TIMERS ?? 'true') !== 'false';

/** Seconds per unit used by the plan form: minutes in demo builds, days otherwise. */
export const TIMER_UNIT_SECONDS = DEMO_TIMERS ? 60 : 24 * 60 * 60;

export const COOLDOWN_RANGE = DEMO_TIMERS ? { min: 1, max: 60, default: 1 } : { min: 1, max: 365, default: 30 };
export const DEADMAN_RANGE = DEMO_TIMERS ? { min: 2, max: 120, default: 2 } : { min: 30, max: 1825, default: 365 };

export const SEEDS = {
  VAULT: 'vault',
  VAULT_TREASURY: 'vault_treasury',
  BENEFICIARY: 'beneficiary',
  INHERITANCE: 'inheritance',
  PROOF: 'proof',
  VERIFIER: 'verifier',
  SIGNER: 'signer',
  MULTISIG_TX: 'multisig_tx',
  MEMBERSHIP: 'membership',
  BSAFE_TREASURY: 'bsafe_treasury',
} as const;

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
export const explorerAddress = (addr: string) => `https://explorer.solana.com/address/${addr}?cluster=${CLUSTER}`;
