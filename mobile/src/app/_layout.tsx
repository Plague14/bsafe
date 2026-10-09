import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from '../i18n';
import { colors } from '../ui/theme';
import { VaultsProvider } from '../wallet/VaultsContext';
import { WalletProvider } from '../wallet/WalletContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <WalletProvider>
          <VaultsProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          </VaultsProvider>
        </WalletProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
