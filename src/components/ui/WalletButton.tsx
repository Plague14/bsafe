import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
  return (
    <WalletMultiButton className="!bg-emerald-600 hover:!bg-emerald-700 !rounded-lg !h-10 !font-medium !text-sm" />
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
    <div className="flex items-center gap-2 text-emerald-400">
      <div className="w-2 h-2 rounded-full bg-emerald-500" />
      <span className="text-sm font-mono">{shortAddress}</span>
    </div>
  );
}
