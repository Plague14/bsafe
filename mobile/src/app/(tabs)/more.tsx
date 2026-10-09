import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import { APP_IDENTITY, CLUSTER, PROGRAM_ID, explorerAddress } from '../../lib/config';
import { Address, Button, Card, Segmented, Screen, text } from '../../ui/components';
import { colors, space } from '../../ui/theme';
import { useWallet } from '../../wallet/WalletContext';

type IconName = keyof typeof Ionicons.glyphMap;

function Item({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.primarySoft }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={s.itemText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const { publicKey, disconnect } = useWallet();
  const { t, lang, setLang } = useI18n();

  return (
    <Screen title={t('more.title')}>
      <Card>
        <Text style={text.small}>{t('more.wallet')}</Text>
        {publicKey ? <Address value={publicKey.toBase58()} chars={8} style={{ marginTop: 4 }} /> : null}
        <Text style={[text.small, { marginTop: space(3) }]}>{t('more.network')}</Text>
        <Text style={s.value}>Solana {CLUSTER}</Text>
      </Card>

      <Text style={text.section}>{t('more.language')}</Text>
      <Segmented value={lang} onChange={setLang} options={[{ value: 'en', label: 'English' }, { value: 'pt', label: 'Português (BR)' }]} />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Item icon="key-outline" label={t('multisig.title')} onPress={() => router.push('/multisig')} />
        <View style={s.sep} />
        <Item icon="globe-outline" label={t('more.website')} onPress={() => Linking.openURL(APP_IDENTITY.uri)} />
        <View style={s.sep} />
        <Item icon="cube-outline" label={t('more.explorer')} onPress={() => Linking.openURL(explorerAddress(PROGRAM_ID.toBase58()))} />
        <View style={s.sep} />
        <Item icon="logo-github" label={t('more.github')} onPress={() => Linking.openURL('https://github.com/Plague14/bsafe')} />
      </Card>

      <Button variant="danger" icon="log-out-outline" label={t('more.disconnect')} onPress={disconnect} />
      <Text style={[text.small, { textAlign: 'center', marginTop: space(4) }]}>
        {t('more.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  value: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(4) },
  itemText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: space(12) },
});
