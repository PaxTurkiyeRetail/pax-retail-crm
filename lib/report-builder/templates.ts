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

const kasaposMonthly = () => {
  const page = parsePageDefinition(kasaposEntegrasyon);
  page.title = 'KasaPOS Aylık Adet ve Gelir';
  page.subtitle = 'Düzenlenebilir firma × ay adet ve USD gelir raporu';
  page.pdf.orientation = 'landscape';
  // Ayrı pivotlar: renderer tek ölçü kullanır; ikinci ölçü görünmeden kaybolmamalı.
  const monthly = page.widgets.find((w) => w.id === 'monthly');
  if (monthly && 'query' in monthly) {
    monthly.type = 'pivot';
    monthly.title = 'Firma × ay · faturalanan kasa adedi';
    monthly.query.visualization.type = 'pivot';
    const revenue = structuredClone(monthly);
    revenue.id = 'monthly_usd';
    revenue.title = 'Firma × ay · hizmet geliri (USD)';
    revenue.query.measures = ['total_usd'];
    revenue.layout.lg.y = 10;
    revenue.pdf.pageBreakBefore = true;
    page.widgets.push(revenue);
    const trend = structuredClone(monthly);
    trend.id = 'monthly_revenue_trend';
    trend.type = 'line';
    trend.title = 'Aylık hizmet geliri (USD)';
    trend.query.measures = ['total_usd'];
    trend.query.dimensions = [{ field: 'period_month', grain: 'month' }];
    trend.query.sort = [{ field: 'period_month', dir: 'asc' }];
    trend.query.visualization = { type: 'line' };
    trend.layout.lg = { x: 0, y: 18, w: 12, h: 5 };
    page.widgets.push(trend);
    const quantityTrend = structuredClone(trend);
    quantityTrend.id = 'monthly_quantity_trend';
    quantityTrend.title = 'Aylık faturalanan kasa adedi';
    quantityTrend.query.measures = ['quantity'];
    quantityTrend.layout.lg.y = 23;
    page.widgets.push(quantityTrend);
  }
  const summary = page.widgets.find((w) => w.id === 'kpi');
  if (summary) summary.title = 'Seçilen dönem toplamı · kasa-ay adedi, USD gelir ve firma';
  // Dönem adedi stok değildir; karışık para biriminden ortalama USD fiyat üretme.
  page.widgets = page.widgets.filter((w) => w.id !== 'amount');
  page.widgets.push(...parsePageDefinition({ version: 1, title: 'Anlık KasaPOS', widgets: [
    { id: 'snapshot_kpi', type: 'kpi_strip', title: 'Anlık operasyon · sayfa filtrelerinden bağımsız', ignorePageFilters: true,
      layout: { lg: { x: 0, y: 28, w: 12, h: 2 } },
      query: { dataset: 'kasapos_snapshot', measures: ['active_registers', 'billed_registers', 'monthly_usd', 'utilization_pct', 'opportunity_registers', 'potential_monthly_usd', 'known_stock_count', 'known_price_count'], visualization: { type: 'kpi' } } },
    { id: 'snapshot_firms', type: 'table', title: 'Anlık firma operasyonu · sayfa filtrelerinden bağımsız', ignorePageFilters: true,
      layout: { lg: { x: 0, y: 30, w: 12, h: 8 } },
      query: { dataset: 'kasapos_snapshot', measures: ['active_registers', 'billed_registers', 'utilization_pct', 'opportunity_registers', 'potential_monthly_usd', 'known_stock_count', 'known_price_count'],
        dimensions: [{ field: 'customer' }, { field: 'period_month', grain: 'month' }], sort: [{ field: 'utilization_pct', dir: 'desc' }], limit: 5000, visualization: { type: 'table' } } },
  ] }).widgets);
  page.widgets = page.widgets.filter((widget) => widget.type !== 'bar' && widget.type !== 'line');
  return parsePageDefinition(page);
};

