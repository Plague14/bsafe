import { PublicKey } from '@solana/web3.js';

// BSafe Program ID (Devnet)
export const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_PROGRAM_ID || '3a7Yvu89jRSMLDQJnLVepCNLENjckrK1ntQznChmp3Kv'
);

// Network Configuration
export const NETWORK = 'devnet';
// The public devnet RPC is rate-limited; set VITE_RPC_URL (e.g. a Helius/QuickNode devnet URL) for demos
export const RPC_ENDPOINT = import.meta.env.VITE_RPC_URL || 'https://api.devnet.solana.com';

// PDA Seeds
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

// Basis points (100% = 10000)
export const BPS_100_PERCENT = 10000;

// Time constants (in seconds)
export const MIN_COOLDOWN = 86400; // 1 day
export const MAX_COOLDOWN = 31536000; // 365 days
export const MIN_DEADMAN_SWITCH = 30 * 24 * 60 * 60; // 30 days
export const MAX_DEADMAN_SWITCH = 5 * 365 * 24 * 60 * 60; // 5 years

// The devnet program is built with the `demo-timers` feature: timer minimums are minutes
// (cooldown >= 1 min, deadman >= 2 min) so the whole inheritance flow can be shown live.
// Set VITE_DEMO_TIMERS=false when pointing at a production build (minimums: 1 day / 30 days).
export const DEMO_TIMERS = (import.meta.env.VITE_DEMO_TIMERS ?? 'true') !== 'false';

/** Seconds per unit used by the plan form: minutes in demo builds, days otherwise. */
export const TIMER_UNIT_SECONDS = DEMO_TIMERS ? 60 : 24 * 60 * 60;

/** Slider bounds for the plan form, in TIMER_UNIT_SECONDS units. */
export const COOLDOWN_RANGE = DEMO_TIMERS ? { min: 1, max: 60, default: 1 } : { min: 1, max: 365, default: 30 };
export const DEADMAN_RANGE = DEMO_TIMERS ? { min: 2, max: 120, default: 2 } : { min: 30, max: 1825, default: 365 };
