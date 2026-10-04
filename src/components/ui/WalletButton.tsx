import { useWallet } from '@solana/wallet-adapter-react';
import { BaseWalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useI18n } from '../../i18n';

export function WalletButton() {
  const { t } = useI18n();
  // Styled via .wallet-adapter-* overrides in index.css (brand blue, light modal)
  return (
    <BaseWalletMultiButton
      labels={{
        'change-wallet': t('wallet.changeWallet'),
        connecting: t('wallet.connecting'),
        'copy-address': t('wallet.copyAddress'),
        copied: t('wallet.copied'),
        disconnect: t('wallet.disconnect'),
        'has-wallet': t('wallet.connect'),
        'no-wallet': t('wallet.selectWallet'),
      }}
    />
  );
}

export function WalletStatus() {
  const { publicKey, connected } = useWallet();
  const { t } = useI18n();

  if (!connected || !publicKey) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="w-2 h-2 rounded-full bg-gray-500" />
        <span className="text-sm">{t('common.notConnected')}</span>
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
