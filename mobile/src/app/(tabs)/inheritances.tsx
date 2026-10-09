import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { sha256 } from '@noble/hashes/sha2.js';
import { Buffer } from 'buffer';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n, type MessageKey } from '../../i18n';
import { getMyInheritances, ixs, membershipPda, type InheritanceView, type TriggerType } from '../../lib/program';
import { Address, Badge, Button, Card, Empty, Notice, Row, Screen, text } from '../../ui/components';
import { formatDuration, formatSol } from '../../ui/format';
import { colors, space } from '../../ui/theme';
import { useAction } from '../../wallet/useAction';
import { useWallet } from '../../wallet/WalletContext';

const CLAIM_FEE_FREE_TIER = 0.01; // 1% protocol fee (Free tier)

const usesCertificate = (t: TriggerType) => t === 'deathCertificate' || t === 'both';
const usesDeadman = (t: TriggerType) => t === 'deadmanSwitch' || t === 'both';

const STEPS: MessageKey[] = ['inh.stepConfigured', 'inh.stepTrigger', 'inh.stepCooldown', 'inh.stepClaim'];

function stepIndex(view: InheritanceView): number {
  switch (view.plan?.status) {
    case 'proofSubmitted': return 1;
    case 'cooldownActive': return 2;
    case 'claimReady':
    case 'completed': return 3;
    default: return 0;
  }
}

/** Lets the user pick a document and returns its SHA-256; the file stays on the device. */
async function pickAndHash(): Promise<Uint8Array | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'text/plain'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const bytes = new Uint8Array(await new File(result.assets[0].uri).arrayBuffer());
  return sha256(bytes);
}

