import type { Lang } from '../i18n';

export const shortAddress = (address: string, chars = 4) => `${address.slice(0, chars)}…${address.slice(-chars)}`;

export const formatSol = (amount: number, digits = 4) => amount.toFixed(digits);

/** Human duration like "2 min", "3 h 5 min" or "12 days". */
export function formatDuration(ms: number, lang: Lang): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    const d = lang === 'pt' ? (days === 1 ? 'dia' : 'dias') : days === 1 ? 'day' : 'days';
    return hours > 0 ? `${days} ${d} ${hours} h` : `${days} ${d}`;
  }
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  return totalMinutes < 1 ? '< 1 min' : `${minutes} min`;
}

/** Timer length stored on-chain (seconds) shown in the plan's units. */
export function formatPeriod(seconds: number, lang: Lang): string {
  return formatDuration(seconds * 1000, lang);
}

export const formatDate = (ms: number, locale: string) =>
  new Date(ms).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
