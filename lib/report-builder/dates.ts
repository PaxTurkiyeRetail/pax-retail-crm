// Göreli/mutlak tarih aralığı çözümü (Europe/Istanbul günü). Saf fonksiyonlar — test edilebilir.
import type { DateRange, RelativePreset } from '@/lib/report-builder/types';
import { ReportDefinitionError } from '@/lib/report-builder/types';

export type ResolvedRange = { from: string; to: string };

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const addDays = (d: Date, n: number) => utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n);

export function istanbulToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // en-CA → YYYY-MM-DD
}

function parseIso(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  const date = utc(y, m - 1, d);
  if (Number.isNaN(date.getTime()) || toIso(date) !== value) throw new ReportDefinitionError(`Geçersiz tarih: ${value}`);
  return date;
}

export function resolvePreset(preset: RelativePreset, todayIso: string): ResolvedRange {
  const t = parseIso(todayIso);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const dow = (t.getUTCDay() + 6) % 7; // Pazartesi = 0
  const q = Math.floor(m / 3);
  switch (preset) {
    case 'today': return { from: todayIso, to: todayIso };
    case 'last_7_days': return { from: toIso(addDays(t, -6)), to: todayIso };
    case 'last_30_days': return { from: toIso(addDays(t, -29)), to: todayIso };
    case 'last_90_days': return { from: toIso(addDays(t, -89)), to: todayIso };
    case 'this_week': return { from: toIso(addDays(t, -dow)), to: toIso(addDays(t, 6 - dow)) };
    case 'last_week': return { from: toIso(addDays(t, -dow - 7)), to: toIso(addDays(t, -dow - 1)) };
    case 'this_month': return { from: toIso(utc(y, m, 1)), to: toIso(utc(y, m + 1, 0)) };
    case 'last_month': return { from: toIso(utc(y, m - 1, 1)), to: toIso(utc(y, m, 0)) };
    case 'this_quarter': return { from: toIso(utc(y, q * 3, 1)), to: toIso(utc(y, q * 3 + 3, 0)) };
    case 'last_quarter': return { from: toIso(utc(y, q * 3 - 3, 1)), to: toIso(utc(y, q * 3, 0)) };
    case 'this_year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case 'ytd': return { from: `${y}-01-01`, to: todayIso };
  }
}

export function resolveDateRange(range: DateRange, todayIso: string): ResolvedRange {
  if (range.type === 'relative') return resolvePreset(range.preset, todayIso);
  const from = parseIso(range.from);
  const to = parseIso(range.to);
  if (from > to) throw new ReportDefinitionError('Tarih aralığı: başlangıç bitişten büyük');
  if ((to.getTime() - from.getTime()) / 86_400_000 > 3660) throw new ReportDefinitionError('Tarih aralığı en fazla 10 yıl olabilir');
  return { from: range.from, to: range.to };
}

export type CompareShift = { range: ResolvedRange; interval: string };

/**
 * Karşılaştırma dönemi. `interval`, önceki dönemin tarih kırılımını cari döneme hizalamak için
 * SQL'de tarih ifadesine eklenir (ör. YoY: 2025-03 satırı 2026-03 anahtarıyla eşleşir).
 */
export function compareRange(range: ResolvedRange, mode: 'previous_period' | 'yoy'): CompareShift {
  const from = parseIso(range.from);
  const to = parseIso(range.to);
  if (mode === 'yoy') {
    const shiftYear = (d: Date) => toIso(utc(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate()));
    return { range: { from: shiftYear(from), to: shiftYear(to) }, interval: '1 year' };
  }
  // Tam ay aralığıysa ay bazında kaydır (ay kırılımı düzgün hizalansın), değilse gün bazında.
  const isMonthAligned = from.getUTCDate() === 1 && addDays(to, 1).getUTCDate() === 1;
  if (isMonthAligned) {
    const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) + 1;
    return {
      range: { from: toIso(utc(from.getUTCFullYear(), from.getUTCMonth() - months, 1)), to: toIso(utc(from.getUTCFullYear(), from.getUTCMonth(), 0)) },
      interval: `${months} months`,
    };
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return { range: { from: toIso(addDays(from, -days)), to: toIso(addDays(from, -1)) }, interval: `${days} days` };
}