export default function InheritancesScreen() {
  const { connection, publicKey } = useWallet();
  const { t, lang } = useI18n();
  const { run, busy } = useAction();
  const [views, setViews] = useState<InheritanceView[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [checked, setChecked] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      setViews(await getMyInheritances(connection, publicKey));
      setNow(Date.now());
    } catch (err) {
      console.warn('[bsafe] failed to load inheritances', err);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => { load(); }, [load]);
  // Tick every 5s so countdowns (minutes on the devnet demo build) stay current
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (!publicKey) return null;
  const me = publicKey;

  return (
    <Screen title={t('inh.title')} subtitle={t('inh.subtitle')} onRefresh={load} refreshing={loading}>
      {views.length === 0 && !loading ? (
        <Empty icon="gift-outline" title={t('inh.empty')} body={t('inh.emptyBody')} />
      ) : views.map(view => {
        const { vault, plan, proof, beneficiary, verifier } = view;
        const key = vault.address.toBase58();
        const deadmanAt = plan ? vault.lastActivity + plan.deadmanSwitchSeconds * 1000 : 0;
        const deadmanReached = !!plan && usesDeadman(plan.triggerType) && now >= deadmanAt;
        const canTrigger = !!plan && (plan.status === 'configured' || plan.status === 'proofSubmitted') && (deadmanReached || !!proof?.verified);
        const cooldownOver = !!plan && plan.cooldownEndsAt > 0 && now >= plan.cooldownEndsAt;
        const canClaim = !!beneficiary && beneficiary.status === 'active' && !!plan &&
          (plan.status === 'cooldownActive' || plan.status === 'claimReady') && cooldownOver;
        const pool = plan && plan.distributionAmount > 0 ? plan.distributionAmount : vault.balance;
        const share = beneficiary ? pool * beneficiary.sharePercent / 100 * (1 - CLAIM_FEE_FREE_TIER) : 0;
        const current = stepIndex(view);
        // Verifications count per proof: a new certificate after a cancel needs a new verification
        const verifiedThisProof = !!verifier?.hasVerified && !!proof && verifier.verifiedAt >= proof.submittedAt;
        const comparison = checked[key];

        return (
          <Card key={key}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={text.h2}>{vault.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={text.small}>{t('inh.owner', { address: '' })}</Text>
                  <Address value={vault.owner.toBase58()} />
                </View>
                <View style={s.roles}>
                  {beneficiary ? <Badge label={t('inh.roleHeir', { percent: beneficiary.sharePercent })} /> : null}
                  {verifier ? <Badge label={t('inh.roleVerifier')} tone="gray" /> : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={text.small}>{t('inh.balance')}</Text>
                <Text style={s.balance}>{formatSol(vault.balance)} SOL</Text>
              </View>
            </View>

            {!plan ? <Notice text={t('inh.noPlan')} /> : (
              <>
                <View style={s.steps}>
                  {STEPS.map((step, i) => (
                    <View key={step} style={{ flex: 1 }}>
                      <View style={[s.stepBar, { backgroundColor: i <= current ? colors.primary : colors.border }]} />
                      <Text style={[s.stepText, i <= current && { color: colors.primaryDark, fontWeight: '600' }]}>{t(step)}</Text>
                    </View>
                  ))}
                </View>

                {usesDeadman(plan.triggerType) && (plan.status === 'configured' || plan.status === 'proofSubmitted') ? (
                  <Row label={t('plan.deadman')} value={deadmanReached ? t('inh.deadlineReached') : formatDuration(deadmanAt - now, lang)} />
                ) : null}
                {plan.cooldownEndsAt > 0 && plan.status !== 'completed' && plan.status !== 'cancelled' ? (
                  <Row label={t('plan.cooldown')} value={cooldownOver ? t('inh.ended') : t('inh.endsIn', { time: formatDuration(plan.cooldownEndsAt - now, lang) })} />
                ) : null}
                {beneficiary && pool > 0 ? (
                  <Row label={t('inh.yourShare')} value={`${formatSol(share)} SOL · ${t('inh.afterFee')}`} />
                ) : null}

                {usesCertificate(plan.triggerType) ? (
                  <View style={s.cert}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="document-text-outline" size={16} color={colors.text} />
                      <Text style={s.certTitle}>{t('inh.certificate')}</Text>
                      {proof ? (
                        proof.verified ? <Badge label={t('plan.verified')} tone="green" />
                          : <Badge label={t('inh.submitted', { count: plan.currentVerifications, required: plan.requiredVerifications })} tone="amber" />
                      ) : null}
                    </View>
                    {proof ? <Text style={s.hash} selectable>SHA-256: {proof.documentHash}</Text> : <Text style={text.small}>{t('inh.noCertificate')}</Text>}
                  </View>
                ) : null}

                {plan.status === 'cooldownActive' && !cooldownOver ? <Notice text={t('inh.cooldownNote')} tone="amber" icon="time-outline" /> : null}
                {comparison ? (
                  <Notice tone={comparison === proof?.documentHash ? 'green' : 'red'}
                    icon={comparison === proof?.documentHash ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    text={comparison === proof?.documentHash ? t('inh.matches') : t('inh.mismatch')} />
                ) : null}

                <View style={s.actions}>
                  {beneficiary?.status === 'active' && usesCertificate(plan.triggerType) && plan.status === 'configured' && !proof ? (
                    <>
                      <Button icon="cloud-upload-outline" label={t('inh.submit')} loading={busy === `submit-${key}`}
                        onPress={async () => {
                          const hash = await pickAndHash();
                          if (hash) await run(`submit-${key}`, () => ixs.submitCertificate(me, vault.address, hash), load);
                        }} />
                      <Text style={text.small}>{t('inh.submitHint')}</Text>
                    </>
                  ) : null}

                  {verifier && !verifiedThisProof && plan.status === 'proofSubmitted' && proof && !proof.verified ? (
                    <>
                      <Button variant="secondary" icon="document-text-outline" label={t('inh.compare')}
                        onPress={async () => {
                          const hash = await pickAndHash();
                          if (hash) setChecked(prev => ({ ...prev, [key]: Buffer.from(hash).toString('hex') }));
                        }} />
                      <Button icon="shield-checkmark-outline" label={t('inh.confirm')} loading={busy === `verify-${key}`}
                        onPress={() => run(`verify-${key}`, () => ixs.verifyCertificate(me, vault.address), load)} />
                    </>
                  ) : null}
                  {verifiedThisProof ? <Badge label={t('inh.alreadyVerified')} tone="blue" /> : null}

                  {canTrigger ? (
                    <Button icon="play-outline" label={t('inh.trigger')} loading={busy === `trigger-${key}`}
                      onPress={() => run(`trigger-${key}`, () => ixs.initiate(me, vault.address, !!proof), load)} />
                  ) : null}

                  {canClaim ? (
                    <Button icon="download-outline" label={t('inh.claim')} loading={busy === `claim-${key}`}
                      onPress={() => run(`claim-${key}`, async () => {
                        const hasMembership = !!(await connection.getAccountInfo(membershipPda(vault.owner)));
                        return ixs.claim(me, vault.address, vault.owner, hasMembership);
                      }, load)} />
                  ) : null}

                  {beneficiary?.status === 'claimed' ? (
                    <Notice tone="green" icon="checkmark-circle-outline" text={t('inh.claimed', { amount: formatSol(beneficiary.claimedAmount) })} />
                  ) : null}
                </View>
              </>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', gap: space(3), marginBottom: space(3) },
  roles: { flexDirection: 'row', gap: 6, marginTop: space(2) },
  balance: { fontSize: 18, fontWeight: '800', color: colors.text },
  steps: { flexDirection: 'row', gap: 6, marginBottom: space(3) },
  stepBar: { height: 4, borderRadius: 2, marginBottom: 6 },
  stepText: { fontSize: 11, color: colors.textSoft, textAlign: 'center' },
  cert: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: space(3), marginVertical: space(3) },
  certTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  hash: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  actions: { gap: space(2), marginTop: space(2) },
});
