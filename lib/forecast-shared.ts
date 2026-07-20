/**
 * Forecast tarafında hem browser hem de server tarafından kullanılabilen saf sabitler ve yardımcılar.
 * Bu dosyada DB, fs, server-only veya Node.js API importu bulunmamalıdır.
 */
export const FORECAST_SALES_CHANNEL_GROUP = 'forecast_sales_channel';
export const FORECAST_PROBABILITY_GROUP = 'forecast_probability';

export const FORECAST_MONTHS = [
  { value: 1, label: 'Ocak' },
  { value: 2, label: 'Şubat' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' },
  { value: 5, label: 'Mayıs' },
  { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' },
  { value: 8, label: 'Ağustos' },
  { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' },
  { value: 11, label: 'Kasım' },
  { value: 12, label: 'Aralık' },
] as const;

export const DEFAULT_FORECAST_CHANNELS = [
  { label: 'Banka', value: 'Banka' },
  { label: 'Direkt Satış', value: 'Direkt Satis' },
  { label: 'Kanal', value: 'Kanal' },
];

export const DEFAULT_FORECAST_PROBABILITIES = [
  { label: '%30', value: '30' },
  { label: '%60', value: '60' },
  { label: '%90', value: '90' },
];

export function monthLabel(month: number, year?: number | string | null) {
  const label = FORECAST_MONTHS.find((item) => item.value === Number(month))?.label ?? '-';
  return year ? `${label} ${year}` : label;
}

export function currentForecastYear() {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric' }).format(new Date()));
}

export function currentForecastMonth() {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', month: '2-digit' }).format(new Date()));
}

export function toPositiveInt(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function sanitizeLike(value: unknown) {
  return String(value ?? '').replace(/[\\%_]/g, ' ').trim();
}

export function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/i\u0307/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function canSeeAllForecasts(role: string | null | undefined) {
  const normalized = String(role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized === 'super_admin' || normalized === 'admin';
}

export function samePersonName(a: unknown, b: unknown) {
  return normalizeText(a) === normalizeText(b);
}

export function buildForecastYears() {
  const base = currentForecastYear();
  return Array.from({ length: 6 }, (_, index) => base + index);
}
