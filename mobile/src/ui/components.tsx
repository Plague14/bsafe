import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, View, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { shortAddress } from './format';
import { colors, radius, space } from './theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function Screen({ title, subtitle, children, onRefresh, refreshing = false, right }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  right?: ReactNode;
}) {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.screen}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{title}</Text>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon, small, style }: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = variants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [s.button, small && s.buttonSmall, { backgroundColor: v.bg, borderColor: v.border }, (pressed || off) && { opacity: off ? 0.5 : 0.85 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} size="small" /> : icon ? <Ionicons name={icon} size={small ? 15 : 18} color={v.fg} /> : null}
      <Text style={[s.buttonText, small && { fontSize: 14 }, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.white, fg: colors.text, border: colors.border },
  danger: { bg: colors.white, fg: colors.danger, border: '#FECACA' },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: space(4) }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSoft}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        style={[s.input, error ? { borderColor: colors.danger } : null]}
      />
      {error ? <Text style={[s.hint, { color: colors.danger }]}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.segmented}>
      {options.map(o => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segment, o.value === value && s.segmentOn]}>
          <Text style={[s.segmentText, o.value === value && s.segmentTextOn]} numberOfLines={1}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Minus / value / plus control used for timers and counts. */
export function Stepper({ label, value, display, min, max, step = 1, onChange, hint }: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <View style={{ marginBottom: space(4) }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.stepper}>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.max(min, value - step))} disabled={value <= min}>
          <Ionicons name="remove" size={20} color={value <= min ? colors.textSoft : colors.primary} />
        </Pressable>
        <Text style={s.stepValue}>{display}</Text>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.min(max, value + step))} disabled={value >= max}>
          <Ionicons name="add" size={20} color={value >= max ? colors.textSoft : colors.primary} />
        </Pressable>
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray' }) {
  const t = tones[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const tones = {
  blue: { bg: colors.primarySoft, fg: colors.primaryDark },
  green: { bg: colors.successSoft, fg: colors.success },
  amber: { bg: colors.warningSoft, fg: colors.warning },
  red: { bg: colors.dangerSoft, fg: colors.danger },
  gray: { bg: '#F3F4F6', fg: colors.textMuted },
};

export function Notice({ text, tone = 'blue', icon = 'information-circle-outline' }: { text: string; tone?: 'blue' | 'amber' | 'green' | 'red'; icon?: IconName }) {
  const t = tones[tone];
  return (
    <View style={[s.notice, { backgroundColor: t.bg }]}>
      <Ionicons name={icon} size={18} color={t.fg} />
      <Text style={[s.noticeText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space(10) }}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={28} color={colors.primary} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      {action ? <View style={{ marginTop: space(5), alignSelf: 'stretch' }}>{action}</View> : null}
    </Card>
  );
}

/** Address in monospace with tap-to-copy. */
export function Address({ value, chars = 4, style, light }: { value: string; chars?: number; style?: StyleProp<ViewStyle>; light?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}
      onPress={async () => {
        await Clipboard.setStringAsync(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <Text style={[s.mono, light && { color: '#DBEAFE' }]}>{shortAddress(value, chars)}</Text>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? (light ? colors.white : colors.success) : light ? '#BFDBFE' : colors.textSoft} accessibilityLabel={copied ? t('common.copied') : t('common.copy')} />
    </Pressable>
  );
}

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Horizontal chips to pick which vault a tab works on. */
export function VaultChips({ items, selected, onSelect }: { items: { key: string; label: string }[]; selected?: string; onSelect: (key: string) => void }) {
  if (items.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space(4) }} contentContainerStyle={{ gap: space(2) }}>
      {items.map(i => (
        <Pressable key={i.key} onPress={() => onSelect(i.key)} style={[s.chip, i.key === selected && s.chipOn]}>
          <Text style={[s.chipText, i.key === selected && s.chipTextOn]}>{i.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Row({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      {children ?? <Text style={s.rowValue}>{value}</Text>}
    </View>
  );
}

export const text = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  small: { fontSize: 12, color: colors.textMuted },
  section: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space(2), marginTop: space(2) },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { padding: space(4), paddingBottom: space(12) },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space(4), marginTop: space(2) },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space(4), marginBottom: space(3) },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 18, borderRadius: radius.md, borderWidth: 1 },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text, backgroundColor: colors.white },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  segmented: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: radius.md, padding: 4, marginBottom: space(4) },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextOn: { color: colors.primary },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white },
  stepBtn: { paddingVertical: 12, paddingHorizontal: 18 },
  stepValue: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  notice: { flexDirection: 'row', gap: 8, padding: space(3), borderRadius: radius.md, marginBottom: space(3), alignItems: 'flex-start' },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space(3) },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: space(2) },
  mono: { fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo' }), fontSize: 13, color: colors.textMuted },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(5), paddingBottom: space(8), maxHeight: '88%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space(3) },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(4) },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: colors.text },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextOn: { color: colors.white },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 12 },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1, textAlign: 'right' },
});
