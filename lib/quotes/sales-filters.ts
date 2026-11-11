// Satışlar (Cihaz) ekranı filtre konfigürasyonu — istemci (FilterBar) ve /api/sales/list ortak.
import type { FilterOption, PageFilterConfig } from '@/lib/filters/schema';

export const SALES_STATUS_OPTIONS: FilterOption[] = [
  { value: 'active', label: 'Aktif satışlar' },
  { value: 'cancelled', label: 'İptal edilenler' },
];

export const SALES_PAGE_SIZE = 100;

/** ownerOptions verilmezse (seçenekler yüklenmeden) URL'deki satıcı değeri korunur. */
export function salesFilterConfig(ownerOptions?: FilterOption[], opts: { withOwner?: boolean } = {}): PageFilterConfig {
  const withOwner = opts.withOwner !== false;
  return {
    keys: withOwner ? ['period', 'from', 'to', 'department', 'owner', 'status', 'q'] : ['period', 'from', 'to', 'department', 'status', 'q'],
    defaults: { period: 'this_year' },
    labels: { q: 'Ara (müşteri / teklif no)' },
    options: { status: SALES_STATUS_OPTIONS, ...(ownerOptions ? { owner: ownerOptions } : {}) },
  };
}
