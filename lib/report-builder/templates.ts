// SAYFA ŞABLONLARI — mevcut elle yazılmış raporların tanım JSON'uyla yeniden üretimi (kanıt).
//  * retail_operasyon: lib/reports/retail-operasyon (canlı satış, fırsat/forecast, KasaPOS, CRM havuzu)
//  * kasapos_entegrasyon: lib/reports/kasapos-entegrasyon (aylık adet/tutar ısı tablosu)
// Fark notları DESIGN.md §8'de: mevcut retail raporu cihaz adedini yalnız kalemlerden sayar; burada
// tek tanım (kalem varsa kalem, yoksa device_count) kullanılır.
import { parsePageDefinition, type PageDefinition } from '@/lib/report-builder/page-types';

// Retail ayrımı sayfa bazlı `department: 'Retail'` ile yapılır (kişi bazlı değil); görüntüleyen Tümü/Bank/Vertical seçebilir.
const RETAIL = [] as const;

const retailOperasyon = {
  version: 1,
  title: 'Retail Operasyon Paneli',
  subtitle: 'Canlı satış, fırsat, KasaPOS ve CRM havuzu',
  theme: { accent: 'primary', density: 'compact' },
  department: 'Retail',
  filters: [
    { key: 'period', label: 'Dönem', kind: 'date_range', defaultValue: 'this_year' },
    { key: 'owner', label: 'Satıcı', kind: 'select', field: 'owner' },
  ],
  widgets: [
    { id: 'h1', type: 'text', variant: 'heading', text: 'Retail Operasyon Paneli', layout: { lg: { x: 0, y: 0, w: 8, h: 1 } } },
    { id: 'f_period', type: 'filter', filterKey: 'period', layout: { lg: { x: 8, y: 0, w: 2, h: 1 } }, pdf: { hideInPdf: true, pageBreakBefore: false } },
    { id: 'f_owner', type: 'filter', filterKey: 'owner', layout: { lg: { x: 10, y: 0, w: 2, h: 1 } }, pdf: { hideInPdf: true, pageBreakBefore: false } },
    {
      id: 'kpi_sales', type: 'kpi_strip', title: 'Canlı satış', layout: { lg: { x: 0, y: 1, w: 12, h: 2 } },
      query: { dataset: 'sales', measures: ['device_count', 'amount_usd', 'sale_count', 'customer_count'], filters: RETAIL, dateRange: { type: 'relative', preset: 'this_year' }, compare: 'yoy', visualization: { type: 'kpi' } },
    },
    {
      id: 'sales_month', type: 'bar', title: 'Aylık cihaz satışı', layout: { lg: { x: 0, y: 3, w: 8, h: 5 } }, style: { accent: 'success' },
      query: { dataset: 'sales', measures: ['device_count'], dimensions: [{ field: 'sale_date', grain: 'month' }], filters: RETAIL, dateRange: { type: 'relative', preset: 'this_year' }, visualization: { type: 'bar' } },
    },
    {
      id: 'opportunity', type: 'pie', title: 'Fırsat — olasılık dağılımı', layout: { lg: { x: 8, y: 3, w: 4, h: 5 } },
      query: { dataset: 'forecast', measures: ['quantity'], dimensions: [{ field: 'probability' }], filters: RETAIL, visualization: { type: 'pie' } },
    },
    {
      id: 'seller_table', type: 'table', title: 'Satıcı bazında', layout: { lg: { x: 0, y: 8, w: 12, h: 6 } },
      style: { density: 'compact', conditional: [{ column: 'c_conversion', op: 'lt', value: 20, color: 'danger' }, { column: 'c_conversion', op: 'gte', value: 50, color: 'success' }] },
      query: {
        dataset: 'sales', measures: ['device_count', 'amount_usd', 'customer_count'], dimensions: [{ field: 'owner' }], filters: RETAIL,
        dateRange: { type: 'relative', preset: 'this_year' },
        calculated: [{ key: 'share', label: 'Pay %', formula: 'SHARE([device_count])', format: 'percent' }, { key: 'conversion', label: 'Ort. cihaz/firma', formula: 'DIV([device_count], [customer_count])' }],
        sort: [{ field: 'device_count', dir: 'desc' }], visualization: { type: 'table' },
      },
    },
    {
      id: 'kasapos_heat', type: 'heatmap', title: 'KasaPOS — aylık adet (yeşil gerçekleşen / sarı tahmin)', layout: { lg: { x: 0, y: 14, w: 12, h: 6 } }, pdf: { hideInPdf: false, pageBreakBefore: true },
      query: { dataset: 'service_invoice_items', measures: ['quantity'], dimensions: [{ field: 'customer' }, { field: 'period_month', grain: 'month' }], filters: [{ field: 'is_integration_device', op: 'eq', value: true }], dateRange: { type: 'relative', preset: 'this_year' }, visualization: { type: 'heatmap', pivotColumn: 'period_month' } },
      forecastQuery: { dataset: 'forecast', measures: ['quantity'], dimensions: [{ field: 'customer' }, { field: 'forecast_month', grain: 'month' }], filters: RETAIL, dateRange: { type: 'relative', preset: 'this_year' }, visualization: { type: 'heatmap', pivotColumn: 'forecast_month' } },
    },
    {
      id: 'pool', type: 'pivot', title: 'CRM havuzu — faz grubu × sorumlu', layout: { lg: { x: 0, y: 20, w: 12, h: 6 } },
      query: { dataset: 'customers', measures: ['customer_count'], dimensions: [{ field: 'customer_owner' }, { field: 'phase_group' }], filters: RETAIL, visualization: { type: 'pivot', pivotColumn: 'phase_group' } },
    },
  ],
};

