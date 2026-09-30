import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Plus, RefreshCw, Wallet, Trash2, Check, X, Play, ArrowUpRight, ExternalLink } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Card, Button, Input, Modal } from '../../components/ui';
import {
  useProgram,
  type Vault,
  type MultisigSigner,
  type MultisigTransaction,
} from '../../hooks/useProgram';

const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-6)}`;

function parseKey(value: string): PublicKey | null {
  try {
    return new PublicKey(value.trim());
  } catch {
    return null;
  }
}

const statusLabel: Record<MultisigTransaction['status'], { text: string; className: string }> = {
  pending: { text: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  approved: { text: 'Aprovada', className: 'bg-emerald-100 text-emerald-700' },
  executed: { text: 'Executada', className: 'bg-gray-100 text-gray-600' },
  cancelled: { text: 'Rejeitada', className: 'bg-red-100 text-red-700' },
};

export function MultisigPage() {
  const { publicKey } = useWallet();
  const {
    getVaults,
    getSignerVaults,
    getSigners,
    getMultisigTransactions,
    addSigner,
    removeSigner,
    updateThreshold,
    proposeWithdrawal,
    approveTransaction,
    rejectTransaction,
    executeTransaction,
    loading,
    error,
  } = useProgram();

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selected, setSelected] = useState<Vault | null>(null);
  const [signers, setSigners] = useState<MultisigSigner[]>([]);
  const [transactions, setTransactions] = useState<MultisigTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showAddSigner, setShowAddSigner] = useState(false);
  const [newSigner, setNewSigner] = useState('');
  const [showPropose, setShowPropose] = useState(false);
  const [proposeAmount, setProposeAmount] = useState('');
  const [proposeDestination, setProposeDestination] = useState('');

  const loadVaultDetails = useCallback(async (vault: Vault) => {
    const [s, t] = await Promise.all([getSigners(vault.address), getMultisigTransactions(vault.address)]);
    setSigners(s);
    setTransactions(t);
  }, [getSigners, getMultisigTransactions]);

  const refresh = useCallback(async (keepSelected?: PublicKey) => {
    setRefreshing(true);
    const [owned, cosigned] = await Promise.all([getVaults(), getSignerVaults()]);
    const all = [...owned];
    for (const v of cosigned) {
      if (!all.some(o => o.address.equals(v.address))) all.push(v);
    }
    setVaults(all);
    const next = all.find(v => keepSelected && v.address.equals(keepSelected)) ?? all[0] ?? null;
    setSelected(next);
    if (next) await loadVaultDetails(next);
    setRefreshing(false);
  }, [getVaults, getSignerVaults, loadVaultDetails]);

  useEffect(() => {
    if (publicKey) refresh();
  }, [publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectVault = async (vault: Vault) => {
    setSelected(vault);
    await loadVaultDetails(vault);
  };

  const isOwner = !!(publicKey && selected?.owner.equals(publicKey));
  const mySigner = signers.find(s => publicKey && s.signer.equals(publicKey) && s.isActive);

  const afterAction = async (signature: string | null) => {
    if (signature && selected) await refresh(selected.address);
    return !!signature;
  };

  const handleAddSigner = async () => {
    const key = parseKey(newSigner);
    if (!selected || !key) return;
    if (await afterAction(await addSigner(selected.address, key))) {
      setShowAddSigner(false);
      setNewSigner('');
    }
  };

  const handlePropose = async () => {
    const destination = parseKey(proposeDestination);
    const amount = parseFloat(proposeAmount);
    if (!selected || !destination || !(amount > 0)) return;
    if (await afterAction(await proposeWithdrawal(selected, amount, destination))) {
      setShowPropose(false);
    }
  };

  const openPropose = () => {
    setProposeAmount('');
    setProposeDestination(publicKey?.toBase58() ?? '');
    setShowPropose(true);
  };

  const hasApproved = (tx: MultisigTransaction) =>
    !!mySigner && (tx.approvals & (1n << BigInt(mySigner.index))) !== 0n;

  if (!publicKey) {
    return (
      <Card className="text-center py-12">
        <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">Conecte sua carteira</h3>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Multisig</h1>
          <p className="text-gray-500">Saques que exigem várias assinaturas</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => refresh(selected?.address)}
          disabled={refreshing}
          icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
        >
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {vaults.length === 0 ? (
        <Card className="text-center py-12">
          <KeyRound className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum vault encontrado</h3>
          <p className="text-gray-500">Crie um vault em Ativos ou peça para ser adicionado como signatário.</p>
        </Card>
      ) : (
        <>
          {/* Vault selector */}
          <div className="flex flex-wrap gap-2">
            {vaults.map(v => (
              <button
                key={v.address.toBase58()}
                onClick={() => selectVault(v)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  selected?.address.equals(v.address)
                    ? 'bg-primary-50 border-primary-600 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v.name || 'Vault'} · {v.balance.toFixed(3)} SOL
                {publicKey && !v.owner.equals(publicKey) && <span className="ml-1 text-xs text-gray-400">(co-signatário)</span>}
              </button>
            ))}
          </div>

          {selected && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Signers & threshold */}
              <Card
                header={
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Signatários</span>
                    {isOwner && (
                      <Button size="sm" onClick={() => setShowAddSigner(true)} icon={<Plus className="w-4 h-4" />}>
                        Adicionar
                      </Button>
                    )}
                  </div>
                }
              >
                <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between text-sm">
                  <span className="text-gray-600">Assinaturas exigidas</span>
                  {selected.multisigEnabled ? (
                    <span className="font-semibold text-gray-900">
                      {selected.multisigThreshold} de {selected.signerCount}
                    </span>
                  ) : (
                    <span className="text-gray-500">Multisig desativado</span>
                  )}
                </div>

                {signers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum signatário. Adicione você mesmo e pelo menos mais uma carteira para ativar o multisig.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {signers.map(s => (
                      <li key={s.address.toBase58()} className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold flex items-center justify-center">
                            {s.index + 1}
                          </span>
                          <code className="text-sm text-gray-700">{formatAddress(s.signer.toBase58())}</code>
                          {publicKey && s.signer.equals(publicKey) && (
                            <span className="text-xs text-primary-600 font-medium">você</span>
                          )}
                          {selected.owner.equals(s.signer) && (
                            <span className="text-xs text-gray-400">dono</span>
                          )}
                        </div>
                        {isOwner && (
                          <button
                            onClick={async () => afterAction(await removeSigner(selected.address, s.signer))}
                            disabled={loading}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="Remover signatário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {isOwner && selected.signerCount > 1 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Alterar assinaturas exigidas</label>
                    <div className="flex gap-2">
                      {Array.from({ length: selected.signerCount }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          onClick={async () => afterAction(await updateThreshold(selected.address, n))}
                          disabled={loading || n === selected.multisigThreshold}
                          className={`w-10 h-10 rounded-lg text-sm font-semibold border ${
                            n === selected.multisigThreshold
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isOwner && !mySigner && signers.length > 0 && (
                  <p className="mt-4 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
                    Você é o dono, mas não é signatário: adicione sua própria carteira para poder propor e aprovar saques.
                  </p>
                )}
              </Card>

              {/* Proposals */}
              <Card
                header={
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Propostas de saque</span>
                    {mySigner && selected.multisigEnabled && selected.status === 'active' && (
                      <Button size="sm" onClick={openPropose} icon={<ArrowUpRight className="w-4 h-4" />}>
                        Propor saque
                      </Button>
                    )}
                  </div>
                }
              >
                {transactions.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma proposta ainda.</p>
                ) : (
                  <ul className="space-y-3">
                    {transactions.map(tx => {
                      const label = statusLabel[tx.status];
                      return (
                        <li key={tx.address.toBase58()} className="p-4 border border-gray-100 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-900">{tx.amount.toFixed(4)} SOL</span>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${label.className}`}>
                              {label.text}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1 mb-3">
                            <div className="flex items-center gap-1">
                              Para <code>{formatAddress(tx.destination.toBase58())}</code>
                              <a
                                href={`https://explorer.solana.com/address/${tx.destination.toBase58()}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div>
                              Proposta por <code>{formatAddress(tx.proposer.toBase58())}</code> em{' '}
                              {new Date(tx.proposedAt).toLocaleString('pt-BR')}
                            </div>
                            <div className="font-medium text-gray-700">
                              Aprovações: {tx.approvalCount} de {tx.threshold}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {tx.status === 'pending' && mySigner && !hasApproved(tx) && (
                              <Button
                                size="sm"
                                disabled={loading}
                                onClick={async () => afterAction(await approveTransaction(selected.address, tx.address))}
                                icon={<Check className="w-4 h-4" />}
                              >
                                Aprovar
                              </Button>
                            )}
                            {tx.status === 'pending' && hasApproved(tx) && (
                              <span className="text-xs text-gray-500 self-center">Você já aprovou</span>
                            )}
                            {tx.status === 'approved' && mySigner && (
                              <Button
                                size="sm"
                                disabled={loading}
                                onClick={async () => afterAction(await executeTransaction(selected.address, tx))}
                                icon={<Play className="w-4 h-4" />}
                              >
                                Executar
                              </Button>
                            )}
                            {tx.status === 'pending' && isOwner && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={loading}
                                onClick={async () => afterAction(await rejectTransaction(selected.address, tx.address))}
                                icon={<X className="w-4 h-4" />}
                              >
                                Rejeitar
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {/* Add signer modal */}
      <Modal
        isOpen={showAddSigner}
        onClose={() => setShowAddSigner(false)}
        title="Adicionar signatário"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowAddSigner(false)}>Cancelar</Button>
            <Button onClick={handleAddSigner} disabled={loading || !parseKey(newSigner)}>
              {loading ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Carteira do signatário"
            value={newSigner}
            onChange={e => setNewSigner(e.target.value)}
            placeholder="Endereço Solana"
            error={newSigner && !parseKey(newSigner) ? 'Endereço inválido' : undefined}
          />
          {publicKey && !mySigner && (
            <button
              type="button"
              onClick={() => setNewSigner(publicKey.toBase58())}
              className="text-sm text-primary-600 hover:underline"
            >
              Usar minha carteira
            </button>
          )}
          <p className="text-xs text-gray-500">
            Com 2 ou mais signatários o multisig é ativado exigindo 2 assinaturas; saques diretos passam a ser bloqueados.
          </p>
        </div>
      </Modal>

      {/* Propose modal */}
      <Modal
        isOpen={showPropose}
        onClose={() => setShowPropose(false)}
        title="Propor saque"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowPropose(false)}>Cancelar</Button>
            <Button
              onClick={handlePropose}
              disabled={
                loading ||
                !(parseFloat(proposeAmount) > 0) ||
                parseFloat(proposeAmount) > (selected?.balance ?? 0) ||
                !parseKey(proposeDestination)
              }
            >
              {loading ? 'Enviando...' : 'Propor'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Quantidade (SOL)"
            type="number"
            value={proposeAmount}
            onChange={e => setProposeAmount(e.target.value)}
            placeholder="0.00"
            step="0.001"
            min="0"
            hint={selected ? `Disponível: ${selected.balance.toFixed(4)} SOL` : undefined}
          />
          <Input
            label="Carteira de destino"
            value={proposeDestination}
            onChange={e => setProposeDestination(e.target.value)}
            placeholder="Endereço Solana"
            error={proposeDestination && !parseKey(proposeDestination) ? 'Endereço inválido' : undefined}
          />
          <p className="text-xs text-gray-500">
            Sua aprovação conta automaticamente. Os demais signatários aprovam nesta mesma página.
          </p>
        </div>
      </Modal>
    </div>
  );
}
