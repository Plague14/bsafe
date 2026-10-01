import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
  return (
    // Styled via .wallet-adapter-* overrides in index.css (brand blue, light modal)
    <WalletMultiButton />
  );
}

export function WalletStatus() {
  const { publicKey, connected } = useWallet();

  if (!connected || !publicKey) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="w-2 h-2 rounded-full bg-gray-500" />
        <span className="text-sm">Not connected</span>
      </div>
    );
  }

  const shortAddress = `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;

  return (
    <div className="flex items-center gap-2 text-primary-700">
      <div className="w-2 h-2 rounded-full bg-primary-600" />
      <span className="text-sm font-mono">{shortAddress}</span>
    </div>
  );
}