const kasaposEntegrasyon = {
  version: 1,
  title: 'KasaPOS Entegrasyon Raporu',
  subtitle: 'Hizmet faturaları — aylık adet ve tutar',
  filters: [{ key: 'period', label: 'Yıl', kind: 'date_range', defaultValue: 'this_year' }],
  widgets: [
    {
      id: 'kpi', type: 'kpi_strip', title: 'Özet', layout: { lg: { x: 0, y: 0, w: 12, h: 2 } },
      query: { dataset: 'service_invoice_items', measures: ['quantity', 'total_usd', 'customer_count'], filters: [{ field: 'is_integration_device', op: 'eq', value: true }], dateRange: { type: 'relative', preset: 'this_year' }, visualization: { type: 'kpi' } },
    },
    {
      id: 'monthly', type: 'heatmap', title: 'Firma × ay (adet)', layout: { lg: { x: 0, y: 2, w: 12, h: 8 } },
      query: { dataset: 'service_invoice_items', measures: ['quantity'], dimensions: [{ field: 'customer' }, { field: 'period_month', grain: 'month' }], filters: [{ field: 'is_integration_device', op: 'eq', value: true }], dateRange: { type: 'relative', preset: 'this_year' }, limit: 5000, visualization: { type: 'heatmap', pivotColumn: 'period_month' } },
    },
    {
      id: 'amount', type: 'table', title: 'Firma bazında tutar', layout: { lg: { x: 0, y: 10, w: 12, h: 6 } },
      query: {
        dataset: 'service_invoice_items', measures: ['quantity', 'total_usd'], dimensions: [{ field: 'customer' }, { field: 'owner' }],
        filters: [{ field: 'is_integration_device', op: 'eq', value: true }], dateRange: { type: 'relative', preset: 'this_year' },
        calculated: [{ key: 'unit', label: 'Ort. birim (USD)', formula: 'ROUND(DIV([total_usd], [quantity]), 2)', format: 'money' }, { key: 'rank', label: 'Sıra', formula: 'RANK([quantity])' }],
        sort: [{ field: 'quantity', dir: 'desc' }], visualization: { type: 'table' },
      },
    },
  ],
};

export const PAGE_TEMPLATES: Readonly<Record<string, { label: string; build: () => PageDefinition }>> = Object.freeze({
  retail_operasyon: { label: 'Retail Operasyon Paneli', build: () => parsePageDefinition(retailOperasyon) },
  kasapos_entegrasyon: { label: 'KasaPOS Entegrasyon Raporu', build: () => parsePageDefinition(kasaposEntegrasyon) },
});

export function getPageTemplate(key: string): PageDefinition | null {
  return Object.prototype.hasOwnProperty.call(PAGE_TEMPLATES, key) ? PAGE_TEMPLATES[key].build() : null;
}
