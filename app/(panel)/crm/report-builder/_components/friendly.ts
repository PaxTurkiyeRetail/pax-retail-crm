// İş kullanıcısı katmanı: dataset/ölçü/kırılım jargonu yerine sade Türkçe adlar, varsayılanlar, hazır raporlar.
// Yalnız arayüz eşlemesi — semantic layer (lib/report-builder/datasets.ts) değişmez.
import {
  Activity, Building2, FileText, Package, Phone, Receipt, ShoppingCart, TrendingUp, type LucideIcon,
} from 'lucide-react';
import type { ColorToken } from '@/lib/report-builder/page-types';
import type { ReportDefinitionInput, TimeGrain } from '@/lib/report-builder/types';
import { ApiFailure } from './api';

export type DatasetUi = {
  title: string;
  desc: string;
  icon: LucideIcon;
  tone: ColorToken;
  /** Adım 2 açılışında seçili gelen ölçüler. */
  measures: string[];
  /** "Neye göre grupla?" hızlı chip'leri (sırayla drill-down önerisi). */
  groups: string[];
  /** Açılışta seçili grup. */
  defaultGroup: string;
  /** false: dönem filtresi varsayılan "Tümü" (ör. müşteri havuzu anlık durum). */
  dated: boolean;
};

export const DATASET_UI: Record<string, DatasetUi> = {
  sales: { title: 'Satışlar', desc: 'Kapanan satışlar: cihaz adedi, ciro, firma sayısı.', icon: ShoppingCart, tone: 'success', measures: ['device_count', 'amount_usd'], groups: ['sale_date', 'owner', 'customer', 'department', 'sales_channel', 'sale_type'], defaultGroup: 'sale_date', dated: true },
  sale_items: { title: 'Ürün / model satışları', desc: 'Hangi model kaç adet satıldı, kim sattı.', icon: Package, tone: 'info', measures: ['device_quantity'], groups: ['product_code', 'sale_date', 'owner', 'customer', 'item_sale_type', 'department'], defaultGroup: 'product_code', dated: true },
  forecast: { title: 'Forecast', desc: 'Satışçıların gelecek ay tahminleri ve olasılıkları.', icon: TrendingUp, tone: 'warning', measures: ['quantity', 'weighted_quantity'], groups: ['forecast_month', 'probability', 'owner', 'product', 'customer', 'department'], defaultGroup: 'forecast_month', dated: true },
  quotes: { title: 'Teklifler', desc: 'Verilen teklifler, tutarları ve kazanılanlar.', icon: FileText, tone: 'accent', measures: ['quote_count', 'won_count'], groups: ['proposal_date', 'status', 'owner', 'customer', 'department', 'closed_reason'], defaultGroup: 'proposal_date', dated: true },
  activities: { title: 'Aktiviteler', desc: 'Telefon, ziyaret, toplantı — kim kiminle görüştü.', icon: Phone, tone: 'primary', measures: ['activity_count', 'customer_count'], groups: ['activity_date', 'channel', 'created_by', 'customer', 'department'], defaultGroup: 'activity_date', dated: true },
  customers: { title: 'Müşteriler', desc: 'Müşteri havuzu: faz, sorumlu, sektör dağılımı.', icon: Building2, tone: 'neutral', measures: ['customer_count'], groups: ['phase_group', 'customer_owner', 'sector', 'department', 'created_date'], defaultGroup: 'phase_group', dated: false },
  service_invoice_items: { title: 'Hizmet faturaları (KasaPOS)', desc: 'Aylık hizmet faturası adet ve tutarları.', icon: Receipt, tone: 'danger', measures: ['quantity', 'total_usd'], groups: ['period_month', 'customer', 'owner', 'service_label', 'department'], defaultGroup: 'period_month', dated: true },
};

export const FALLBACK_UI: DatasetUi = { title: '', desc: '', icon: Activity, tone: 'neutral', measures: [], groups: [], defaultGroup: '', dated: true };

export function uiFor(key: string): DatasetUi { return DATASET_UI[key] ?? FALLBACK_UI; }

/** Tarih kırılımı chip adı: "Ay" vb. */
export const GRAIN_CHIP: Record<TimeGrain, string> = { day: 'Gün', week: 'Hafta', month: 'Ay', quarter: 'Çeyrek', year: 'Yıl' };

export type PeriodKey = 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_year' | 'last_12m' | 'custom';
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'this_month', label: 'Bu ay' }, { key: 'last_month', label: 'Geçen ay' }, { key: 'this_quarter', label: 'Bu çeyrek' },
  { key: 'this_year', label: 'Bu yıl' }, { key: 'last_12m', label: 'Son 12 ay' }, { key: 'last_year', label: 'Geçen yıl' }, { key: 'all', label: 'Tümü' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function periodToRange(key: PeriodKey, field?: string): ReportDefinitionInput['dateRange'] {
  if (key === 'all' || key === 'custom') return undefined;
  if (key === 'last_12m') {
    const to = new Date(); const from = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate() + 1);
    return { type: 'absolute', from: iso(from), to: iso(to), field };
  }
  return { type: 'relative', preset: key, field };
}

export function rangeToPeriod(r: ReportDefinitionInput['dateRange']): PeriodKey {
  if (!r) return 'all';
  if (r.type === 'relative') return (PERIODS.find((p) => p.key === r.preset)?.key ?? 'custom') as PeriodKey;
  return 'custom';
}

