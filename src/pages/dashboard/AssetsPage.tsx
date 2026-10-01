import { useState, useEffect } from 'react';
import { Plus, ArrowDownRight, ArrowUpRight, Copy, Check, ExternalLink, RefreshCw, Wallet } from 'lucide-react';
import { Card, Button, Input, Modal } from '../../components/ui';
import { useProgram, type Vault } from '../../hooks/useProgram';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Link } from 'react-router-dom';

export function AssetsPage() {
  const { publicKey } = useWallet();
  const { getVaults, createVault, depositToVault, withdrawFromVault, loading, error } = useProgram();

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState<Vault | null>(null);
  const [vaultName, setVaultName] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState<Vault | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDestination, setWithdrawDestination] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch vaults on mount
  useEffect(() => {
    if (publicKey) {
      refreshVaults();
    }
  }, [publicKey]);

  const refreshVaults = async () => {
    setRefreshing(true);
    const fetchedVaults = await getVaults();
    setVaults(fetchedVaults);
    setRefreshing(false);
  };

  const handleCreateVault = async () => {
    if (!vaultName.trim()) return;

    const vaultPDA = await createVault(vaultName.trim());
    if (vaultPDA) {
      setShowCreateModal(false);
      setVaultName('');
      await refreshVaults();
    }
  };

  const handleDeposit = async () => {
    if (!showDepositModal || !depositAmount) return;

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;

    const signature = await depositToVault(showDepositModal.address, amount);
    if (signature) {
      setShowDepositModal(null);
      setDepositAmount('');
      await refreshVaults();
    }
  };

  const openWithdraw = (vault: Vault) => {
    setWithdrawAmount('');
    setWithdrawDestination(publicKey?.toBase58() ?? '');
    setShowWithdrawModal(vault);
  };

  const parseDestination = (value: string): PublicKey | null => {
    try {
      return new PublicKey(value.trim());
    } catch {
      return null;
    }
  };

  const handleWithdraw = async () => {
    if (!showWithdrawModal) return;
    const amount = parseFloat(withdrawAmount);
    const destination = parseDestination(withdrawDestination);
    if (isNaN(amount) || amount <= 0 || !destination) return;

    const signature = await withdrawFromVault(showWithdrawModal.address, amount, destination);
    if (signature) {
      setShowWithdrawModal(null);
      await refreshVaults();
    }
  };

  const requiresMultisig = (vault: Vault) => vault.multisigEnabled && vault.multisigThreshold > 1;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const totalBalance = vaults.reduce((sum, v) => sum + v.balance, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vaults</h1>
          <p className="text-gray-500">Gerencie seus cofres seguros</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={refreshVaults}
            disabled={refreshing}
            icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
          >
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Criar Vault
          </Button>
        </div>
      </div>

      {/* Total Balance */}
      <Card className="bg-gradient-to-br from-primary-600 to-primary-800 text-white border-0">
        <p className="text-primary-200 text-sm mb-1">Saldo Total em Vaults</p>
        <p className="text-3xl font-bold mb-1">{totalBalance.toFixed(4)} SOL</p>
        <p className="text-primary-200 text-sm">≈ ${(totalBalance * 150).toFixed(2)} USD</p>
        <p className="text-primary-300 text-xs mt-2">{vaults.length} vault{vaults.length !== 1 ? 's' : ''} ativo{vaults.length !== 1 ? 's' : ''}</p>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Vaults List */}
      {vaults.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum vault encontrado</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Crie seu primeiro vault para começar a proteger seus ativos com segurança multisig e herança digital.
            </p>
            <Button onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
              Criar Primeiro Vault
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Seus Vaults</h2>
          {vaults.map(vault => (
            <Card key={vault.address.toBase58()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{vault.name || 'Vault'}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-gray-500">{formatAddress(vault.address.toBase58())}</code>
                      <button
                        onClick={() => handleCopy(vault.address.toBase58())}
                        className="p-0.5 hover:bg-gray-100 rounded"
                      >
                        {copied === vault.address.toBase58() ? (
                          <Check className="w-3 h-3 text-primary-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                      <a
                        href={`https://explorer.solana.com/address/${vault.address.toBase58()}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-0.5 hover:bg-gray-100 rounded"
                      >
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-xl">{vault.balance.toFixed(4)} SOL</p>
                  <p className="text-sm text-gray-500">≈ ${(vault.balance * 150).toFixed(2)}</p>
                </div>
              </div>

              {/* Vault Stats */}
              <div className="grid grid-cols-4 gap-4 py-4 border-y border-gray-100 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className={`text-sm font-medium ${
                    vault.status === 'active' ? 'text-green-600' :
                    vault.status === 'locked' ? 'text-yellow-600' : 'text-primary-600'
                  }`}>
                    {vault.status === 'active' ? 'Ativo' :
                     vault.status === 'locked' ? 'Bloqueado' : 'Herança'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Multisig</p>
                  <p className="text-sm font-medium text-gray-900">
                    {vault.multisigEnabled ? `${vault.multisigThreshold}/${vault.signerCount}` : 'Não'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Beneficiários</p>
                  <p className="text-sm font-medium text-gray-900">{vault.beneficiaryCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Última Atividade</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(vault.lastActivity).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowDepositModal(vault)}
                  icon={<ArrowDownRight className="w-4 h-4" />}
                >
                  Depositar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openWithdraw(vault)}
                  disabled={vault.status !== 'active'}
                  icon={<ArrowUpRight className="w-4 h-4" />}
                >
                  Sacar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Vault Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setVaultName(''); }}
        title="Criar Novo Vault"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateVault}
              disabled={!vaultName.trim() || loading}
            >
              {loading ? 'Criando...' : 'Criar Vault'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome do Vault"
            value={vaultName}
            onChange={e => setVaultName(e.target.value)}
            placeholder="Ex: Meu Cofre Principal"
            hint="Máximo de 32 caracteres"
            maxLength={32}
          />
          <div className="p-4 bg-primary-50 rounded-lg">
            <h4 className="font-medium text-primary-900 mb-2">O que é um Vault?</h4>
            <ul className="text-sm text-primary-700 space-y-1">
              <li>- Cofre seguro para guardar seus SOL</li>
              <li>- Pode ser configurado com multisig</li>
              <li>- Permite adicionar beneficiários para herança</li>
              <li>- Protegido por smart contract na blockchain</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Deposit Modal */}
      <Modal
        isOpen={!!showDepositModal}
        onClose={() => { setShowDepositModal(null); setDepositAmount(''); }}
        title={`Depositar em ${showDepositModal?.name || 'Vault'}`}
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowDepositModal(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDeposit}
              disabled={!depositAmount || parseFloat(depositAmount) <= 0 || loading}
            >
              {loading ? 'Depositando...' : 'Depositar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Quantidade (SOL)"
            type="number"
            value={depositAmount}
            onChange={e => setDepositAmount(e.target.value)}
            placeholder="0.00"
            step="0.001"
            min="0"
          />
          {showDepositModal && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Vault Treasury</span>
                <code className="text-xs">{formatAddress(showDepositModal.treasury.toBase58())}</code>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Saldo atual</span>
                <span>{showDepositModal.balance.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Taxa estimada</span>
                <span>~0.000005 SOL</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
      {/* Withdraw Modal */}
      <Modal
        isOpen={!!showWithdrawModal}
        onClose={() => setShowWithdrawModal(null)}
        title={`Sacar de ${showWithdrawModal?.name || 'Vault'}`}
        footer={
          showWithdrawModal && requiresMultisig(showWithdrawModal) ? (
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowWithdrawModal(null)}>
                Fechar
              </Button>
              <Link to="/dashboard/multisig">
                <Button>Ir para Multisig</Button>
              </Link>
            </div>
          ) : (
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowWithdrawModal(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={
                  loading ||
                  !(parseFloat(withdrawAmount) > 0) ||
                  parseFloat(withdrawAmount) > (showWithdrawModal?.balance ?? 0) ||
                  !parseDestination(withdrawDestination)
                }
              >
                {loading ? 'Sacando...' : 'Sacar'}
              </Button>
            </div>
          )
        }
      >
        {showWithdrawModal && requiresMultisig(showWithdrawModal) ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Este vault usa multisig ({showWithdrawModal.multisigThreshold} de {showWithdrawModal.signerCount} assinaturas).
            Saques precisam ser propostos e aprovados pelos signatários na página Multisig.
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Quantidade (SOL)"
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              step="0.001"
              min="0"
              hint={showWithdrawModal ? `Disponível: ${showWithdrawModal.balance.toFixed(4)} SOL` : undefined}
              error={
                parseFloat(withdrawAmount) > (showWithdrawModal?.balance ?? 0)
                  ? 'Valor maior que o saldo do vault'
                  : undefined
              }
            />
            <Input
              label="Carteira de destino"
              value={withdrawDestination}
              onChange={e => setWithdrawDestination(e.target.value)}
              placeholder="Endereço Solana"
              error={withdrawDestination && !parseDestination(withdrawDestination) ? 'Endereço inválido' : undefined}
            />
            <p className="text-xs text-gray-500">
              Sacar registra atividade no vault e reinicia a contagem do deadman switch.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
