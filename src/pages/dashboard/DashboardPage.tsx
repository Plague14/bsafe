import { Link } from 'react-router-dom';
import { Plus, Send, Users, MessageSquare, FileText, Wallet, RefreshCw } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { Card, Button, WalletButton } from '../../components/ui';
import { useProgram, type Vault } from '../../hooks/useProgram';
import { useI18n } from '../../i18n';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const { connection, getVaults, getInheritancePlan } = useProgram();
  const { t } = useI18n();
  const [balance, setBalance] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [plansConfigured, setPlansConfigured] = useState(0);

  // Fetch balance and vault stats when wallet connects
  useEffect(() => {
    if (publicKey) {
      fetchBalance();
      fetchStats();
    }
  }, [publicKey]);

  const fetchBalance = async () => {
    if (!publicKey) return;
    setRefreshing(true);
    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
    setRefreshing(false);
  };

  const fetchStats = async () => {
    const fetched = await getVaults();
    setVaults(fetched);
    const plans = await Promise.all(fetched.map(v => getInheritancePlan(v.address)));
    setPlansConfigured(plans.filter(Boolean).length);
  };

  const handleAirdrop = async () => {
    if (!publicKey) return;
    setRefreshing(true);
    try {
      await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
      // Wait for confirmation
      await new Promise(r => setTimeout(r, 2000));
      await fetchBalance();
    } catch (err) {
      console.error('Airdrop failed:', err);
      alert(t('dashboard.airdropFailed'));
    }
    setRefreshing(false);
  };

  const totalBeneficiaries = vaults.reduce((sum, v) => sum + v.beneficiaryCount, 0);

  // Not connected view
  if (!connected) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="bg-gradient-to-br from-primary-600 to-primary-800 text-white border-0">
          <div className="text-center py-8">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-primary-200" />
            <h2 className="text-2xl font-bold mb-2">{t('dashboard.connectTitle')}</h2>
            <p className="text-primary-100 mb-6">{t('dashboard.connectBody')}</p>
            <div className="wallet-on-blue">
              <WalletButton />
            </div>
          </div>
        </Card>

        <Card header={<span className="font-semibold text-gray-900">{t('dashboard.whatIs')}</span>}>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary-50 rounded-lg">
              <div className="text-2xl mb-2">🔐</div>
              <h3 className="font-semibold text-gray-900 mb-1">{t('dashboard.featMultisigTitle')}</h3>
              <p className="text-sm text-gray-600">{t('dashboard.featMultisigBody')}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl mb-2">📜</div>
              <h3 className="font-semibold text-gray-900 mb-1">{t('dashboard.featInheritanceTitle')}</h3>
              <p className="text-sm text-gray-600">{t('dashboard.featInheritanceBody')}</p>
            </div>
            <div className="p-4 bg-primary-50 rounded-lg">
              <div className="text-2xl mb-2">⏰</div>
              <h3 className="font-semibold text-gray-900 mb-1">{t('dashboard.featDeadmanTitle')}</h3>
              <p className="text-sm text-gray-600">{t('dashboard.featDeadmanBody')}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Connected view
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
          <p className="text-gray-500 font-mono text-sm">
            {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium">
            Devnet
          </span>
        </div>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-primary-600 to-primary-800 text-white border-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-primary-200 text-sm mb-1">{t('dashboard.walletBalance')}</p>
            <p className="text-4xl font-bold mb-1">{balance.toFixed(4)} SOL</p>
            <p className="text-primary-200 text-sm">≈ ${(balance * 150).toFixed(2)} USD</p>
          </div>
          <button
            onClick={() => { fetchBalance(); fetchStats(); }}
            disabled={refreshing}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex gap-3 mt-6">
          <Button
            size="sm"
            className="bg-white/20 hover:bg-white/30 border-0"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleAirdrop}
            disabled={refreshing}
          >
            {t('dashboard.airdrop')}
          </Button>
          <Link to="/dashboard/assets">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 border-0" icon={<Send className="w-4 h-4" />}>
              {t('common.createVault')}
            </Button>
          </Link>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Wallet className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('dashboard.activeVaults')}</p>
              <p className="text-2xl font-bold text-gray-900">{vaults.length}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('dashboard.beneficiaries')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalBeneficiaries}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 rounded-lg">
              <FileText className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('nav.plans')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {plansConfigured > 0
                  ? t('dashboard.plansConfigured', { count: plansConfigured, total: vaults.length })
                  : t('dashboard.notConfigured')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Create Vault CTA */}
        <Card header={<span className="font-semibold text-gray-900">{t('common.createVault')}</span>}>
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <Plus className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {vaults.length > 0 ? t('dashboard.anotherVaultTitle') : t('dashboard.firstVaultTitle')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{t('dashboard.vaultExplainer')}</p>
            <Link to="/dashboard/assets">
              <Button icon={<Plus className="w-4 h-4" />}>{t('common.createVault')}</Button>
            </Link>
          </div>
        </Card>

        {/* Beneficiaries Preview */}
        <Card header={
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900">{t('dashboard.beneficiaries')}</span>
            <Link to="/dashboard/beneficiaries" className="text-sm text-primary-600 hover:underline">
              {t('dashboard.configure')}
            </Link>
          </div>
        }>
          <div className="text-center py-6">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-4">
              {vaults.length > 0
                ? t('dashboard.heirsAcrossVaults', { count: totalBeneficiaries })
                : t('dashboard.addHeirsAfterVault')}
            </p>
            <Link to="/dashboard/beneficiaries">
              <Button size="sm" variant="secondary" icon={<Users className="w-4 h-4" />}>
                {t('dashboard.viewBeneficiaries')}
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card header={<span className="font-semibold text-gray-900">{t('dashboard.quickActions')}</span>}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: '/dashboard/assets', icon: Plus, label: t('common.createVault'), color: 'text-primary-600' },
            { to: '/dashboard/beneficiaries', icon: Users, label: t('dashboard.manageHeirs'), color: 'text-blue-600' },
            { to: '/dashboard/plans', icon: FileText, label: t('nav.plans'), color: 'text-primary-600' },
            { to: '/dashboard/settings', icon: MessageSquare, label: t('nav.settings'), color: 'text-gray-600' },
          ].map(action => (
            <Link
              key={action.to}
              to={action.to}
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-primary-200 hover:bg-primary-50 transition-colors"
            >
              <action.icon className={`w-5 h-5 ${action.color}`} />
              <span className="text-sm font-medium text-gray-900">{action.label}</span>
            </Link>
          ))}
        </div>
      </Card>

      {/* Network Info */}
      <Card>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary-500"></div>
            <span className="text-gray-500">{t('dashboard.connectedDevnet')}</span>
          </div>
          <span className="font-mono text-gray-400">
            Program: 3a7Yvu...mp3Kv
          </span>
        </div>
      </Card>
    </div>
  );
}
