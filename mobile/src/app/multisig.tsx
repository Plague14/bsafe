import { Ionicons } from '@expo/vector-icons';
import { PublicKey } from '@solana/web3.js';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n, type MessageKey } from '../i18n';
import {
  getMultisigTransactions, getSignerVaults, getSigners, ixs, multisigTxPda,
  type MultisigSigner, type MultisigTransaction, type Vault,
} from '../lib/program';
import { Address, Badge, Button, Card, Empty, Field, Screen, Sheet, Stepper, VaultChips, text } from '../ui/components';
import { formatDate, formatSol } from '../ui/format';
import { colors, space } from '../ui/theme';
import { useAction } from '../wallet/useAction';
import { useVaults } from '../wallet/VaultsContext';
import { useWallet } from '../wallet/WalletContext';

const statusKey: Record<MultisigTransaction['status'], MessageKey> = {
  pending: 'multisig.pending',
  approved: 'multisig.approved',
  executed: 'multisig.executed',
  cancelled: 'multisig.cancelled',
};

export default function MultisigScreen() {
  const { connection, publicKey } = useWallet();
  const { vaults: owned } = useVaults();
  const { t, locale } = useI18n();
  const { run, busy } = useAction();
  const [coSigned, setCoSigned] = useState<Vault[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [signers, setSigners] = useState<MultisigSigner[]>([]);
  const [proposals, setProposals] = useState<MultisigTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<null | 'signer' | 'propose'>(null);
  const [input, setInput] = useState('');
  const [amount, setAmount] = useState('');
  const [threshold, setThreshold] = useState(1);

  const all = [...owned, ...coSigned.filter(c => !owned.some(o => o.address.equals(c.address)))];
  const vault = all.find(v => v.address.toBase58() === selectedKey) ?? all.find(v => v.multisigEnabled) ?? all[0] ?? null;

  const load = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      setCoSigned(await getSignerVaults(connection, publicKey));
    } catch (err) {
      console.warn('[bsafe] failed to load co-signed vaults', err);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  const loadVault = useCallback(async () => {
    if (!vault) return;
    const [s, p] = await Promise.all([getSigners(connection, vault.address), getMultisigTransactions(connection, vault.address)]);
    setSigners(s.filter(x => x.isActive));
    setProposals(p);
    setThreshold(vault.multisigThreshold || 1);
  }, [connection, vault?.address.toBase58()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadVault().catch(err => console.warn('[bsafe] failed to load multisig', err)); }, [loadVault]);

  if (!publicKey) return null;
  const me = publicKey;
  const back = (
    <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
  );

  if (!vault) {
    return (
      <Screen title={t('multisig.title')} subtitle={t('multisig.subtitle')} right={back}>
        <Empty icon="key-outline" title={t('multisig.none')} body={t('multisig.noneBody')} />
      </Screen>
    );
  }

  const isOwner = vault.owner.equals(me);
  const amSigner = signers.some(s => s.signer.equals(me));
  const myIndex = signers.find(s => s.signer.equals(me))?.index;
  const refreshAll = async () => { await Promise.all([load(), loadVault()]); };
  const inputKey = (() => {
    try { return input.trim() ? new PublicKey(input.trim()) : null; } catch { return null; }
  })();
  const amountValue = Number(amount.replace(',', '.'));
  const amountOk = Number.isFinite(amountValue) && amountValue > 0;

  const propose = async () => {
    if (!inputKey || !amountOk) return;
    // The proposal PDA is keyed by the vault balance; only one can be pending per balance
    if (await connection.getAccountInfo(multisigTxPda(vault.address, vault.trackedBalanceLamports + 1n))) {
      Alert.alert(t('errors.generic'), t('errors.proposalExists'));
      return;
    }
    await run('propose', () => ixs.proposeWithdrawal(me, vault, amountValue, inputKey), async () => { setSheet(null); await refreshAll(); });
  };

  return (
    <Screen title={t('multisig.title')} subtitle={t('multisig.subtitle')} right={back} onRefresh={refreshAll} refreshing={loading}>
      <VaultChips
        items={all.map(v => ({ key: v.address.toBase58(), label: v.owner.equals(me) ? v.name : `${v.name} (${t('multisig.coSigner')})` }))}
        selected={vault.address.toBase58()}
        onSelect={setSelectedKey}
      />

      <Card>
        <View style={s.head}>
          <Text style={text.h2}>{vault.name}</Text>
          <Text style={s.balance}>{formatSol(vault.balance)} SOL</Text>
        </View>
        <Text style={[text.small, { marginTop: 4 }]}>
          {vault.multisigEnabled ? t('multisig.required', { threshold: vault.multisigThreshold, count: vault.signerCount }) : t('multisig.noneBody')}
        </Text>
      </Card>

      <Text style={text.section}>{t('multisig.signers')}</Text>
      {signers.map(sg => (
        <Card key={sg.address.toBase58()} style={s.signer}>
          <View style={s.index}><Text style={s.indexText}>{sg.index + 1}</Text></View>
          <Address value={sg.signer.toBase58()} chars={6} style={{ flex: 1 }} />
          {sg.signer.equals(vault.owner) ? <Badge label={t('multisig.owner')} tone="gray" /> : null}
          {sg.signer.equals(me) ? <Badge label={t('common.you')} /> : null}
          {isOwner && !sg.signer.equals(vault.owner) ? (
            <Pressable hitSlop={10} onPress={() => run(`rm-${sg.signer.toBase58()}`, () => ixs.removeSigner(me, vault.address, sg.signer), refreshAll)}>
              <Ionicons name="trash-outline" size={18} color={colors.textSoft} />
            </Pressable>
          ) : null}
        </Card>
      ))}
      {isOwner ? (
        <View style={{ gap: space(2), marginBottom: space(3) }}>
          <Button variant="secondary" icon="person-add-outline" label={t('multisig.addSigner')} onPress={() => { setInput(''); setSheet('signer'); }} />
          {vault.multisigEnabled ? (
            <Card>
              <Stepper label={t('multisig.threshold')} value={threshold} display={`${threshold} / ${vault.signerCount}`} min={1} max={Math.max(1, vault.signerCount)} onChange={setThreshold} />
              <Button small label={t('common.confirm')} disabled={threshold === vault.multisigThreshold} loading={busy === 'threshold'}
                onPress={() => run('threshold', () => ixs.updateThreshold(me, vault.address, threshold), refreshAll)} />
            </Card>
          ) : null}
        </View>
      ) : null}

      <Text style={text.section}>{t('multisig.proposals')}</Text>
      {amSigner && vault.multisigEnabled ? (
        <Button icon="arrow-up" label={t('multisig.propose')} onPress={() => { setInput(''); setAmount(''); setSheet('propose'); }} style={{ marginBottom: space(3) }} />
      ) : null}
      {proposals.length === 0 ? <Text style={text.body}>{t('multisig.noProposals')}</Text> : proposals.map(p => {
        const approvedByMe = myIndex !== undefined && (p.approvals & (1n << BigInt(myIndex))) !== 0n;
        const open = p.status === 'pending' || p.status === 'approved';
        return (
          <Card key={p.address.toBase58()}>
            <View style={s.head}>
              <Text style={s.amount}>{formatSol(p.amount)} SOL</Text>
              <Badge label={t(statusKey[p.status])} tone={p.status === 'executed' ? 'green' : p.status === 'cancelled' ? 'red' : 'amber'} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Text style={text.small}>{t('multisig.to', { address: '' })}</Text>
              <Address value={p.destination.toBase58()} />
            </View>
            <Text style={text.small}>{formatDate(p.proposedAt, locale)}</Text>
            <Text style={[text.small, { marginTop: 4 }]}>{t('multisig.approvals', { count: p.approvalCount, threshold: p.threshold })}</Text>
            {open && amSigner ? (
              <View style={s.actions}>
                {!approvedByMe ? (
                  <Button small icon="checkmark" label={t('multisig.approve')} loading={busy === `ap-${p.address.toBase58()}`} style={{ flex: 1 }}
                    onPress={() => run(`ap-${p.address.toBase58()}`, () => ixs.approve(me, vault.address, p.address), refreshAll)} />
                ) : null}
                {p.approvalCount >= p.threshold ? (
                  <Button small icon="send-outline" label={t('multisig.execute')} loading={busy === `ex-${p.address.toBase58()}`} style={{ flex: 1 }}
                    onPress={() => run(`ex-${p.address.toBase58()}`, () => ixs.execute(me, vault.address, p), refreshAll)} />
                ) : null}
                <Button small variant="danger" label={t('multisig.reject')} loading={busy === `rj-${p.address.toBase58()}`} style={{ flex: 1 }}
                  onPress={() => run(`rj-${p.address.toBase58()}`, () => ixs.reject(me, vault.address, p.address), refreshAll)} />
              </View>
            ) : null}
          </Card>
        );
      })}

      <Sheet visible={sheet === 'signer'} title={t('multisig.addSigner')} onClose={() => setSheet(null)}>
        <Field label={t('common.address')} placeholder={t('common.address')} value={input} onChangeText={setInput}
          error={input.trim() && !inputKey ? t('common.invalidAddress') : null} />
        <Button label={t('common.add')} disabled={!inputKey} loading={busy === 'add-signer'}
          onPress={() => inputKey && run('add-signer', () => ixs.addSigner(me, vault.address, inputKey), async () => { setSheet(null); await refreshAll(); })} />
      </Sheet>

      <Sheet visible={sheet === 'propose'} title={t('multisig.propose')} onClose={() => setSheet(null)}>
        <Field label={t('home.amount')} placeholder="0.10" keyboardType="decimal-pad" value={amount} onChangeText={setAmount}
          error={amount && !amountOk ? t('common.invalidAmount') : null} />
        <Field label={t('home.destination')} placeholder={t('common.address')} value={input} onChangeText={setInput}
          error={input.trim() && !inputKey ? t('common.invalidAddress') : null} />
        <Button label={t('multisig.propose')} disabled={!inputKey || !amountOk} loading={busy === 'propose'} onPress={propose} />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balance: { fontSize: 17, fontWeight: '800', color: colors.text },
  signer: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  index: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  indexText: { color: colors.primary, fontWeight: '700' },
  amount: { fontSize: 18, fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
});
