import { FORECAST_MONTHS, monthLabel, normalizeText } from '@/lib/forecast-shared';

export const BLOCKER_CATEGORIES = [
  { value: 'customer_decision', label: 'Müşteri kararı bekleniyor' },
  { value: 'pricing', label: 'Fiyat / teklif' },
  { value: 'technical', label: 'Teknik çalışma' },
  { value: 'integration', label: 'Entegrasyon' },
  { value: 'contract_legal', label: 'Sözleşme / hukuk' },
  { value: 'bank_partner', label: 'Banka veya iş ortağı' },
  { value: 'stock_supply', label: 'Stok / tedarik' },
  { value: 'internal_approval', label: 'İç onay' },
  { value: 'operation', label: 'Operasyon' },
  { value: 'other', label: 'Diğer' },
] as const;

export const RESOLUTION_OWNER_TYPES = [
  { value: 'internal', label: 'İç ekip' },
  { value: 'customer', label: 'Müşteri' },
  { value: 'bank', label: 'Banka' },
  { value: 'partner', label: 'İş ortağı' },
  { value: 'other', label: 'Diğer' },
] as const;

export type BlockerStatus = 'pending' | 'no_blocker' | 'open' | 'in_progress' | 'overdue' | 'resolved';

export function categoryLabel(value: unknown) {
  return BLOCKER_CATEGORIES.find((item) => item.value === String(value ?? ''))?.label ?? 'Diğer';
}

export function ownerTypeLabel(value: unknown) {
  return RESOLUTION_OWNER_TYPES.find((item) => item.value === String(value ?? ''))?.label ?? '-';
}

export function statusLabel(value: unknown) {
  const status = String(value ?? '') as BlockerStatus;
  if (status === 'pending') return 'Yanıt Bekliyor';
  if (status === 'no_blocker') return 'Engel Yok';
  if (status === 'open') return 'Açık Engel';
  if (status === 'in_progress') return 'Çözüm Devam Ediyor';
  if (status === 'overdue') return 'Çözüm Tarihi Geçti';
  if (status === 'resolved') return 'Çözüldü';
  return 'Yanıt Bekliyor';
}

export function isMissingForecastBlockerRelation(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '');
  return /relation .*crm_forecast_blockers.* does not exist/i.test(message)
    || /relation .*v_crm_forecast_blocker_impact.* does not exist/i.test(message)
    || /Could not find the table/i.test(message);
}

export function isForecastBlockerMigrationMismatch(error: unknown) {
  const code = String((error as any)?.code ?? '');
  const message = String((error as any)?.message ?? error ?? '');
  return code === '23502'
    && /crm_forecast_blocker_history/i.test(message)
    && /forecast_id/i.test(message);
}

export function isLaterPeriod(baseYear: number, baseMonth: number, shiftYear: number, shiftMonth: number) {
  return shiftYear * 100 + shiftMonth > baseYear * 100 + baseMonth;
}

export function periodLabel(year: unknown, month: unknown) {
  const y = Number(year ?? 0);
  const m = Number(month ?? 0);
  return y > 0 && FORECAST_MONTHS.some((item) => item.value === m) ? monthLabel(m, y) : '-';
}

export function isoDateOnly(value: unknown) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

export function matchesBlockerSearch(row: any, q: string) {
  if (!q) return true;
  const needle = normalizeText(q);
  return [
    row.musteri,
    row.sektor,
    row.sorumlu,
    row.product_code_snapshot,
    row.product_name_snapshot,
    JSON.stringify(row.forecast_options ?? []),
    row.blocker_description,
    row.resolution_owner_name,
  ].some((value) => normalizeText(value).includes(needle));
}
