import type { TransactionInstruction } from '@solana/web3.js';
import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { explorerTx } from '../lib/config';
import { describeError } from '../lib/errors';
import { useI18n } from '../i18n';
import { useWallet } from './WalletContext';

/** Alerts raised while the wallet app is in front are dropped by Android: wait until BSafe is visible again. */
function whenActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise(resolve => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        sub.remove();
        resolve();
      }
    });
  });
}

type Build = () => TransactionInstruction | TransactionInstruction[] | Promise<TransactionInstruction | TransactionInstruction[]>;

/**
 * Runs one on-chain action: builds the instructions, sends them through the wallet,
 * reports the result and calls `onDone` (usually a refresh) on success.
 */
export function useAction() {
  const { send } = useWallet();
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(async (key: string, build: Build, onDone?: () => void | Promise<void>) => {
    setBusy(key);
    try {
      const built = await build();
      const signature = await send(Array.isArray(built) ? built : [built]);
      await onDone?.();
      await whenActive();
      Alert.alert(t('common.done'), undefined, [
        { text: t('common.viewTx'), onPress: () => Linking.openURL(explorerTx(signature)) },
        { text: 'OK' },
      ]);
      return signature;
    } catch (err) {
      console.warn(`[bsafe] ${key} failed`, err);
      await whenActive();
      Alert.alert(t('errors.generic'), describeError(err, lang));
      return null;
    } finally {
      setBusy(null);
    }
  }, [lang, send, t]);

  return { run, busy };
}
