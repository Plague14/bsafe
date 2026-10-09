import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { describeError } from '../lib/errors';
import { Button } from '../ui/components';
import { colors, space } from '../ui/theme';
import { useWallet } from '../wallet/WalletContext';

export default function Welcome() {
  const { publicKey, restoring, connect } = useWallet();
  const { t, lang, setLang } = useI18n();
  const [connecting, setConnecting] = useState(false);

  if (restoring) {
    return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (publicKey) return <Redirect href="/(tabs)" />;

  const onConnect = async () => {
    setConnecting(true);
    try {
      await connect();
    } catch (err) {
      console.warn('[bsafe] connect failed', (err as { code?: string })?.code, err);
      // MWA reports a missing wallet the same way as a user cancel, so the hint covers both
      const message = describeError(err, lang);
      Alert.alert(t('errors.generic'), message === t('errors.userRejected') ? t('errors.connectCancelled') : message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.top}>
        <Image source={require('../../assets/logo.png')} style={s.logo} />
        <View style={s.lang}>
          {(['en', 'pt'] as const).map(l => (
            <Pressable key={l} onPress={() => setLang(l)} style={[s.langBtn, lang === l && s.langOn]}>
              <Text style={[s.langText, lang === l && s.langTextOn]}>{l === 'en' ? 'EN' : 'PT-BR'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.hero}>
        <View style={s.badge}>
          <View style={s.dot} />
          <Text style={s.badgeText}>{t('welcome.devnet')}</Text>
        </View>
        <Text style={s.title}>{t('welcome.title')}</Text>
        <Text style={s.body}>{t('welcome.body')}</Text>

        <View style={s.points}>
          {([
            ['shield-checkmark-outline', 'Non-custodial'],
            ['people-outline', lang === 'pt' ? 'Herdeiros com percentuais' : 'Heirs with shares'],
            ['timer-outline', lang === 'pt' ? 'Deadman switch e certidão' : 'Deadman switch & certificate'],
          ] as const).map(([icon, label]) => (
            <View key={label} style={s.point}>
              <Ionicons name={icon} size={18} color={colors.primary} />
              <Text style={s.pointText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.bottom}>
        <Button label={connecting ? t('welcome.connecting') : t('welcome.connect')} icon="wallet-outline" onPress={onConnect} loading={connecting} />
        <Text style={s.hint}>{t('welcome.hint')}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  safe: { flex: 1, backgroundColor: colors.white, paddingHorizontal: space(6) },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(4) },
  logo: { width: 44, height: 44, borderRadius: 10 },
  lang: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 3 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  langOn: { backgroundColor: colors.primary },
  langText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  langTextOn: { color: colors.white },
  hero: { flex: 1, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: space(5) },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  badgeText: { fontSize: 13, color: colors.primaryDark, fontWeight: '600' },
  title: { fontSize: 40, lineHeight: 44, fontWeight: '800', color: colors.text, letterSpacing: -1, marginBottom: space(4) },
  body: { fontSize: 16, lineHeight: 24, color: colors.textMuted },
  points: { marginTop: space(6), gap: space(3) },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  bottom: { paddingBottom: space(6) },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: space(3), lineHeight: 18 },
});
