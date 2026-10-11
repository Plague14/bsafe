import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import { describeError } from '../../lib/errors';
import { ixs, type Vault } from '../../lib/program';
import { Address, Badge, Button, Card, Empty, Field, Notice, Screen, Sheet, text } from '../../ui/components';
import { formatDate, formatSol } from '../../ui/format';
import { colors, radius, space } from '../../ui/theme';
import { useAction } from '../../wallet/useAction';
import { useVaults } from '../../wallet/VaultsContext';
import { useWallet } from '../../wallet/WalletContext';

const parseAmount = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const parseKey = (v: string) => {
  try {
    return new PublicKey(v.trim());
  } catch {
    return null;
  }
};

export default function VaultsScreen() {
  const { connection, publicKey } = useWallet();
  const { vaults, loading, refresh } = useVaults();
  const { t, lang, locale } = useI18n();
  const { run, busy } = useAction();
  const [balance, setBalance] = useState<number | null>(null);
  const [airdropping, setAirdropping] = useState(false);
  const [sheet, setSheet] = useState<null | { kind: 'create' } | { kind: 'deposit' | 'withdraw'; vault: Vault }>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');

  const loadBalance = useCallback(async () => {
    if (!publicKey) return;
    setBalance((await connection.getBalance(publicKey).catch(() => 0)) / LAMPORTS_PER_SOL);
  }, [connection, publicKey]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), loadBalance()]);
  }, [refresh, loadBalance]);

  if (!publicKey) return null;
  const me = publicKey;

  const open = (next: typeof sheet) => {
    setName('');
    setAmount('');
    setDestination('');
    setSheet(next);
  };
  const close = () => setSheet(null);

  const airdrop = async () => {
    setAirdropping(true);
    try {
      const sig = await connection.requestAirdrop(me, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, 'confirmed');
      await loadBalance();
      Alert.alert(t('home.airdropDone'));
    } catch (err) {
      Alert.alert(t('errors.generic'), describeError(err, lang));
    } finally {
      setAirdropping(false);
    }
  };

  const statusBadge = (v: Vault) =>
    v.status === 'active' ? <Badge label={t('home.statusActive')} tone="green" />
      : v.status === 'locked' ? <Badge label={t('home.statusLocked')} tone="gray" />
        : <Badge label={t('home.statusInheritance')} tone="amber" />;

  const amountValue = parseAmount(amount);
  const destKey = destination.trim() ? parseKey(destination) : me;
  const multisigOnly = sheet?.kind === 'withdraw' && sheet.vault.multisigEnabled && sheet.vault.multisigThreshold > 1;

  return (
    <Screen title={t('tabs.home')} onRefresh={refreshAll} refreshing={loading}>
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>{t('home.walletBalance')}</Text>
        <Text style={s.balance}>{balance === null ? '—' : `${formatSol(balance)} SOL`}</Text>
        <Address value={me.toBase58()} light />
        <View style={s.balanceActions}>
          <Button small variant="secondary" icon="water-outline" label={t('home.airdrop')} onPress={airdrop} loading={airdropping} />
          <Button small variant="secondary" icon="add" label={t('home.createVault')} onPress={() => open({ kind: 'create' })} />
        </View>
      </View>

      <Text style={text.section}>{t('home.vaults')}</Text>
      {vaults.length === 0 && !loading ? (
        <Empty icon="wallet-outline" title={t('home.noVaults')} body={t('home.noVaultsBody')}
          action={<Button icon="add" label={t('home.createVault')} onPress={() => open({ kind: 'create' })} />} />
      ) : vaults.map(v => (
        <Card key={v.address.toBase58()}>
          <View style={s.vaultHead}>
            <View style={{ flex: 1 }}>
              <Text style={text.h2}>{v.name}</Text>
              <Address value={v.address.toBase58()} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.vaultBalance}>{formatSol(v.balance)} SOL</Text>
              {statusBadge(v)}
            </View>
          </View>
          <View style={s.meta}>
            <Text style={text.small}>{t('home.heirsCount', { count: v.beneficiaryCount })}</Text>
            {v.multisigEnabled ? <Text style={text.small}>· {t('home.multisig', { threshold: v.multisigThreshold, count: v.signerCount })}</Text> : null}
            <Text style={text.small}>· {t('home.lastActivity', { date: formatDate(v.lastActivity, locale) })}</Text>
          </View>
          <View style={s.vaultActions}>
            <Button small icon="arrow-down" label={t('home.deposit')} onPress={() => open({ kind: 'deposit', vault: v })} style={{ flex: 1 }} />
            <Button small variant="secondary" icon="arrow-up" label={t('home.withdraw')} onPress={() => open({ kind: 'withdraw', vault: v })} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}

      <Sheet visible={sheet?.kind === 'create'} title={t('home.createVault')} onClose={close}>
        <Field label={t('home.vaultName')} placeholder={t('home.vaultNamePlaceholder')} value={name} onChangeText={setName} maxLength={32} autoCapitalize="words" />
        <Button
          label={t('home.createVault')}
          disabled={!name.trim()}
          loading={busy === 'create'}
          onPress={() => run('create', () => ixs.createVault(me, name.trim()), async () => { close(); await refreshAll(); })}
        />
      </Sheet>

      <Sheet visible={sheet?.kind === 'deposit'} title={`${t('home.deposit')} · ${sheet && 'vault' in sheet ? sheet.vault.name : ''}`} onClose={close}>
        <Field label={t('home.amount')} placeholder="0.10" keyboardType="decimal-pad" value={amount} onChangeText={setAmount}
          error={amount && !amountValue ? t('common.invalidAmount') : null} />
        <Button
          label={t('home.deposit')}
          disabled={!amountValue}
          loading={busy === 'deposit'}
          onPress={() => sheet && 'vault' in sheet && amountValue &&
            run('deposit', () => ixs.deposit(me, sheet.vault.address, amountValue), async () => { close(); await refreshAll(); })}
        />
      </Sheet>

      <Sheet visible={sheet?.kind === 'withdraw'} title={`${t('home.withdraw')} · ${sheet && 'vault' in sheet ? sheet.vault.name : ''}`} onClose={close}>
        {multisigOnly ? <Notice text={t('home.multisigWithdraw')} tone="amber" /> : (
          <>
            <Field label={t('home.amount')} placeholder="0.10" keyboardType="decimal-pad" value={amount} onChangeText={setAmount}
              error={amount && !amountValue ? t('common.invalidAmount') : null} />
            <Field label={t('home.destination')} placeholder={t('common.address')} value={destination} onChangeText={setDestination}
              hint={t('home.destinationHint')} error={destination.trim() && !destKey ? t('common.invalidAddress') : null} />
            <Button
              label={t('home.withdraw')}
              disabled={!amountValue || !destKey}
              loading={busy === 'withdraw'}
              onPress={() => sheet && 'vault' in sheet && amountValue && destKey &&
                run('withdraw', () => ixs.withdraw(me, sheet.vault.address, amountValue, destKey), async () => { close(); await refreshAll(); })}
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  balanceCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: space(5), marginBottom: space(5) },
  balanceLabel: { color: '#DBEAFE', fontSize: 13, fontWeight: '600' },
  balance: { color: colors.white, fontSize: 32, fontWeight: '800', marginVertical: space(1), letterSpacing: -0.5 },
  balanceActions: { flexDirection: 'row', gap: space(2), marginTop: space(4), flexWrap: 'wrap' },
  vaultHead: { flexDirection: 'row', gap: space(3) },
  vaultBalance: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: space(3) },
  vaultActions: { flexDirection: 'row', gap: space(2), marginTop: space(4) },
});
