import { Ionicons } from '@expo/vector-icons';
import { PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import { getBeneficiaries, ixs, type Beneficiary } from '../../lib/program';
import { Address, Badge, Button, Card, Empty, Field, Notice, Screen, Sheet, VaultChips, text } from '../../ui/components';
import { formatSol } from '../../ui/format';
import { colors, space } from '../../ui/theme';
import { useAction } from '../../wallet/useAction';
import { useVaults } from '../../wallet/VaultsContext';
import { useWallet } from '../../wallet/WalletContext';

export default function HeirsScreen() {
  const { connection, publicKey } = useWallet();
  const { vaults, selected, select, refresh: refreshVaults } = useVaults();
  const { t } = useI18n();
  const { run, busy } = useAction();
  const [heirs, setHeirs] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [wallet, setWallet] = useState('');
  const [share, setShare] = useState('');

  const load = useCallback(async () => {
    if (!selected) return setHeirs([]);
    setLoading(true);
    try {
      setHeirs(await getBeneficiaries(connection, selected.address));
    } catch (err) {
      console.warn('[bsafe] failed to load heirs', err);
    } finally {
      setLoading(false);
    }
  }, [connection, selected]);

  useEffect(() => { load(); }, [load]);

  if (!publicKey) return null;
  const me = publicKey;

  if (!selected) {
    return (
      <Screen title={t('heirs.title')}>
        <Empty icon="people-outline" title={t('heirs.empty')} body={t('heirs.needVault')} />
      </Screen>
    );
  }

  const allocatedBps = heirs.reduce((sum, h) => sum + h.shareBps, 0);
  const available = (10000 - allocatedBps) / 100;
  const shareValue = Number(share.replace(',', '.'));
  const heirKey = (() => {
    try { return wallet.trim() ? new PublicKey(wallet.trim()) : null; } catch { return null; }
  })();
  const shareOk = Number.isFinite(shareValue) && shareValue > 0 && shareValue <= available;

  const refreshAll = async () => { await Promise.all([load(), refreshVaults()]); };

  const remove = (h: Beneficiary) =>
    Alert.alert(t('common.remove'), t('heirs.removeConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: () => run(`rm-${h.wallet.toBase58()}`, () => ixs.removeBeneficiary(me, selected.address, h.wallet), refreshAll) },
    ]);

  return (
    <Screen title={t('heirs.title')} subtitle={selected.name} onRefresh={refreshAll} refreshing={loading}>
      <VaultChips items={vaults.map(v => ({ key: v.address.toBase58(), label: v.name }))} selected={selected.address.toBase58()} onSelect={select} />

      <Card>
        <View style={s.allocHead}>
          <Text style={text.h2}>{t('heirs.allocated', { percent: allocatedBps / 100 })}</Text>
          {allocatedBps === 10000 ? <Badge label={t('heirs.full')} tone="green" /> : null}
        </View>
        <View style={s.bar}>
          {heirs.map((h, i) => (
            <View key={h.address.toBase58()} style={{ flex: h.shareBps, backgroundColor: i % 2 === 0 ? colors.primary : colors.heir, marginRight: 2 }} />
          ))}
          {allocatedBps < 10000 ? <View style={{ flex: 10000 - allocatedBps, backgroundColor: '#E5E7EB' }} /> : null}
        </View>
        {allocatedBps < 10000 && heirs.length > 0 ? <Text style={[text.small, { marginTop: space(2) }]}>{t('heirs.incomplete', { percent: available })}</Text> : null}
      </Card>

      {heirs.length === 0 && !loading ? (
        <Empty icon="people-outline" title={t('heirs.empty')} body={t('heirs.emptyBody')}
          action={<Button icon="add" label={t('heirs.add')} onPress={() => setAdding(true)} />} />
      ) : (
        <>
          {heirs.map((h, i) => (
            <Card key={h.address.toBase58()} style={s.heir}>
              <View style={[s.avatar, { backgroundColor: i % 2 === 0 ? colors.primarySoft : '#ECFEFF' }]}>
                <Ionicons name="person-outline" size={18} color={i % 2 === 0 ? colors.primary : colors.heir} />
              </View>
              <View style={{ flex: 1 }}>
                <Address value={h.wallet.toBase58()} chars={6} />
                {h.status === 'claimed' ? <Badge label={t('heirs.claimed', { amount: formatSol(h.claimedAmount) })} tone="green" /> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.share}>{h.sharePercent}%</Text>
                <Text style={text.small}>≈ {formatSol(selected.balance * h.shareBps / 10000)} SOL</Text>
              </View>
              {h.status === 'active' ? (
                <Pressable onPress={() => remove(h)} hitSlop={10} style={{ marginLeft: space(2) }}>
                  <Ionicons name="trash-outline" size={18} color={colors.textSoft} />
                </Pressable>
              ) : null}
            </Card>
          ))}
          {allocatedBps < 10000 ? <Button icon="add" label={t('heirs.add')} onPress={() => setAdding(true)} /> : null}
        </>
      )}

      <Sheet visible={adding} title={t('heirs.add')} onClose={() => setAdding(false)}>
        <Field label={t('heirs.wallet')} placeholder={t('common.address')} value={wallet} onChangeText={setWallet}
          error={wallet.trim() && !heirKey ? t('common.invalidAddress') : null} />
        <Field label={t('heirs.share')} placeholder={String(available)} keyboardType="decimal-pad" value={share} onChangeText={setShare}
          hint={t('heirs.available', { percent: available })} error={share && !shareOk ? t('heirs.exceeds') : null} />
        {selected.balance > 0 && shareOk ? <Notice text={`≈ ${formatSol(selected.balance * shareValue / 100)} SOL`} /> : null}
        <Button
          label={t('common.add')}
          disabled={!heirKey || !shareOk}
          loading={busy === 'add-heir'}
          onPress={() => heirKey && run('add-heir', () => ixs.addBeneficiary(me, selected.address, heirKey, shareValue), async () => {
            setAdding(false);
            setWallet('');
            setShare('');
            await refreshAll();
          })}
        />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  allocHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(3) },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  heir: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  share: { fontSize: 18, fontWeight: '800', color: colors.text },
});
