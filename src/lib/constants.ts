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
