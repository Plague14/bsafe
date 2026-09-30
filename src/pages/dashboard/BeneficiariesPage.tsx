import { useState, useEffect } from 'react';
import { Plus, Edit2, Users, ExternalLink, Copy, Check, RefreshCw, Wallet, AlertTriangle } from 'lucide-react';
import { Card, Button, Input, Modal } from '../../components/ui';
import { useProgram, type Vault, type Beneficiary } from '../../hooks/useProgram';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Link } from 'react-router-dom';

export function BeneficiariesPage() {
  const { publicKey } = useWallet();
  const { getVaults, getBeneficiaries, addBeneficiary, updateBeneficiaryShares, loading, error } = useProgram();

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Beneficiary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    walletAddress: '',
    sharePercent: 50,
  });

  const [editSharePercent, setEditSharePercent] = useState(0);

  // Fetch vaults on mount
  useEffect(() => {
    if (publicKey) {
      refreshVaults();
    }
  }, [publicKey]);

  // Fetch beneficiaries when vault is selected
  useEffect(() => {
    if (selectedVault) {
      refreshBeneficiaries();
    }
  }, [selectedVault]);

  const refreshVaults = async () => {
    setRefreshing(true);
    const fetchedVaults = await getVaults();
    setVaults(fetchedVaults);
    if (fetchedVaults.length > 0 && !selectedVault) {
      setSelectedVault(fetchedVaults[0]);
    }
    setRefreshing(false);
  };

  const refreshBeneficiaries = async () => {
    if (!selectedVault) return;
    setRefreshing(true);
    const fetchedBeneficiaries = await getBeneficiaries(selectedVault.address);
    setBeneficiaries(fetchedBeneficiaries);
    setRefreshing(false);
  };

  const handleAddBeneficiary = async () => {
    if (!selectedVault || !form.walletAddress) return;

    try {
      const beneficiaryWallet = new PublicKey(form.walletAddress);
      const result = await addBeneficiary(
        selectedVault.address,
        beneficiaryWallet,
        form.sharePercent
      );

      if (result) {
        setShowAddModal(false);
        setForm({ walletAddress: '', sharePercent: 50 });
        await refreshBeneficiaries();
        await refreshVaults();
      }
    } catch (err) {
      console.error('Invalid wallet address:', err);
    }
  };

  const handleEditBeneficiary = (beneficiary: Beneficiary) => {
    setShowEditModal(beneficiary);
    setEditSharePercent(beneficiary.sharePercent);
  };

  const handleUpdateShares = async () => {
    if (!selectedVault || !showEditModal) return;

    const result = await updateBeneficiaryShares(
      selectedVault.address,
      showEditModal.address,
      editSharePercent
    );

    if (result) {
      setShowEditModal(null);
      await refreshBeneficiaries();
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const activeBeneficiaries = beneficiaries.filter(b => b.status === 'active');
  const usedPercentage = activeBeneficiaries.reduce((sum, b) => sum + b.sharePercent, 0);
  const availablePercentage = 100 - usedPercentage;
  const isFullyAllocated = usedPercentage >= 100;

  // No vaults view
  if (vaults.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Herdeiros</h1>
            <p className="text-gray-500">Gerencie quem receberá seus ativos</p>
          </div>
        </div>

        <Card className="text-center py-12">
          <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum vault encontrado</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Você precisa criar um vault antes de adicionar beneficiários.
          </p>
          <Link to="/dashboard/assets">
            <Button icon={<Plus className="w-4 h-4" />}>
              Criar Vault
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Herdeiros</h1>
          <p className="text-gray-500">Gerencie quem receberá seus ativos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={refreshBeneficiaries}
            disabled={refreshing || !selectedVault}
            icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
          >
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            disabled={!selectedVault || isFullyAllocated}
            icon={<Plus className="w-4 h-4" />}
          >
            Adicionar
          </Button>
        </div>
      </div>

      {/* Vault Selector */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Vault selecionado</p>
            <div className="flex items-center gap-2">
              <select
                value={selectedVault?.address.toBase58() || ''}
                onChange={(e) => {
                  const vault = vaults.find(v => v.address.toBase58() === e.target.value);
                  setSelectedVault(vault || null);
                }}
                className="text-lg font-semibold text-gray-900 bg-transparent border-none focus:ring-0 cursor-pointer"
              >
                {vaults.map(vault => (
                  <option key={vault.address.toBase58()} value={vault.address.toBase58()}>
                    {vault.name || 'Vault'} ({vault.balance.toFixed(2)} SOL)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Percentual alocado</p>
            <p className={`text-2xl font-bold ${isFullyAllocated ? 'text-emerald-600' : 'text-gray-900'}`}>
              {usedPercentage.toFixed(1)}%
            </p>
          </div>
        </div>
      </Card>

      {/* Allocation Warning */}
      {!isFullyAllocated && activeBeneficiaries.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Alocação incompleta</p>
            <p className="text-sm text-yellow-700">
              Você tem {availablePercentage.toFixed(1)}% não alocado. Para garantir que 100% dos ativos
              sejam distribuídos, ajuste as porcentagens dos beneficiários.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-emerald-50 border-emerald-100">
          <p className="text-sm text-emerald-700">Total de herdeiros</p>
          <p className="text-2xl font-bold text-gray-900">{activeBeneficiaries.length}</p>
        </Card>
        <Card className={`${isFullyAllocated ? 'bg-emerald-50 border-emerald-100' : 'bg-yellow-50 border-yellow-100'}`}>
          <p className={`text-sm ${isFullyAllocated ? 'text-emerald-700' : 'text-yellow-700'}`}>
            {isFullyAllocated ? 'Totalmente alocado' : 'Disponível para alocar'}
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {isFullyAllocated ? '100%' : `${availablePercentage.toFixed(1)}%`}
          </p>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <p className="text-sm text-blue-700">Valor no vault</p>
          <p className="text-2xl font-bold text-gray-900">{selectedVault?.balance.toFixed(4) || 0} SOL</p>
        </Card>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Beneficiaries List */}
      {activeBeneficiaries.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Lista de Herdeiros</h2>
          {activeBeneficiaries.map(beneficiary => (
            <Card key={beneficiary.address.toBase58()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="font-medium text-gray-900">
                        {formatAddress(beneficiary.wallet.toBase58())}
                      </code>
                      <button
                        onClick={() => handleCopy(beneficiary.wallet.toBase58())}
                        className="p-0.5 hover:bg-gray-100 rounded"
                      >
                        {copied === beneficiary.wallet.toBase58() ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                      <a
                        href={`https://explorer.solana.com/address/${beneficiary.wallet.toBase58()}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-0.5 hover:bg-gray-100 rounded"
                      >
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </a>
                    </div>
                    <p className="text-sm text-gray-500">
                      Adicionado em {new Date(beneficiary.addedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">{beneficiary.sharePercent.toFixed(1)}%</p>
                    <p className="text-sm text-gray-500">
                      ≈ {((beneficiary.sharePercent / 100) * (selectedVault?.balance || 0)).toFixed(4)} SOL
                    </p>
                  </div>
                  <button
                    onClick={() => handleEditBeneficiary(beneficiary)}
                    className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {/* Distribution Preview */}
          <Card header={<span className="font-semibold text-gray-900">Previsão de Distribuição</span>}>
            <div className="space-y-3">
              {activeBeneficiaries.map(beneficiary => (
                <div key={beneficiary.address.toBase58()} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">
                        {formatAddress(beneficiary.wallet.toBase58())}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {beneficiary.sharePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${beneficiary.sharePercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-24 text-right">
                    {((beneficiary.sharePercent / 100) * (selectedVault?.balance || 0)).toFixed(4)} SOL
                  </span>
                </div>
              ))}
              {!isFullyAllocated && (
                <div className="flex items-center gap-3 opacity-50">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">Não alocado</span>
                      <span className="text-sm font-medium text-gray-400">
                        {availablePercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-300 rounded-full"
                        style={{ width: `${availablePercentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-400 w-24 text-right">
                    {((availablePercentage / 100) * (selectedVault?.balance || 0)).toFixed(4)} SOL
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <Card className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum herdeiro</h3>
          <p className="text-gray-500 mb-6">Adicione herdeiros para definir a divisão dos seus ativos</p>
          <Button onClick={() => setShowAddModal(true)} icon={<Plus className="w-4 h-4" />}>
            Adicionar primeiro herdeiro
          </Button>
        </Card>
      )}

      {/* Add Beneficiary Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setForm({ walletAddress: '', sharePercent: Math.min(50, availablePercentage) });
        }}
        title="Adicionar Herdeiro"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddBeneficiary}
              disabled={!form.walletAddress || form.sharePercent > availablePercentage || loading}
            >
              {loading ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Endereço da Carteira (Solana)"
            value={form.walletAddress}
            onChange={e => setForm({ ...form, walletAddress: e.target.value })}
            placeholder="Ex: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
            hint="Endereço Solana do beneficiário"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Percentual: {form.sharePercent}%
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.sharePercent}
              onChange={e => setForm({ ...form, sharePercent: Math.min(100, Math.max(1, Number(e.target.value))) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 mb-2"
            />
            <input
              type="range"
              min={1}
              max={100}
              value={form.sharePercent}
              onChange={e => setForm({ ...form, sharePercent: Number(e.target.value) })}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-xs mt-1">
              <span className="text-gray-500">1%</span>
              <span className={form.sharePercent > availablePercentage ? 'text-red-500 font-medium' : 'text-gray-500'}>
                Disponível: {availablePercentage.toFixed(1)}%
              </span>
            </div>
            {form.sharePercent > availablePercentage && (
              <p className="text-xs text-red-500 mt-1">
                Excede o disponível! Ajuste as porcentagens dos outros beneficiários primeiro.
              </p>
            )}
          </div>

          {selectedVault && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Resumo</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Vault</span>
                  <span>{selectedVault.name || 'Vault'}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Saldo atual</span>
                  <span>{selectedVault.balance.toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between text-gray-900 font-medium">
                  <span>Valor estimado para herdeiro</span>
                  <span>{((form.sharePercent / 100) * selectedVault.balance).toFixed(4)} SOL</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Beneficiary Modal */}
      <Modal
        isOpen={!!showEditModal}
        onClose={() => setShowEditModal(null)}
        title="Editar Porcentagem"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowEditModal(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateShares}
              disabled={loading || (!!showEditModal && (() => {
                const otherTotal = activeBeneficiaries
                  .filter(b => b.address.toBase58() !== showEditModal.address.toBase58())
                  .reduce((sum, b) => sum + b.sharePercent, 0);
                return otherTotal + editSharePercent > 100;
              })())}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        }
      >
        {showEditModal && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Beneficiário</p>
              <code className="font-medium text-gray-900">
                {formatAddress(showEditModal.wallet.toBase58())}
              </code>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nova Porcentagem: {editSharePercent}%
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={editSharePercent}
                onChange={e => setEditSharePercent(Math.min(100, Math.max(1, Number(e.target.value))))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 mb-2"
              />
              <input
                type="range"
                min={1}
                max={100}
                value={editSharePercent}
                onChange={e => setEditSharePercent(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              {(() => {
                const otherBeneficiariesTotal = activeBeneficiaries
                  .filter(b => b.address.toBase58() !== showEditModal.address.toBase58())
                  .reduce((sum, b) => sum + b.sharePercent, 0);
                const newTotal = otherBeneficiariesTotal + editSharePercent;
                const isValid = newTotal <= 100;
                return (
                  <>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-500">1%</span>
                      <span className={!isValid ? 'text-red-500 font-medium' : 'text-gray-500'}>
                        Total: {newTotal.toFixed(1)}%
                      </span>
                    </div>
                    {!isValid && (
                      <p className="text-xs text-red-500 mt-1">
                        A soma total excede 100%! Reduza a porcentagem.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700">Valor estimado</span>
                <span className="font-medium text-emerald-900">
                  {((editSharePercent / 100) * (selectedVault?.balance || 0)).toFixed(4)} SOL
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Nota: Certifique-se de que a soma de todos os beneficiários seja 100% para distribuição completa.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
