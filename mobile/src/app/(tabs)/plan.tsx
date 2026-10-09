import { PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n, type MessageKey } from '../../i18n';
import { COOLDOWN_RANGE, DEADMAN_RANGE, DEMO_TIMERS } from '../../lib/config';
import { getBeneficiaries, getPlan, getVerifiers, ixs, type InheritancePlan, type TriggerType, type Verifier } from '../../lib/program';
import { Address, Badge, Button, Card, Empty, Field, Notice, Row, Screen, Segmented, Sheet, Stepper, VaultChips, text } from '../../ui/components';
import { formatDuration, formatPeriod } from '../../ui/format';
import { colors, radius, space } from '../../ui/theme';
import { useAction } from '../../wallet/useAction';
import { useVaults } from '../../wallet/VaultsContext';
import { useWallet } from '../../wallet/WalletContext';

const statusKey: Record<InheritancePlan['status'], MessageKey> = {
  configured: 'plan.statusConfigured',
  proofSubmitted: 'plan.statusProofSubmitted',
  cooldownActive: 'plan.statusCooldownActive',
  claimReady: 'plan.statusClaimReady',
  completed: 'plan.statusCompleted',
  cancelled: 'plan.statusCancelled',
};

const triggerKey: Record<TriggerType, MessageKey> = {
  deathCertificate: 'plan.triggerDeath',
  deadmanSwitch: 'plan.triggerDeadman',
  both: 'plan.triggerBoth',
};

