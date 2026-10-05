import { useState, useEffect, useCallback } from 'react';
import {
  Gift, RefreshCw, Wallet, FileText, ShieldCheck, Play, Download, Timer, CheckCircle, XCircle, Upload,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, Button } from '../../components/ui';
import { useProgram, type InheritanceView, type TriggerType } from '../../hooks/useProgram';
import { useI18n, type MessageKey } from '../../i18n';

const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-6)}`;

const CLAIM_FEE_FREE_TIER = 0.01; // 1% protocol fee (Free tier)

async function hashFile(file: File): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return new Uint8Array(digest);
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

function formatRemaining(ms: number, nowLabel: string, underMinuteLabel: string): string {
  if (ms <= 0) return nowLabel;
  if (ms < 60_000) return underMinuteLabel;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

const usesCertificate = (t: TriggerType) => t === 'deathCertificate' || t === 'both';
const usesDeadman = (t: TriggerType) => t === 'deadmanSwitch' || t === 'both';

const STEPS: MessageKey[] = ['inheritances.stepConfigured', 'inheritances.stepTrigger', 'inheritances.stepCooldown', 'inheritances.stepClaim'];

function stepIndex(view: InheritanceView): number {
  switch (view.plan?.status) {
    case 'proofSubmitted':
      return 1;
    case 'cooldownActive':
      return 2;
    case 'claimReady':
    case 'completed':
      return 3;
    default:
      return 0;
  }
}

export function InheritancesPage() {
  const { publicKey } = useWallet();
  const {
    getMyInheritances,
    submitDeathCertificate,
    verifyDeathCertificate,
    initiateInheritance,
    claimInheritance,
    loading,
    error,
  } = useProgram();
  const { t } = useI18n();

  const [views, setViews] = useState<InheritanceView[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [checkedHash, setCheckedHash] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setNow(Date.now());
    setViews(await getMyInheritances());
    setRefreshing(false);
  }, [getMyInheritances]);

  useEffect(() => {
    if (publicKey) refresh();
  }, [publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every 5s so countdowns (minutes on the devnet demo build) stay current
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  const run = async (action: Promise<string | null>) => {
    if (await action) await refresh();
  };

  const handleSubmitCertificate = async (view: InheritanceView, file: File | undefined) => {
    if (!file) return;
    await run(submitDeathCertificate(view.vault.address, await hashFile(file)));
  };

  const handleCompareFile = async (view: InheritanceView, file: File | undefined) => {
    if (!file) return;
    const hex = toHex(await hashFile(file));
    setCheckedHash(prev => ({ ...prev, [view.vault.address.toBase58()]: hex }));
  };

  if (!publicKey) {
    return (
      <Card className="text-center py-12">
        <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">{t('common.connectWallet')}</h3>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.inheritances')}</h1>
          <p className="text-gray-500">{t('inheritances.subtitle')}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={refresh}
          disabled={refreshing}
          icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
        >
          {t('common.refresh')}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {views.length === 0 && !refreshing ? (
        <Card className="text-center py-12">
          <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('inheritances.emptyTitle')}</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {t('inheritances.emptyBody')}
          </p>
        </Card>
      ) : (
        views.map(view => {
          const { vault, plan, proof, beneficiary, verifier } = view;
          const key = vault.address.toBase58();
          const deadmanAt = plan ? vault.lastActivity + plan.deadmanSwitchSeconds * 1000 : 0;
          const deadmanReached = !!plan && usesDeadman(plan.triggerType) && now >= deadmanAt;
          const canTrigger =
            !!plan &&
            (plan.status === 'configured' || plan.status === 'proofSubmitted') &&
            (deadmanReached || !!proof?.verified);
          const cooldownOver = !!plan && plan.cooldownEndsAt > 0 && now >= plan.cooldownEndsAt;
          const canClaim =
            !!beneficiary &&
            beneficiary.status === 'active' &&
            !!plan &&
            (plan.status === 'cooldownActive' || plan.status === 'claimReady') &&
            cooldownOver;
          const gross = plan && beneficiary ? plan.distributionAmount * beneficiary.sharePercent / 100 : 0;
          const current = stepIndex(view);
          // Verifications count per proof: a new certificate after a cancel needs a new verification
          const verifiedThisProof = !!verifier?.hasVerified && !!proof && verifier.verifiedAt >= proof.submittedAt;

          return (
            <Card key={key}>
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <p className="font-semibold text-gray-900 text-lg">{vault.name || 'Vault'}</p>
                  <p className="text-xs text-gray-500">
                    {t('inheritances.owner')} <code>{formatAddress(vault.owner.toBase58())}</code>
                  </p>
                  <div className="flex gap-2 mt-2">
                    {beneficiary && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-100 text-primary-700">
                        {t('inheritances.heirBadge', { percent: beneficiary.sharePercent })}
                      </span>
                    )}
                    {verifier && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                        {t('inheritances.verifierBadge')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{t('inheritances.vaultBalance')}</p>
                  <p className="font-bold text-gray-900 text-xl">{vault.balance.toFixed(4)} SOL</p>
                </div>
              </div>

              {!plan ? (
                <p className="text-sm text-gray-500">{t('inheritances.noPlan')}</p>
              ) : (
                <>
                  {/* Progress */}
                  {plan.status === 'cancelled' ? (
                    <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-gray-50 text-sm text-gray-700">
                      <XCircle className="w-4 h-4 text-gray-500" />
                      {t('inheritances.cancelled')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {STEPS.map((label, i) => (
                        <div key={label} className="text-center">
                          <div className={`h-1.5 rounded-full mb-1 ${i <= current ? 'bg-primary-500' : 'bg-gray-200'}`} />
                          <span className={`text-xs ${i <= current ? 'text-primary-700 font-medium' : 'text-gray-400'}`}>
                            {t(label)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Facts */}
                  <div className="grid sm:grid-cols-3 gap-3 text-sm mb-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">{t('inheritances.trigger')}</p>
                      <p className="font-medium text-gray-900">
                        {plan.triggerType === 'deathCertificate' ? t('inheritances.triggerCertificate') :
                         plan.triggerType === 'deadmanSwitch' ? t('inheritances.triggerDeadman') : t('inheritances.triggerBoth')}
                      </p>
                    </div>
                    {usesDeadman(plan.triggerType) && plan.status === 'configured' && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Deadman switch</p>
                        <p className="font-medium text-gray-900">
                          {deadmanReached ? t('inheritances.deadlineReached') : t('inheritances.firesIn', { time: formatRemaining(deadmanAt - now, t('inheritances.now'), t('inheritances.underMinute')) })}
                        </p>
                      </div>
                    )}
                    {plan.cooldownEndsAt > 0 && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Cooldown</p>
                        <p className="font-medium text-gray-900 flex items-center gap-1">
                          <Timer className="w-4 h-4" />
                          {cooldownOver ? t('inheritances.ended') : t('inheritances.endsIn', { time: formatRemaining(plan.cooldownEndsAt - now, t('inheritances.now'), t('inheritances.underMinute')) })}
                        </p>
                      </div>
                    )}
                    {beneficiary && plan.distributionAmount > 0 && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">{t('inheritances.yourShare')}</p>
                        <p className="font-medium text-gray-900">
                          {(gross * (1 - CLAIM_FEE_FREE_TIER)).toFixed(4)} SOL
                        </p>
                        <p className="text-xs text-gray-400">{t('inheritances.afterFee')}</p>
                      </div>
                    )}
                  </div>

                  {/* Death certificate */}
                  {usesCertificate(plan.triggerType) && proof && (
                    <div className="p-3 mb-4 border border-gray-100 rounded-lg text-sm">
                      <div className="flex items-center gap-2 font-medium text-gray-900 mb-1">
                        <FileText className="w-4 h-4" />
                        {t('inheritances.certificateSent')}
                        {proof.verified ? (
                          <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{t('inheritances.verifiedBadge')}</span>
                        ) : (
                          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            {t('inheritances.verificationsProgress', { count: plan.currentVerifications, required: plan.requiredVerifications })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 break-all">SHA-256: <code>{proof.documentHash}</code></p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {beneficiary?.status === 'active' && usesCertificate(plan.triggerType) &&
                      plan.status === 'configured' && !proof && (
                      <label className="inline-flex">
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          disabled={loading}
                          onChange={e => handleSubmitCertificate(view, e.target.files?.[0])}
                        />
                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 cursor-pointer">
                          <Upload className="w-4 h-4" />
                          {t('inheritances.submitCertificate')}
                        </span>
                      </label>
                    )}

                    {verifier && !verifiedThisProof && plan.status === 'proofSubmitted' && proof && !proof.verified && (
                      <>
                        <label className="inline-flex">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,image/*"
                            onChange={e => handleCompareFile(view, e.target.files?.[0])}
                          />
                          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer">
                            <FileText className="w-4 h-4" />
                            {t('inheritances.compareDocument')}
                          </span>
                        </label>
                        <Button
                          size="sm"
                          disabled={loading}
                          onClick={() => run(verifyDeathCertificate(vault.address))}
                          icon={<ShieldCheck className="w-4 h-4" />}
                        >
                          {t('inheritances.confirmCertificate')}
                        </Button>
                      </>
                    )}
                    {verifiedThisProof && (
                      <span className="text-xs text-blue-700 self-center flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> {t('inheritances.alreadyVerified')}
                      </span>
                    )}

                    {canTrigger && (
                      <Button
                        size="sm"
                        disabled={loading}
                        onClick={() => run(initiateInheritance(vault.address))}
                        icon={<Play className="w-4 h-4" />}
                      >
                        {t('inheritances.triggerInheritance')}
                      </Button>
                    )}

                    {canClaim && beneficiary && (
                      <Button
                        size="sm"
                        disabled={loading}
                        onClick={() => run(claimInheritance(vault.address, beneficiary.wallet, vault.owner))}
                        icon={<Download className="w-4 h-4" />}
                      >
                        {t('inheritances.claimShare')}
                      </Button>
                    )}

                    {beneficiary?.status === 'claimed' && (
                      <span className="text-sm text-green-700 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        {t('inheritances.claimed', { amount: beneficiary.claimedAmount.toFixed(4) })}
                      </span>
                    )}
                  </div>

                  {checkedHash[key] && proof && (
                    <p className={`mt-3 text-xs p-2 rounded ${
                      checkedHash[key] === proof.documentHash ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {checkedHash[key] === proof.documentHash
                        ? t('inheritances.documentMatches')
                        : t('inheritances.documentMismatch')}
                    </p>
                  )}

                  {plan.status === 'cooldownActive' && !cooldownOver && (
                    <p className="mt-3 text-xs text-gray-500">
                      {t('inheritances.cooldownNote')}
                    </p>
                  )}
                </>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
