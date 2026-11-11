// Forecast Raporu filtre konfigürasyonu — istemci (FilterBar) ve /api/reports/forecast ortak.
import type { FilterOption, PageFilterConfig } from '@/lib/filters/schema';

/** Sayfaya özel filtreler (FilterBar dışı, URL'de). */
export const FORECAST_EXTRA_KEYS = ['channel', 'probability', 'year', 'month'] as const;

export function forecastFilterConfig(ownerOptions?: FilterOption[]): PageFilterConfig {
  return {
    keys: ['department', 'owner', 'q'],
    labels: { owner: 'Satıcı (Account sahibi)', q: 'Ara (müşteri / ürün / sektör)' },
    options: ownerOptions ? { owner: ownerOptions } : {},
  };
}