export default function PlanScreen() {
  const { connection, publicKey } = useWallet();
  const { vaults, selected, select, refresh: refreshVaults } = useVaults();
  const { t, lang } = useI18n();
  const { run, busy } = useAction();
  const [plan, setPlan] = useState<InheritancePlan | null>(null);
  const [verifiers, setVerifiers] = useState<Verifier[]>([]);
  const [allocatedBps, setAllocatedBps] = useState(0);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState({
    trigger: (DEMO_TIMERS ? 'deadmanSwitch' : 'both') as TriggerType,
    cooldown: COOLDOWN_RANGE.default,
    deadman: DEADMAN_RANGE.default,
    verifications: 1,
  });
  const [addingVerifier, setAddingVerifier] = useState(false);
  const [verifierInput, setVerifierInput] = useState('');

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const [p, heirs] = await Promise.all([getPlan(connection, selected.address), getBeneficiaries(connection, selected.address)]);
      setPlan(p);
      setAllocatedBps(heirs.reduce((sum, h) => sum + h.shareBps, 0));
      setVerifiers(p ? await getVerifiers(connection, selected.address) : []);
      setNow(Date.now());
    } catch (err) {
      console.warn('[bsafe] failed to load plan', err);
    } finally {
      setLoading(false);
    }
  }, [connection, selected]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (!publicKey) return null;
  const me = publicKey;

  if (!selected) {
    return (
      <Screen title={t('plan.title')}>
        <Empty icon="shield-checkmark-outline" title={t('plan.none')} body={t('heirs.needVault')} />
      </Screen>
    );
  }

  const unit = (n: number) => (DEMO_TIMERS ? t('common.min', { count: n }) : t(n === 1 ? 'common.day' : 'common.days', { count: n }));
  const refreshAll = async () => { await Promise.all([load(), refreshVaults()]); };
  const usesCertificate = (trigger: TriggerType) => trigger !== 'deadmanSwitch';
  const verifierKey = (() => {
    try { return verifierInput.trim() ? new PublicKey(verifierInput.trim()) : null; } catch { return null; }
  })();

  // ---------- No plan yet: creation form ----------
  if (!plan) {
    return (
      <Screen title={t('plan.title')} subtitle={selected.name} onRefresh={refreshAll} refreshing={loading}>
        <VaultChips items={vaults.map(v => ({ key: v.address.toBase58(), label: v.name }))} selected={selected.address.toBase58()} onSelect={select} />
        {DEMO_TIMERS ? <Notice text={t('plan.demoNotice')} /> : null}
        {allocatedBps !== 10000 ? <Notice text={t('plan.needHeirs')} tone="amber" icon="alert-circle-outline" /> : null}
        <Card>
          <Text style={[text.h2, { marginBottom: space(3) }]}>{t('plan.create')}</Text>
          <Text style={s.label}>{t('plan.trigger')}</Text>
          <Segmented
            value={form.trigger}
            onChange={trigger => setForm({ ...form, trigger })}
            options={[
              { value: 'deadmanSwitch', label: t('plan.triggerDeadman') },
              { value: 'deathCertificate', label: t('plan.triggerDeath') },
              { value: 'both', label: t('plan.triggerBoth') },
            ]}
          />
          <Stepper label={t('plan.cooldown')} hint={t('plan.cooldownHint')} value={form.cooldown} display={unit(form.cooldown)}
            min={COOLDOWN_RANGE.min} max={COOLDOWN_RANGE.max} onChange={cooldown => setForm({ ...form, cooldown })} />
          {form.trigger !== 'deathCertificate' ? (
            <Stepper label={t('plan.deadman')} hint={t('plan.deadmanHint')} value={form.deadman} display={unit(form.deadman)}
              min={DEADMAN_RANGE.min} max={DEADMAN_RANGE.max} onChange={deadman => setForm({ ...form, deadman })} />
          ) : null}
          {usesCertificate(form.trigger) ? (
            <Stepper label={t('plan.verifications')} value={form.verifications} display={String(form.verifications)}
              min={1} max={5} onChange={verifications => setForm({ ...form, verifications })} />
          ) : null}
          <Button
            label={t('plan.create')}
            disabled={allocatedBps !== 10000}
            loading={busy === 'create-plan'}
            onPress={() => run('create-plan', () => ixs.createPlan(
              me, selected.address, form.trigger, form.cooldown,
              // The program still validates the deadman bounds when the trigger is certificate-only
              form.trigger === 'deathCertificate' ? DEADMAN_RANGE.default : form.deadman,
              // The program requires 1-10 even when the trigger ignores certificates
              usesCertificate(form.trigger) ? form.verifications : 1,
            ), refreshAll)}
          />
        </Card>
      </Screen>
    );
  }

  // ---------- Existing plan ----------
  const inCooldown = plan.status === 'cooldownActive';
  const cooldownLeft = plan.cooldownEndsAt - now;
  const deadmanAt = selected.lastActivity + plan.deadmanSwitchSeconds * 1000;
  const verifiedCount = verifiers.filter(v => v.hasVerified).length;

  return (
    <Screen title={t('plan.title')} subtitle={selected.name} onRefresh={refreshAll} refreshing={loading}>
      <VaultChips items={vaults.map(v => ({ key: v.address.toBase58(), label: v.name }))} selected={selected.address.toBase58()} onSelect={select} />

      <View style={[s.hero, inCooldown && { backgroundColor: '#EA580C' }, plan.status === 'cancelled' && { backgroundColor: '#475569' }]}>
        <Text style={s.heroLabel}>{t('plan.status')}</Text>
        <Text style={s.heroStatus}>{t(statusKey[plan.status])}</Text>
        {inCooldown ? (
          <Text style={s.heroSub}>{cooldownLeft > 0 ? t('plan.cooldownLeft', { time: formatDuration(cooldownLeft, lang) }) : t('plan.cooldownEnded')}</Text>
        ) : plan.triggerType !== 'deathCertificate' && (plan.status === 'configured' || plan.status === 'proofSubmitted') ? (
          <Text style={s.heroSub}>{deadmanAt > now ? t('plan.deadmanIn', { time: formatDuration(deadmanAt - now, lang) }) : t('plan.deadmanReached')}</Text>
        ) : null}
        {inCooldown && cooldownLeft > 0 ? (
          <Button style={{ marginTop: space(4) }} variant="secondary" icon="hand-left-outline" label={t('plan.alive')}
            loading={busy === 'cancel'} onPress={() => run('cancel', () => ixs.cancel(me, selected.address), refreshAll)} />
        ) : null}
        {plan.status === 'cancelled' ? (
          <Button style={{ marginTop: space(4) }} variant="secondary" icon="refresh" label={t('plan.reset')}
            loading={busy === 'reset'} onPress={() => run('reset', () => ixs.resetPlan(me, selected.address), refreshAll)} />
        ) : null}
      </View>

      <Card>
        <Row label={t('plan.trigger')} value={t(triggerKey[plan.triggerType])} />
        <Row label={t('plan.cooldown')} value={formatPeriod(plan.cooldownSeconds, lang)} />
        {plan.triggerType !== 'deathCertificate' ? <Row label={t('plan.deadman')} value={formatPeriod(plan.deadmanSwitchSeconds, lang)} /> : null}
        {usesCertificate(plan.triggerType) ? <Row label={t('plan.verifications')} value={`${plan.currentVerifications} / ${plan.requiredVerifications}`} /> : null}
      </Card>

      {usesCertificate(plan.triggerType) ? (
        <>
          <Text style={text.section}>{t('plan.verifiers')}</Text>
          <Text style={[text.body, { marginBottom: space(3) }]}>{t('plan.verifiersHint')}</Text>
          {verifiers.length < plan.requiredVerifications ? (
            <Notice tone="amber" icon="alert-circle-outline" text={t('plan.notEnoughVerifiers', { required: plan.requiredVerifications, count: verifiers.length })} />
          ) : null}
          {verifiers.map(v => (
            <Card key={v.address.toBase58()} style={s.verifier}>
              <Address value={v.verifier.toBase58()} chars={6} />
              {v.hasVerified ? <Badge label={t('plan.verified')} tone="green" /> : null}
            </Card>
          ))}
          <Button variant="secondary" icon="person-add-outline" label={t('plan.addVerifier')} onPress={() => setAddingVerifier(true)} />
          {verifiedCount > 0 ? <Text style={[text.small, { marginTop: space(2) }]}>{verifiedCount} / {verifiers.length}</Text> : null}
        </>
      ) : null}

      <Sheet visible={addingVerifier} title={t('plan.addVerifier')} onClose={() => setAddingVerifier(false)}>
        <Field label={t('common.address')} placeholder={t('common.address')} value={verifierInput} onChangeText={setVerifierInput}
          error={verifierInput.trim() && !verifierKey ? t('common.invalidAddress') : null} hint={t('plan.verifiersHint')} />
        <Button
          label={t('common.add')}
          disabled={!verifierKey}
          loading={busy === 'add-verifier'}
          onPress={() => verifierKey && run('add-verifier', () => ixs.addVerifier(me, selected.address, verifierKey), async () => {
            setAddingVerifier(false);
            setVerifierInput('');
            await load();
          })}
        />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: space(5), marginBottom: space(4) },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  heroStatus: { color: colors.white, fontSize: 26, fontWeight: '800', marginTop: 2 },
  heroSub: { color: colors.white, fontSize: 15, marginTop: space(2), opacity: 0.95 },
  verifier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
