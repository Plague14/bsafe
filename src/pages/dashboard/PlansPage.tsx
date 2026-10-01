import { useState, useEffect } from 'react';
import { Plus, Clock, FileText, Users, AlertTriangle, Shield, Wallet, RefreshCw, Play, XCircle, CheckCircle, Timer, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, Modal } from '../../components/ui';
import { useProgram, type Vault, type InheritancePlan, type TriggerType, type Beneficiary, type Verifier } from '../../hooks/useProgram';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

export function PlansPage() {
  const { publicKey } = useWallet();
  const {
    getVaults,
    getInheritancePlan,
    createInheritancePlan,
    initiateInheritance,
    cancelInheritance,
    claimInheritance,
    getBeneficiaries,
    getVerifiers,
    addVerifier,
    resetInheritancePlan,
    loading,
    error
  } = useProgram();

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [inheritancePlan, setInheritancePlan] = useState<InheritancePlan | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [verifiers, setVerifiers] = useState<Verifier[]>([]);
  const [showVerifierModal, setShowVerifierModal] = useState(false);
  const [verifierAddress, setVerifierAddress] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState({
    triggerType: 'both' as TriggerType,
    cooldownDays: 30,
    deadmanSwitchDays: 365,
    requiredVerifications: 2,
  });

  // Fetch vaults on mount
  useEffect(() => {
    if (publicKey) {
      refreshVaults();
    }
  }, [publicKey]);

  // Fetch inheritance plan and beneficiaries when vault is selected
  useEffect(() => {
    if (selectedVault) {
      refreshInheritancePlan();
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

  const refreshInheritancePlan = async () => {
    if (!selectedVault) return;
    setRefreshing(true);
    const plan = await getInheritancePlan(selectedVault.address);
    setInheritancePlan(plan);
    setVerifiers(plan ? await getVerifiers(selectedVault.address) : []);
    setRefreshing(false);
  };

  const parsedVerifier = (() => {
    try {
      return new PublicKey(verifierAddress.trim());
    } catch {
      return null;
    }
  })();

  const handleAddVerifier = async () => {
    if (!selectedVault || !parsedVerifier) return;
    const sig = await addVerifier(selectedVault.address, parsedVerifier);
    if (sig) {
      setShowVerifierModal(false);
      setVerifierAddress('');
      await refreshInheritancePlan();
    }
  };

  const refreshBeneficiaries = async () => {
    if (!selectedVault) return;
    const bens = await getBeneficiaries(selectedVault.address);
    setBeneficiaries(bens.filter(b => b.status === 'active'));
  };

  const handleCreatePlan = async () => {
    if (!selectedVault) return;

    const result = await createInheritancePlan(
      selectedVault.address,
      form.triggerType,
      form.cooldownDays,
      form.deadmanSwitchDays,
      form.requiredVerifications
    );

    if (result) {
      setShowCreateModal(false);
      await refreshInheritancePlan();
    }
  };

  const handleInitiateInheritance = async () => {
    if (!selectedVault) return;

    const result = await initiateInheritance(selectedVault.address);

    if (result) {
      setShowInitiateModal(false);
      await refreshInheritancePlan();
      await refreshVaults();
    }
  };

  const handleCancelInheritance = async () => {
    if (!selectedVault) return;

    const result = await cancelInheritance(selectedVault.address);

    if (result) {
      await refreshInheritancePlan();
      await refreshVaults();
    }
  };

  const handleResetPlan = async () => {
    if (!selectedVault) return;
    if (await resetInheritancePlan(selectedVault.address)) {
      await refreshInheritancePlan();
    }
  };

  const handleClaimInheritance = async () => {
    if (!selectedVault || !publicKey) return;

    const result = await claimInheritance(selectedVault.address, publicKey, selectedVault.owner);

    if (result) {
      setShowClaimModal(false);
      await refreshInheritancePlan();
      await refreshBeneficiaries();
      await refreshVaults();
    }
  };

  const formatDays = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    if (days >= 365) {
      const years = Math.floor(days / 365);
      return `${years} ano${years > 1 ? 's' : ''}`;
    }
    return `${days} dia${days > 1 ? 's' : ''}`;
  };

  const formatTimeRemaining = (endTimestamp: number) => {
    const now = Date.now();
    const diff = endTimestamp - now;
    if (diff <= 0) return 'Expirado';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h restantes`;
    return `${hours}h restantes`;
  };

  const getTriggerTypeLabel = (type: TriggerType) => {
    switch (type) {
      case 'deathCertificate': return 'Certidão de Óbito';
      case 'deadmanSwitch': return 'Deadman Switch';
      case 'both': return 'Híbrido (Ambos)';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'configured': return 'Configurado';
      case 'proofSubmitted': return 'Prova Submetida';
      case 'cooldownActive': return 'Cooldown Ativo';
      case 'claimReady': return 'Pronto para Claim';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'configured': return 'bg-blue-100 text-blue-700';
      case 'proofSubmitted': return 'bg-yellow-100 text-yellow-700';
      case 'cooldownActive': return 'bg-orange-100 text-orange-700';
      case 'claimReady': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Check if current user is a beneficiary
  const userBeneficiary = beneficiaries.find(
    b => publicKey && b.wallet.toBase58() === publicKey.toBase58()
  );

  // Validations for creating inheritance plan
  const totalBeneficiaryPercent = beneficiaries.reduce((sum, b) => sum + b.sharePercent, 0);
  const hasBeneficiaries = beneficiaries.length > 0;
  const isFullyAllocated = Math.abs(totalBeneficiaryPercent - 100) < 0.1; // Allow small rounding errors
  const canCreatePlan = hasBeneficiaries && isFullyAllocated;

  const canClaim = inheritancePlan &&
    (inheritancePlan.status === 'claimReady' ||
      (inheritancePlan.status === 'cooldownActive' && inheritancePlan.cooldownEndsAt <= Date.now())) &&
    userBeneficiary;

  const canCancel = inheritancePlan &&
    inheritancePlan.status === 'cooldownActive' &&
    inheritancePlan.cooldownEndsAt > Date.now() &&
    selectedVault?.owner.toBase58() === publicKey?.toBase58();

  // No vaults view
  if (vaults.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plano de Herança</h1>
            <p className="text-gray-500">Configure como seus ativos serão transferidos</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button size="sm" variant="secondary" onClick={refreshVaults}>Tentar de novo</Button>
          </div>
        )}

        <Card className="text-center py-12">
          <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum vault encontrado</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Você precisa criar um vault antes de configurar um plano de herança.
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
          <h1 className="text-2xl font-bold text-gray-900">Plano de Herança</h1>
          <p className="text-gray-500">Configure como seus ativos serão transferidos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { refreshInheritancePlan(); refreshBeneficiaries(); }}
            disabled={refreshing || !selectedVault}
            icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
          >
            Atualizar
          </Button>
          {!inheritancePlan && (
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedVault}
              icon={<Plus className="w-4 h-4" />}
            >
              Criar Plano
            </Button>
          )}
        </div>
      </div>

      {/* Vault Selector */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Vault selecionado</p>
            <select
              value={selectedVault?.address.toBase58() || ''}
              onChange={(e) => {
                const vault = vaults.find(v => v.address.toBase58() === e.target.value);
                setSelectedVault(vault || null);
                setInheritancePlan(null);
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
          <div className="text-right">
            <p className="text-sm text-gray-500">Beneficiários</p>
            <p className="text-2xl font-bold text-gray-900">{beneficiaries.length}</p>
          </div>
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Inheritance Plan Details */}
      {inheritancePlan ? (
        <div className="space-y-6">
          {/* Status Card */}
          <Card className={`border-0 ${
            inheritancePlan.status === 'cooldownActive'
              ? 'bg-gradient-to-br from-orange-500 to-orange-700 text-white'
              : inheritancePlan.status === 'claimReady'
              ? 'bg-gradient-to-br from-primary-500 to-primary-700 text-white'
              : 'bg-gradient-to-br from-blue-600 to-blue-800 text-white'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm mb-1">Status do Plano</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    inheritancePlan.status === 'cooldownActive'
                      ? 'bg-white/20 text-white'
                      : getStatusColor(inheritancePlan.status)
                  }`}>
                    {getStatusLabel(inheritancePlan.status)}
                  </span>
                </div>
                {inheritancePlan.status === 'cooldownActive' && (
                  <div className="flex items-center gap-2 text-white/90">
                    <Timer className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {formatTimeRemaining(inheritancePlan.cooldownEndsAt)}
                    </span>
                  </div>
                )}
              </div>
              <Shield className="w-12 h-12 text-white/30" />
            </div>

            {/* Action Buttons */}
            <div className="mt-4 pt-4 border-t border-white/20 flex gap-3">
              {inheritancePlan.status === 'configured' && (
                <Button
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 border-0 text-white"
                  onClick={() => setShowInitiateModal(true)}
                  icon={<Play className="w-4 h-4" />}
                >
                  Iniciar Herança (Teste)
                </Button>
              )}
              {canCancel && (
                <Button
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 border-0 text-white"
                  onClick={handleCancelInheritance}
                  disabled={loading}
                  icon={<XCircle className="w-4 h-4" />}
                >
                  {loading ? 'Cancelando...' : 'Provar Vida (Cancelar)'}
                </Button>
              )}
              {inheritancePlan.status === 'cancelled' && selectedVault?.owner.toBase58() === publicKey?.toBase58() && (
                <Button
                  size="sm"
                  onClick={handleResetPlan}
                  disabled={loading}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  {loading ? 'Reativando...' : 'Reativar plano'}
                </Button>
              )}
              {canClaim && (
                <Button
                  size="sm"
                  className="bg-white text-primary-700 hover:bg-white/90 border-0"
                  onClick={() => setShowClaimModal(true)}
                  icon={<CheckCircle className="w-4 h-4" />}
                >
                  Clamar Herança
                </Button>
              )}
            </div>
          </Card>

          {/* Cooldown Warning */}
          {inheritancePlan.status === 'cooldownActive' && selectedVault?.owner.toBase58() === publicKey?.toBase58() && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Herança Iniciada!</p>
                <p className="text-sm text-orange-700">
                  A herança foi ativada. Você tem até {new Date(inheritancePlan.cooldownEndsAt).toLocaleDateString('pt-BR')} para
                  cancelar clicando em "Provar Vida". Após esse período, os beneficiários poderão clamar seus fundos.
                </p>
              </div>
            </div>
          )}

          {/* Claim Ready Notice */}
          {(inheritancePlan.status === 'claimReady' ||
            (inheritancePlan.status === 'cooldownActive' && inheritancePlan.cooldownEndsAt <= Date.now())) && userBeneficiary && (
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary-800">Você pode clamar sua herança!</p>
                <p className="text-sm text-primary-700">
                  Sua parte é de {userBeneficiary.sharePercent.toFixed(1)}%
                  (≈ {((userBeneficiary.sharePercent / 100) * inheritancePlan.distributionAmount).toFixed(4)} SOL).
                  Clique em "Clamar Herança" para receber seus fundos.
                </p>
              </div>
            </div>
          )}

          {/* Configuration Details */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-start gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tipo de Trigger</p>
                  <p className="font-semibold text-gray-900">{getTriggerTypeLabel(inheritancePlan.triggerType)}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <Clock className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Período de Cooldown</p>
                  <p className="font-semibold text-gray-900">{formatDays(inheritancePlan.cooldownSeconds)}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Deadman Switch</p>
                  <p className="font-semibold text-gray-900">{formatDays(inheritancePlan.deadmanSwitchSeconds)}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <Users className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Verificações Necessárias</p>
                  <p className="font-semibold text-gray-900">
                    {inheritancePlan.currentVerifications}/{inheritancePlan.requiredVerifications}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Verifiers (death certificate trigger) */}
          {inheritancePlan.triggerType !== 'deadmanSwitch' && (
            <Card
              header={
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Verificadores da certidão</span>
                  {inheritancePlan.status === 'configured' && (
                    <Button size="sm" onClick={() => setShowVerifierModal(true)} icon={<Plus className="w-4 h-4" />}>
                      Adicionar
                    </Button>
                  )}
                </div>
              }
            >
              {verifiers.length < inheritancePlan.requiredVerifications && (
                <p className="mb-3 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                  O plano exige {inheritancePlan.requiredVerifications} verificação(ões), mas há {verifiers.length} verificador(es).
                  Sem verificadores suficientes a certidão nunca poderá ser confirmada.
                </p>
              )}
              {verifiers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Verificadores (advogado, cartório, familiar de confiança) confirmam a certidão de óbito enviada por um herdeiro.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {verifiers.map(v => (
                    <li key={v.address.toBase58()} className="py-3 flex items-center justify-between text-sm">
                      <code className="text-gray-700">
                        {v.verifier.toBase58().slice(0, 6)}...{v.verifier.toBase58().slice(-6)}
                      </code>
                      {v.hasVerified ? (
                        <span className="flex items-center gap-1 text-green-700">
                          <ShieldCheck className="w-4 h-4" /> Verificou
                        </span>
                      ) : (
                        <span className="text-gray-400">Aguardando</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Distribution Preview */}
          {inheritancePlan.distributionAmount > 0 && (
            <Card header={<span className="font-semibold text-gray-900">Valor a Distribuir</span>}>
              <div className="text-center py-4">
                <p className="text-4xl font-bold text-gray-900">{inheritancePlan.distributionAmount.toFixed(4)} SOL</p>
                <p className="text-gray-500">Valor capturado no momento do trigger</p>
              </div>
            </Card>
          )}

          {/* How it works */}
          <Card header={<span className="font-semibold text-gray-900">Como funciona?</span>}>
            <div className="space-y-4">
              {inheritancePlan.triggerType !== 'deathCertificate' && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">1</div>
                  <div>
                    <p className="font-medium text-gray-900">Deadman Switch</p>
                    <p className="text-sm text-gray-500">
                      Se você não interagir com o vault por {formatDays(inheritancePlan.deadmanSwitchSeconds)},
                      a herança será iniciada automaticamente.
                    </p>
                  </div>
                </div>
              )}
              {inheritancePlan.triggerType !== 'deadmanSwitch' && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {inheritancePlan.triggerType === 'deathCertificate' ? '1' : '2'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Certidão de Óbito</p>
                    <p className="text-sm text-gray-500">
                      Um beneficiário pode submeter uma certidão de óbito que será verificada por {inheritancePlan.requiredVerifications} verificador(es).
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm">
                  {inheritancePlan.triggerType === 'both' ? '3' : '2'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">Período de Cooldown</p>
                  <p className="text-sm text-gray-500">
                    Após a ativação, você tem {formatDays(inheritancePlan.cooldownSeconds)} para cancelar (provar que está vivo).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm">
                  {inheritancePlan.triggerType === 'both' ? '4' : '3'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">Distribuição</p>
                  <p className="text-sm text-gray-500">
                    Após o cooldown, os beneficiários podem clamar suas partes conforme definido.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Validation checklist */}
          <Card header={<span className="font-semibold text-gray-900">Requisitos para criar plano</span>}>
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-3 rounded-lg ${hasBeneficiaries ? 'bg-green-50' : 'bg-red-50'}`}>
                {hasBeneficiaries ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <p className={`font-medium ${hasBeneficiaries ? 'text-green-900' : 'text-red-900'}`}>
                    Beneficiários cadastrados
                  </p>
                  <p className={`text-sm ${hasBeneficiaries ? 'text-green-700' : 'text-red-700'}`}>
                    {hasBeneficiaries
                      ? `${beneficiaries.length} beneficiário(s) adicionado(s)`
                      : 'Adicione pelo menos 1 beneficiário'}
                  </p>
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-lg ${isFullyAllocated ? 'bg-green-50' : 'bg-red-50'}`}>
                {isFullyAllocated ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <p className={`font-medium ${isFullyAllocated ? 'text-green-900' : 'text-red-900'}`}>
                    Alocação completa (100%)
                  </p>
                  <p className={`text-sm ${isFullyAllocated ? 'text-green-700' : 'text-red-700'}`}>
                    {isFullyAllocated
                      ? 'Soma das porcentagens = 100%'
                      : `Atual: ${totalBeneficiaryPercent.toFixed(1)}% (faltam ${(100 - totalBeneficiaryPercent).toFixed(1)}%)`}
                  </p>
                </div>
              </div>
            </div>

            {!canCreatePlan && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link to="/dashboard/beneficiaries">
                  <Button variant="secondary" size="sm" icon={<Users className="w-4 h-4" />}>
                    Configurar Beneficiários
                  </Button>
                </Link>
              </div>
            )}
          </Card>

          <Card className="text-center py-12">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum plano de herança</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Configure um plano de herança para definir como seus ativos serão transferidos automaticamente.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              icon={<Plus className="w-4 h-4" />}
              disabled={!canCreatePlan}
            >
              Criar Plano de Herança
            </Button>
            {!canCreatePlan && (
              <p className="text-sm text-gray-500 mt-2">
                Complete os requisitos acima para criar o plano
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Create Plan Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Criar Plano de Herança"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePlan} disabled={loading}>
              {loading ? 'Criando...' : 'Criar Plano'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tipo de Trigger
            </label>
            <select
              value={form.triggerType}
              onChange={(e) => setForm({ ...form, triggerType: e.target.value as TriggerType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="both">Híbrido (Recomendado)</option>
              <option value="deadmanSwitch">Apenas Deadman Switch</option>
              <option value="deathCertificate">Apenas Certidão de Óbito</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Híbrido permite ativação por inatividade OU certidão de óbito.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Período de Cooldown: {form.cooldownDays} dias
            </label>
            <input
              type="range"
              min={1}
              max={365}
              value={form.cooldownDays}
              onChange={(e) => setForm({ ...form, cooldownDays: Number(e.target.value) })}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1 dia</span>
              <span>365 dias</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tempo que você tem para cancelar a herança após ser ativada.
            </p>
          </div>

          {form.triggerType !== 'deathCertificate' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Deadman Switch: {form.deadmanSwitchDays} dias
              </label>
              <input
                type="range"
                min={30}
                max={1825}
                value={form.deadmanSwitchDays}
                onChange={(e) => setForm({ ...form, deadmanSwitchDays: Number(e.target.value) })}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>30 dias</span>
                <span>5 anos</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Período de inatividade que ativa a herança automaticamente.
              </p>
            </div>
          )}

          {form.triggerType !== 'deadmanSwitch' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Verificações necessárias: {form.requiredVerifications}
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={form.requiredVerifications}
                onChange={(e) => setForm({ ...form, requiredVerifications: Number(e.target.value) })}
                className="w-full accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1</span>
                <span>10</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Número de verificadores que precisam confirmar a certidão de óbito.
              </p>
            </div>
          )}

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-700">
                <p className="font-medium">Importante</p>
                <p>
                  Os herdeiros precisam somar 100% antes de criar o plano. Se o gatilho usar certidão de óbito,
                  adicione os verificadores logo depois de criar o plano.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Initiate Inheritance Modal (for testing) */}
      <Modal
        isOpen={showInitiateModal}
        onClose={() => setShowInitiateModal(false)}
        title="Iniciar Herança (Teste)"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowInitiateModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleInitiateInheritance}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? 'Iniciando...' : 'Confirmar Início'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-700">
                <p className="font-medium">Atenção: Modo de Teste</p>
                <p>
                  Esta ação simula o trigger da herança para fins de teste.
                  Em produção, isso seria ativado pelo deadman switch ou certidão de óbito.
                </p>
              </div>
            </div>
          </div>

          <p className="text-gray-600">
            Ao confirmar, a herança será iniciada e você terá{' '}
            <strong>{formatDays(inheritancePlan?.cooldownSeconds || 0)}</strong> para cancelar
            (provar que está vivo).
          </p>

          <p className="text-gray-600">
            Após o período de cooldown, os beneficiários poderão clamar seus fundos:
          </p>

          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            {beneficiaries.map(b => (
              <div key={b.address.toBase58()} className="flex justify-between text-sm">
                <span className="text-gray-600">{b.wallet.toBase58().slice(0, 8)}...</span>
                <span className="font-medium">{b.sharePercent.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Claim Inheritance Modal */}
      <Modal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        title="Clamar Herança"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowClaimModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleClaimInheritance} disabled={loading}>
              {loading ? 'Clamando...' : 'Confirmar Claim'}
            </Button>
          </div>
        }
      >
        {userBeneficiary && inheritancePlan && (
          <div className="space-y-4">
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg text-center">
              <p className="text-sm text-primary-700 mb-1">Valor a receber</p>
              <p className="text-3xl font-bold text-primary-700">
                {((userBeneficiary.sharePercent / 100) * inheritancePlan.distributionAmount).toFixed(4)} SOL
              </p>
              <p className="text-sm text-primary-600 mt-1">
                ({userBeneficiary.sharePercent.toFixed(1)}% de {inheritancePlan.distributionAmount.toFixed(4)} SOL)
              </p>
            </div>

            <p className="text-gray-600 text-sm">
              Ao confirmar, os fundos serão transferidos diretamente para sua carteira conectada.
            </p>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Sua carteira</p>
              <code className="text-sm font-medium text-gray-900">
                {publicKey?.toBase58()}
              </code>
            </div>
          </div>
        )}
      </Modal>
      {/* Add Verifier Modal */}
      <Modal
        isOpen={showVerifierModal}
        onClose={() => setShowVerifierModal(false)}
        title="Adicionar verificador"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowVerifierModal(false)}>Cancelar</Button>
            <Button onClick={handleAddVerifier} disabled={loading || !parsedVerifier}>
              {loading ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Carteira do verificador"
            value={verifierAddress}
            onChange={e => setVerifierAddress(e.target.value)}
            placeholder="Endereço Solana"
            error={verifierAddress && !parsedVerifier ? 'Endereço inválido' : undefined}
          />
          <p className="text-xs text-gray-500">
            O verificador vê a certidão pendente em "Minhas Heranças" e confirma on-chain.
          </p>
        </div>
      </Modal>
    </div>
  );
}
