import { Link } from 'react-router-dom';
import { Plus, Send, Users, MessageSquare, FileText, Wallet, RefreshCw } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { Card, Button, WalletButton } from '../../components/ui';
import { useProgram } from '../../hooks/useProgram';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const { connection, getBalance, requestAirdrop, loading } = useProgram();
  const [balance, setBalance] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch balance when wallet connects
  useEffect(() => {
    if (publicKey) {
      fetchBalance();
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
      alert('Airdrop falhou - tente pelo site: https://faucet.solana.com');
    }
    setRefreshing(false);
  };

  // Mock data for beneficiaries (will be replaced with on-chain data)
  const beneficiaries = [
    { id: 1, name: 'Filho 1', percentage: 50 },
    { id: 2, name: 'Filho 2', percentage: 30 },
    { id: 3, name: 'Cônjuge', percentage: 20 },
  ];

  const totalSOL = balance;

  // Not connected view
  if (!connected) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="bg-gradient-to-br from-gray-800 to-gray-900 text-white border-0">
          <div className="text-center py-8">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold mb-2">Conecte sua Carteira</h2>
            <p className="text-gray-400 mb-6">
              Para acessar o BSafe, conecte sua carteira Solana (Phantom, Solflare, etc.)
            </p>
            <WalletButton />
          </div>
        </Card>

        <Card header={<span className="font-semibold text-gray-900">O que é o BSafe?</span>}>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg">
              <div className="text-2xl mb-2">🔐</div>
              <h3 className="font-semibold text-gray-900 mb-1">Multisig Seguro</h3>
              <p className="text-sm text-gray-600">Múltiplas assinaturas para proteger seus ativos</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl mb-2">📜</div>
              <h3 className="font-semibold text-gray-900 mb-1">Herança Digital</h3>
              <p className="text-sm text-gray-600">Transfira seus ativos automaticamente para herdeiros</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl mb-2">⏰</div>
              <h3 className="font-semibold text-gray-900 mb-1">Deadman Switch</h3>
              <p className="text-sm text-gray-600">Ativação automática por inatividade</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 font-mono text-sm">
            {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
            Devnet
          </span>
        </div>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-emerald-200 text-sm mb-1">Saldo da Carteira</p>
            <p className="text-4xl font-bold mb-1">{balance.toFixed(4)} SOL</p>
            <p className="text-emerald-200 text-sm">≈ ${(balance * 150).toFixed(2)} USD</p>
          </div>
          <button
            onClick={fetchBalance}
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
            Airdrop (Devnet)
          </Button>
          <Link to="/dashboard/assets">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 border-0" icon={<Send className="w-4 h-4" />}>
              Criar Vault
            </Button>
          </Link>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vaults Ativos</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Beneficiários</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Plano de Herança</p>
              <p className="text-2xl font-bold text-gray-900">Não configurado</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Create Vault CTA */}
        <Card header={<span className="font-semibold text-gray-900">Criar Vault</span>}>
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <Plus className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Crie seu primeiro Vault</h3>
            <p className="text-sm text-gray-500 mb-4">
              Um vault é um cofre seguro para guardar seus SOL com proteção multisig e herança digital.
            </p>
            <Link to="/dashboard/assets">
              <Button icon={<Plus className="w-4 h-4" />}>Criar Vault</Button>
            </Link>
          </div>
        </Card>

        {/* Beneficiaries Preview */}
        <Card header={
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900">Beneficiários</span>
            <Link to="/dashboard/beneficiaries" className="text-sm text-emerald-600 hover:underline">
              Configurar
            </Link>
          </div>
        }>
          <div className="text-center py-6">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-4">
              Adicione beneficiários após criar um vault
            </p>
            <Link to="/dashboard/beneficiaries">
              <Button size="sm" variant="secondary" icon={<Users className="w-4 h-4" />}>
                Ver Beneficiários
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card header={<span className="font-semibold text-gray-900">Ações Rápidas</span>}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: '/dashboard/assets', icon: Plus, label: 'Criar Vault', color: 'text-emerald-600' },
            { to: '/dashboard/beneficiaries', icon: Users, label: 'Gerenciar Herdeiros', color: 'text-blue-600' },
            { to: '/dashboard/plans', icon: FileText, label: 'Plano de Herança', color: 'text-purple-600' },
            { to: '/dashboard/settings', icon: MessageSquare, label: 'Configurações', color: 'text-gray-600' },
          ].map(action => (
            <Link
              key={action.to}
              to={action.to}
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
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
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-gray-500">Conectado à Solana Devnet</span>
          </div>
          <span className="font-mono text-gray-400">
            Program: 3a7Yvu...mp3Kv
          </span>
        </div>
      </Card>
    </div>
  );
}