const retailCustom = () => {
  const page = parsePageDefinition(retailOperasyon);
  page.title = 'Retail Yönetim Raporum';
  page.subtitle = 'Satış, Forecast, KasaPOS ve CRM bölümlerini ayrı ayrı özelleştir';
  page.widgets = page.widgets.filter((w) => w.id !== 'kasapos_heat');
  const heading = page.widgets.find((w) => w.id === 'h1');
  if (heading?.type === 'text') heading.text = page.title;
  const opportunity = page.widgets.find((w) => w.id === 'opportunity');
  const monthlySales = page.widgets.find((w) => w.id === 'sales_month');
  if (monthlySales && 'query' in monthlySales) { monthlySales.type = 'table'; monthlySales.query.visualization.type = 'table'; }
  if (opportunity && 'query' in opportunity) opportunity.query.dateRange = { type: 'relative', preset: 'this_year' };
  const pool = page.widgets.find((w) => w.id === 'pool');
  if (pool && 'query' in pool) {
    pool.layout.lg.y = 14;
    // CRM havuzu anlık stoktur; raporun dönem filtresi müşteri oluşturulma tarihine dönüşmemeli.
    pool.ignorePageFilters = true;
    pool.query.department = 'Retail';
    pool.title = 'CRM havuzu · mevcut müşteri dağılımı';
  }
  page.pdf.orientation = 'landscape';
  for (const widget of page.widgets) {
    if (!('query' in widget)) continue;
    widget.query.department = 'Retail';
    widget.tab = widget.id === 'opportunity' ? 'forecast' : widget.id === 'pool' ? 'pool' : 'overview';
    widget.layout.lg.y += 1;
    if (widget.id === 'opportunity' || widget.id === 'pool') widget.layout.lg = { x: 0, y: 2, w: 12, h: 6 };
  }
  page.widgets.push(...parsePageDefinition({ version: 1, title: page.title, widgets: [
    { id: 'sections', type: 'tabs', layout: { lg: { x: 0, y: 1, w: 12, h: 1 } }, tabs: [
      { key: 'overview', label: 'Genel bakış' }, { key: 'sales', label: 'Satış ve modeller' },
      { key: 'forecast', label: 'Forecast' }, { key: 'kasapos', label: 'KasaPOS' }, { key: 'pool', label: 'Müşteri havuzu' },
    ] },
    { id: 'model_customer', type: 'table', tab: 'sales', title: 'Model × müşteri · adet ve USD tutarı',
      layout: { lg: { x: 0, y: 2, w: 12, h: 8 } },
      query: { dataset: 'sale_items', department: 'Retail', measures: ['quantity', 'total_usd'],
        dimensions: [{ field: 'product_code' }, { field: 'customer' }, { field: 'owner' }, { field: 'item_sale_type' }],
        dateRange: { type: 'relative', preset: 'this_year' }, sort: [{ field: 'quantity', dir: 'desc' }], limit: 5000, visualization: { type: 'table' } } },
    { id: 'sale_rental', type: 'table', tab: 'sales', title: 'Dönem işlemleri · satış / kiralama (mevcut kiralık stok değildir)',
      layout: { lg: { x: 0, y: 10, w: 12, h: 5 } },
      query: { dataset: 'sale_items', department: 'Retail', measures: ['quantity', 'total_usd', 'sale_count', 'customer_count'],
        dimensions: [{ field: 'item_sale_type' }], dateRange: { type: 'relative', preset: 'this_year' }, visualization: { type: 'table' } } },
    { id: 'forecast_detail', type: 'table', tab: 'forecast', title: 'Forecast · müşteri ve ürün fırsatları',
      layout: { lg: { x: 0, y: 8, w: 12, h: 8 } },
      query: { dataset: 'forecast', department: 'Retail', measures: ['quantity', 'weighted_quantity'],
        dimensions: [{ field: 'customer' }, { field: 'product' }, { field: 'owner' }, { field: 'probability' }, { field: 'forecast_month', grain: 'month' }],
        dateRange: { type: 'relative', preset: 'this_year' }, limit: 5000, visualization: { type: 'table' } } },
  ] }).widgets);
  let kasaY = 2;
  for (const widget of kasaposMonthly().widgets) {
    if (!('query' in widget)) continue;
    widget.id = `retail_${widget.id}`;
    widget.tab = 'kasapos';
    widget.query.department = 'Retail';
    widget.layout.lg = { x: 0, y: kasaY, w: 12, h: widget.layout.lg.h };
    kasaY += widget.layout.lg.h;
    page.widgets.push(widget);
  }
  page.widgets.sort((a, b) => a.layout.lg.y - b.layout.lg.y || a.layout.lg.x - b.layout.lg.x);
  return parsePageDefinition(page);
};

export const PAGE_TEMPLATES: Readonly<Record<string, { label: string; build: () => PageDefinition }>> = Object.freeze({
  retail_operasyon: { label: 'Retail Operasyon Paneli', build: () => parsePageDefinition(retailOperasyon) },
  kasapos_entegrasyon: { label: 'KasaPOS Entegrasyon Raporu', build: () => parsePageDefinition(kasaposEntegrasyon) },
  kasapos_monthly: { label: 'KasaPOS Aylık Adet ve Gelir', build: kasaposMonthly },
  retail_custom: { label: 'Retail Yönetim Raporum', build: retailCustom },
});

export function getPageTemplate(key: string): PageDefinition | null {
  return Object.prototype.hasOwnProperty.call(PAGE_TEMPLATES, key) ? PAGE_TEMPLATES[key].build() : null;
}