/** Tarih kovasının (ay/çeyrek…) bitişini bulur — drill-down'da tarih aralığına çevirmek için. */
export function bucketRange(value: unknown, grain: TimeGrain): { from: string; to: string } | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = grain === 'day' ? new Date(y, m - 1, d)
    : grain === 'week' ? new Date(y, m - 1, d + 6)
    : grain === 'month' ? new Date(y, m, 0)
    : grain === 'quarter' ? new Date(y, m + 2, 0)
    : new Date(y, 11, 31);
  return { from: iso(start), to: iso(end) };
}

export function defaultDefinition(datasetKey: string, catalogMeasures: string[], catalogDims: { key: string; type: string }[], defaultDateField?: string): ReportDefinitionInput {
  const ui = uiFor(datasetKey);
  const measures = ui.measures.filter((m) => catalogMeasures.includes(m));
  const g = catalogDims.find((d) => d.key === ui.defaultGroup) ?? null;
  return {
    dataset: datasetKey,
    measures: measures.length ? measures : catalogMeasures.slice(0, 1),
    dimensions: g ? [{ field: g.key, ...(g.type === 'date' ? { grain: 'month' as const } : {}) }] : [],
    filters: [], calculated: [], sort: [], limit: 500, compare: 'none', department: 'all',
    dateRange: ui.dated ? periodToRange('this_year', defaultDateField) : undefined,
    visualization: { type: g?.type === 'date' ? 'bar' : 'table' },
  };
}

/** Tek tıkla açılan hazır raporlar (sihirbaza dolu gelir). */
export const QUICK_REPORTS: { key: string; title: string; desc: string; def: ReportDefinitionInput }[] = [
  { key: 'q_sales_month', title: 'Aylık cihaz satışı', desc: 'Bu yıl her ay kaç cihaz sattık, geçen yılla kıyas.', def: { dataset: 'sales', measures: ['device_count'], dimensions: [{ field: 'sale_date', grain: 'month' }], dateRange: { type: 'relative', preset: 'this_year' }, compare: 'yoy', visualization: { type: 'bar' } } },
  { key: 'q_seller', title: 'Satışçı karnesi', desc: 'Satışçı bazında cihaz, ciro ve firma sayısı.', def: { dataset: 'sales', measures: ['device_count', 'amount_usd', 'customer_count'], dimensions: [{ field: 'owner' }], dateRange: { type: 'relative', preset: 'this_year' }, sort: [{ field: 'device_count', dir: 'desc' }], visualization: { type: 'table' } } },
  { key: 'q_top_models', title: 'En çok satan 10 model', desc: 'Bu yıl en çok satılan cihaz modelleri.', def: { dataset: 'sale_items', measures: ['device_quantity'], dimensions: [{ field: 'product_code' }], dateRange: { type: 'relative', preset: 'this_year' }, sort: [{ field: 'device_quantity', dir: 'desc' }], limit: 10, visualization: { type: 'bar' } } },
  { key: 'q_forecast', title: 'Forecast olasılık dağılımı', desc: 'Tahminler %30 / %60 / %90 olasılığa göre.', def: { dataset: 'forecast', measures: ['quantity'], dimensions: [{ field: 'probability' }], dateRange: { type: 'relative', preset: 'this_year' }, visualization: { type: 'pie' } } },
  { key: 'q_quotes', title: 'Teklif durumu', desc: 'Açık / kapalı teklifler ve tutarları.', def: { dataset: 'quotes', measures: ['quote_count', 'total_amount'], dimensions: [{ field: 'status' }], dateRange: { type: 'relative', preset: 'this_year' }, visualization: { type: 'table' } } },
  { key: 'q_activity', title: 'Aktivite tipleri', desc: 'Bu ay telefon, ziyaret, toplantı sayıları.', def: { dataset: 'activities', measures: ['activity_count'], dimensions: [{ field: 'channel' }], dateRange: { type: 'relative', preset: 'this_month' }, visualization: { type: 'pie' } } },
];

export const TEMPLATE_DESC: Record<string, string> = {
  retail_operasyon: 'Canlı satış, fırsat, KasaPOS ve CRM havuzu tek sayfada.',
  kasapos_entegrasyon: 'KasaPOS entegrasyon faturaları: firma × ay adet ve tutar.',
};

/** API hatasını iş kullanıcısının anlayacağı Türkçeye çevirir. */
export function friendlyError(e: unknown): string {
  if (e instanceof ApiFailure) {
    if (e.status === 401) return 'Oturumunuz sona ermiş. Sayfayı yenileyip tekrar giriş yapın.';
    if (e.status === 403) return 'Bu veriyi görme yetkiniz yok. Gerekirse yöneticinizden yetki isteyin.';
    if (e.status === 404) return 'Aradığınız rapor bulunamadı; silinmiş veya sizinle paylaşılmamış olabilir.';
    if (e.status === 400) return `Seçimlerde bir sorun var${e.details?.length ? `: ${e.details.slice(0, 2).join('; ')}` : '. Ölçü ve gruplamayı kontrol edin.'}`;
    if (e.status >= 500) return 'Sunucu şu an raporu hazırlayamadı. Biraz sonra tekrar deneyin; sürerse dönemi daraltın.';
    return e.message;
  }
  if (e instanceof TypeError) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  return (e as Error)?.message || 'Beklenmeyen bir hata oluştu.';
}
