import deployment from '../../starknet/deployments/sepolia.json';

export const SN_CONTRACT = deployment.contract;
export const SN_DEMO_MODE = deployment.demoMode;
export const SN_RPC_URL =
  import.meta.env.VITE_STARKNET_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia';
/** 'SN_SEPOLIA' as a hex felt */
export const SN_CHAIN_ID = '0x534e5f5345504f4c4941';

export interface SnToken {
  symbol: string;
  address: string;
  decimals: number;
}

export const SN_TOKENS: SnToken[] = [
  { symbol: 'STRK', address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', decimals: 18 },
  { symbol: 'ETH', address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', decimals: 18 },
];

export const snExplorer = {
  tx: (hash: string) => `https://sepolia.voyager.online/tx/${hash}`,
  contract: (addr: string) => `https://sepolia.voyager.online/contract/${addr}`,
};

export const SN_FAUCET = 'https://starknet-faucet.vercel.app';

/** Timer presets: minutes on the demo deployment, days in production */
export const SN_TIMER_UNIT = SN_DEMO_MODE ? 60 : 24 * 60 * 60;
export const SN_DEFAULTS = SN_DEMO_MODE
  ? { cooldown: 1, deadman: 2 } // minutes
  : { cooldown: 30, deadman: 365 }; // days
