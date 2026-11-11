// Merkezi dönem çözümü (Europe/Istanbul). Saf fonksiyonlar; report-builder/dates mantığını yeniden kullanır.
import { istanbulToday, resolvePreset } from '@/lib/report-builder/dates';
import { dateKeyDiff } from '@/lib/activities/activity-date';

export const PERIOD_PRESETS = [
  'today', 'this_week', 'last_week', 'this_month', 'last_month', 'this_quarter', 'this_year', 'custom',
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Bugün',
  this_week: 'Bu hafta',
  last_week: 'Geçen hafta',
  this_month: 'Bu ay',
  last_month: 'Geçen ay',
  this_quarter: 'Bu çeyrek',
  this_year: 'Bu yıl',
  custom: 'Özel aralık',
};

export type ResolvedPeriod = { preset: PeriodPreset; from: string; to: string; label: string };

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isPeriodPreset(value: unknown): value is PeriodPreset {
  return typeof value === 'string' && (PERIOD_PRESETS as readonly string[]).includes(value);
}

/** '09–15 Kas 2026', '27 Eki – 02 Kas 2026', '29 Ara 2025 – 04 Oca 2026', tek gün '11 Kas 2026'. */
export function formatPeriodLabel(from: string, to: string): string {
  const [fy, fm, fd] = from.split('-');
  const [ty, tm, td] = to.split('-');
  const mon = (m: string) => MONTHS[Number(m) - 1];
  if (from === to) return `${fd} ${mon(fm)} ${fy}`;
  if (fy !== ty) return `${fd} ${mon(fm)} ${fy} – ${td} ${mon(tm)} ${ty}`;
  if (fm !== tm) return `${fd} ${mon(fm)} – ${td} ${mon(tm)} ${ty}`;
  return `${fd}–${td} ${mon(tm)} ${ty}`;
}

export type PeriodInput = { period?: PeriodPreset | null; from?: string | null; to?: string | null };

/**
 * Dönemi çözer. from/to (inclusive) geçerliyse custom; değilse preset; o da yoksa fallback (this_week).
 * now: test için sabit an; İstanbul gününe çevrilir.
 */
export function resolvePeriod(input: PeriodInput | PeriodPreset, now: Date = new Date(), fallback: Exclude<PeriodPreset, 'custom'> = 'this_week'): ResolvedPeriod {
  const inp: PeriodInput = typeof input === 'string' ? { period: input } : input;
  const today = istanbulToday(now);
  const hasCustom = isIsoDate(inp.from) && isIsoDate(inp.to) && dateKeyDiff(inp.from!, inp.to!) >= 0;
  if (hasCustom && (inp.period === 'custom' || !inp.period)) {
    return { preset: 'custom', from: inp.from!, to: inp.to!, label: formatPeriodLabel(inp.from!, inp.to!) };
  }
  const preset = inp.period && inp.period !== 'custom' && isPeriodPreset(inp.period) ? inp.period : fallback;
  const r = resolvePreset(preset, today);
  return { preset, from: r.from, to: r.to, label: formatPeriodLabel(r.from, r.to) };
}
