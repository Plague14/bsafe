import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useI18n } from '../../i18n';
import { colors } from '../../ui/theme';
import { useWallet } from '../../wallet/WalletContext';

type IconName = keyof typeof Ionicons.glyphMap;

export default function TabsLayout() {
  const { publicKey, restoring } = useWallet();
  const { t } = useI18n();
  if (!restoring && !publicKey) return <Redirect href="/" />;

  const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} size={size} color={color as string} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSoft,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="heirs" options={{ title: t('tabs.heirs'), tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="plan" options={{ title: t('tabs.plan'), tabBarIcon: icon('shield-checkmark-outline') }} />
      <Tabs.Screen name="inheritances" options={{ title: t('tabs.inheritances'), tabBarIcon: icon('gift-outline') }} />
      <Tabs.Screen name="more" options={{ title: t('tabs.more'), tabBarIcon: icon('ellipsis-horizontal') }} />
    </Tabs>
  );
}
