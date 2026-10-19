// SEMANTİK KATMAN — dataset registry (beyaz liste).
// Buradaki SQL parçaları yalnız geliştirici tarafından yazılır; kullanıcı girdisi ASLA buraya
// karışmaz. Derleyici yalnız bu anahtarları kabul eder, değerleri parametre ($n) olarak geçer.
//
// Metrik tanımları mevcut raporlardaki "doğru" tanımla hizalanmıştır (DESIGN.md §1.3):
//  - Satış: yalnız status='active'; tarih = sale_date.
//  - Cihaz adedi: kalem varsa crm_sale_item_is_device() kalemlerinin adedi, kalemsiz eski satışta
//    crm_sales.device_count (performance-report / live-board ile aynı).
//  - Aktivite: tarih = coalesce(aktivite_tarihi, created_at@Istanbul); planlanan "sonraki aksiyon"
//    kayıtları (Başlamadı + hedef tarihli) sayılmaz (weekly-targets / live-board ile aynı).
import { ACTIVITY_CHANNEL_OPTIONS } from '@/lib/activity-channels';
import { DURUM_CANONICAL } from '@/lib/activities/presentation';
import { ACTUAL_FORECAST_FROM } from './actual-forecast-source';
import type { Permission } from '@/lib/roles';
import { INTEGRATION_DEVICE_SERVICE_KEYS } from '@/lib/sales/service-invoices-shared';
import { RENTAL_OPS_STATUSES } from '@/lib/sales/rental-ops';
import type { TimeGrain } from '@/lib/report-builder/types';
import { PERFORMANCE_COMPARISON_FROM } from '@/lib/report-builder/performance-source';

export type FieldType = 'string' | 'number' | 'date' | 'boolean';

export type DimensionDef = {
  label: string;
  sql: string;
  type: FieldType;
  group?: string;
  description?: string;
  /** Tarih alanlarında izin verilen zaman kırılımları. */
  grains?: readonly TimeGrain[];
  /** Arayüzde öneri listesi (sabit kümeler). */
  options?: readonly string[];
};

export type MeasureDef = {
  label: string;
  /** Toplulaştırılmış SQL ifadesi (sum/count/avg/...). */
  sql: string;
  format: 'number' | 'money' | 'percent';
  description?: string;
};

export type OwnerColumns = {
  /** text'e çevrilmiş kanonik sahip id ifadesi. */
  userId: string;
  email?: string;
  name?: string;
};

export type DatasetDef = {
  key: string;
  label: string;
  description: string;
  /** Dataset'e erişim için gereken action permission (screen.* değil). */
  permission: Permission;
  /** Composite datasets require access to every underlying source. */
  requiredPermissions?: readonly Permission[];
  from: string;
  baseWhere: readonly string[];
  defaultDateField: string;
  owner: OwnerColumns;
  dimensions: Readonly<Record<string, DimensionDef>>;
  measures: Readonly<Record<string, MeasureDef>>;
};

const ALL_GRAINS: readonly TimeGrain[] = ['day', 'week', 'month', 'quarter', 'year'];
const DEVICE = 'public.crm_sale_item_is_device(i.product_type, i.is_recurring)';
const ACTIVITY_DATE = `coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date)`;
const ACTIVITY_LABEL = `nullif(trim(regexp_replace(coalesce(pe.aksiyon, ''), '^AKTIVITE:', '')), '')`;
// lib/activity-channels.ts normalizeChannel ile aynı eşleme.
const ACTIVITY_CHANNEL = `case
  when ${ACTIVITY_LABEL} in ('Telefon','Yerinde Ziyaret','Online Toplantı','Teknik Ziyaret','Teknik Online','POM','E-posta') then ${ACTIVITY_LABEL}
  when ${ACTIVITY_LABEL} in ('Entegrasyon Süreci','İş Ortaklığı Aktivitesi') then 'Entegrasyon Süreci'
  else 'Diğer' end`;
// app/api/reports/phase-report macroGroup ile aynı aralıklar.
const PHASE_GROUP = `case
  when mp.aktif_faz_no is null then 'Fazsız'
  when mp.aktif_faz_no between 1 and 4 then 'Fırsat'
  when mp.aktif_faz_no between 5 and 9 then 'İlk Temas'
  when mp.aktif_faz_no between 10 and 14 then 'Business'
  when mp.aktif_faz_no between 15 and 23 then 'Operasyon'
  when mp.aktif_faz_no between 24 and 25 then 'Yayılım'
  else 'Diğer' end`;

export const DEPARTMENTS = ['Retail', 'Vertical', 'Bank'] as const;

const customerDims = (alias = 'm'): Record<string, DimensionDef> => ({
  customer_id: { label: 'Müşteri kayıt kimliği', sql: `${alias}.id::text`, type: 'string', group: 'Kayıt bağlantıları' },
  customer: { label: 'Müşteri', sql: `${alias}.musteri`, type: 'string', group: 'Müşteri' },
  customer_owner: { label: 'Müşteri sorumlusu', sql: `coalesce(nullif(trim(${alias}.sorumlu), ''), 'Havuz')`, type: 'string', group: 'Müşteri' },
  sector: { label: 'Sektör', sql: `coalesce(nullif(trim(${alias}.sektor), ''), '—')`, type: 'string', group: 'Müşteri' },
  /** Departman = musteriler.is_kolu (kişi değil, departman bazlı ayrım). */
  department: { label: 'Departman', sql: `coalesce(nullif(trim(${alias}.is_kolu), ''), '—')`, type: 'string', group: 'Müşteri', options: DEPARTMENTS },
  /** Geriye uyum: eski anahtar; department ile aynı ifade. */
  business_line: { label: 'İş kolu', sql: `coalesce(nullif(trim(${alias}.is_kolu), ''), '—')`, type: 'string', group: 'Müşteri', options: DEPARTMENTS },
  customer_type: { label: 'Müşteri tipi', sql: `${alias}.customer_type`, type: 'string', group: 'Müşteri' },
});

const SALES: DatasetDef = {
  key: 'sales',
  label: 'Satışlar',
  description: 'Aktif satış kayıtları (satış başına bir satır). Ciro, cihaz adedi, satış kanalı.',
  permission: 'quote.read',
  from: `public.crm_sales s
    join public.musteriler m on m.id = s.customer_id
    left join lateral (
      select count(*)::int as n,
             coalesce(sum(i.quantity) filter (where ${DEVICE}), 0)::int as dev
      from public.crm_sale_items i where i.sale_id = s.id
    ) si on true`,
  baseWhere: [`s.status = 'active'`],
  defaultDateField: 'sale_date',
  owner: { userId: 's.owner_user_id::text', email: 's.owner_email', name: 's.owner_name' },
  dimensions: {
    sale_id: { label: 'Satış kayıt kimliği', sql: 's.id::text', type: 'string', group: 'Kayıt bağlantıları' },
    sale_date: { label: 'Satış tarihi', sql: 's.sale_date', type: 'date', grains: ALL_GRAINS, group: 'Satış' },
    owner: { label: 'Satıcı', sql: `coalesce(nullif(trim(s.owner_name), ''), 'Havuz Account')`, type: 'string', group: 'Satış' },
    sales_channel: { label: 'Satış kanalı', sql: `coalesce(s.sales_channel, '—')`, type: 'string', group: 'Satış' },
    source: { label: 'Kaynak', sql: 's.source', type: 'string', group: 'Satış', options: ['quote', 'direct'] },
    sale_type: { label: 'Satış tipi', sql: 's.sale_type', type: 'string', group: 'Satış', options: ['sale', 'rental', 'mixed'], description: 'mixed: satış ve kiralama kalemleri aynı kayıtta.' },
    rental_start_date: { label: 'Kiralama başlangıç tarihi', sql: 's.rental_start_date', type: 'date', grains: ALL_GRAINS, group: 'Kiralama', description: 'Satış kaydındaki kiralama döneminin başlangıcı; kiralama yoksa boştur.' },
    rental_end_date: { label: 'Kiralama bitiş tarihi', sql: 's.rental_end_date', type: 'date', grains: ALL_GRAINS, group: 'Kiralama', description: 'Satış kaydındaki kiralama döneminin bitişi; kiralama yoksa boştur.' },
    rental_ops_status: { label: 'Kiralama operasyon durumu', sql: `case when s.sale_type in ('rental', 'mixed') then coalesce(s.rental_ops_status, 'hazirlik') end`, type: 'string', group: 'Kiralama', options: RENTAL_OPS_STATUSES.map(s => s.value), description: 'Kiralama veya karma satışın operasyon aşaması. Boş kiralama durumu Hazırlık sayılır; normal satışlarda boştur.' },
    currency: { label: 'Para birimi', sql: 's.currency', type: 'string', group: 'Satış' },
    price_source: { label: 'Fiyat kaynağı', sql: 's.price_source', type: 'string', group: 'Satış', options: ['catalog', 'manual'] },
    quote_no: { label: 'Teklif no', sql: 's.quote_no', type: 'string', group: 'Satış' },
    ...customerDims(),
  },
  measures: {
    sale_count: { label: 'Satış adedi', sql: 'count(*)', format: 'number' },
    amount_usd: { label: 'Ciro (USD)', sql: `coalesce(sum(s.amount) filter (where s.currency = 'USD'), 0)`, format: 'money', description: 'Yalnız USD satışlar' },
    amount_total: { label: 'Ciro (tüm para birimleri)', sql: 'coalesce(sum(s.amount), 0)', format: 'money', description: 'Para birimi karışık — kırılımda currency kullanın' },
    avg_amount: { label: 'Ortalama satış tutarı', sql: 'avg(s.amount)', format: 'money' },
    device_count: { label: 'Cihaz adedi', sql: 'coalesce(sum(case when si.n > 0 then si.dev else s.device_count end), 0)', format: 'number', description: 'Kalem varsa cihaz kalemleri, yoksa device_count' },
    customer_count: { label: 'Firma sayısı', sql: 'count(distinct s.customer_id)', format: 'number' },
  },
};

const SALE_ITEMS: DatasetDef = {
  key: 'sale_items',
  label: 'Ürün / model satışları',
  description: 'Model bazında adet, tutar, müşteri, Account ve satış / kiralama analizi. Kalemsiz eski satışlar burada görünmez.',
  permission: 'quote.read',
  from: `public.crm_sale_items i
    join public.crm_sales s on s.id = i.sale_id
    join public.musteriler m on m.id = s.customer_id`,
  baseWhere: [`s.status = 'active'`],
  defaultDateField: 'sale_date',
  owner: { userId: 's.owner_user_id::text', email: 's.owner_email', name: 's.owner_name' },
  dimensions: {
    sale_id: { label: 'Satış kayıt kimliği', sql: 's.id::text', type: 'string', group: 'Kayıt bağlantıları' },
    sale_date: { label: 'Satış tarihi', sql: 's.sale_date', type: 'date', grains: ALL_GRAINS, group: 'Satış' },
    owner: { label: 'Satıcı', sql: `coalesce(nullif(trim(s.owner_name), ''), 'Havuz Account')`, type: 'string', group: 'Satış' },
    sales_channel: { label: 'Satış kanalı', sql: `coalesce(s.sales_channel, '—')`, type: 'string', group: 'Satış' },
    product_code: { label: 'Model / ürün kodu', sql: `upper(trim(i.product_code))`, type: 'string', group: 'Kalem' },
    product_name: { label: 'Ürün adı', sql: `coalesce(i.product_name, i.product_code)`, type: 'string', group: 'Kalem' },
    product_type: { label: 'Ürün tipi', sql: 'i.product_type', type: 'string', group: 'Kalem', options: ['device', 'peripheral', 'bundle', 'service', 'license'] },
    item_sale_type: { label: 'Satış / kiralama', sql: `case when i.sale_type = 'rental' then 'Kiralama' else 'Satış' end`, type: 'string', group: 'Kalem', options: ['Satış', 'Kiralama'] },
    is_device: { label: 'Cihaz mı', sql: DEVICE, type: 'boolean', group: 'Kalem' },
    is_recurring: { label: 'Tekrarlayan kalem mi', sql: 'i.is_recurring', type: 'boolean', group: 'Kalem', description: 'Satış kaleminde saklanan tekrarlayan hizmet/lisans işareti; güncel katalogdan alınmaz.' },
    currency: { label: 'Para birimi', sql: 's.currency', type: 'string', group: 'Satış' },
    ...customerDims(),
  },
  measures: {
    line_count: { label: 'Kalem sayısı', sql: 'count(*)', format: 'number' },
    quantity: { label: 'Adet (tüm kalemler)', sql: 'coalesce(sum(i.quantity), 0)', format: 'number' },
    device_quantity: { label: 'Cihaz adedi', sql: `coalesce(sum(i.quantity) filter (where ${DEVICE}), 0)`, format: 'number' },
    total_usd: { label: 'Kalem tutarı (USD)', sql: `coalesce(sum(i.total_price) filter (where s.currency = 'USD'), 0)`, format: 'money' },
    avg_unit_price: { label: 'Ortalama birim fiyat', sql: 'avg(i.unit_price)', format: 'money' },
    sale_count: { label: 'Satış sayısı', sql: 'count(distinct s.id)', format: 'number' },
    customer_count: { label: 'Firma sayısı', sql: 'count(distinct s.customer_id)', format: 'number' },
  },
};

const FORECAST: DatasetDef = {
  key: 'forecast',
  label: 'Forecast',
  description: 'Aktif forecast satırları; tarih = forecast yılı/ayı.',
  permission: 'forecast.read',
  from: `public.crm_forecasts f join public.musteriler m on m.id = f.customer_id`,
  baseWhere: ['f.is_active = true'],
  defaultDateField: 'forecast_month',
  owner: { userId: 'f.owner_user_id::text', email: 'f.owner_email', name: 'f.owner_name' },
  dimensions: {
    forecast_month: { label: 'Forecast ayı', sql: 'make_date(f.forecast_year, f.forecast_month, 1)', type: 'date', grains: ['month', 'quarter', 'year'], group: 'Forecast' },
    owner: { label: 'Satıcı', sql: `coalesce(nullif(trim(f.owner_name), ''), '—')`, type: 'string', group: 'Forecast' },
    sales_channel: { label: 'Satış kanalı', sql: 'f.sales_channel', type: 'string', group: 'Forecast' },
    probability: { label: 'Olasılık (%)', sql: 'f.probability', type: 'number', group: 'Forecast', options: ['30', '60', '90'] },
    sale_type: { label: 'Satış / kiralama', sql: 'f.sale_type', type: 'string', group: 'Forecast', options: ['sale', 'rental'], description: 'Forecast satırının satış veya kiralama planı.' },
    include_in_retail_plan: { label: 'Retail planına dahil mi', sql: 'f.include_in_retail_plan', type: 'boolean', group: 'Forecast', description: 'Kayıtta seçilen Retail planına dahil etme işareti; filtre uygulanmadıkça tüm aktif satırlar kalır.' },
    product: { label: 'Ürün', sql: `coalesce(nullif(trim(f.product_code_snapshot), ''), f.product_name_snapshot)`, type: 'string', group: 'Forecast' },
    ...customerDims(),
  },
  measures: {
    quantity: { label: 'Forecast adedi', sql: 'coalesce(sum(f.quantity), 0)', format: 'number' },
    weighted_quantity: { label: 'Ağırlıklı adet', sql: 'coalesce(sum(f.quantity * f.probability / 100.0), 0)', format: 'number', description: 'adet × olasılık' },
    line_count: { label: 'Forecast satırı', sql: 'count(*)', format: 'number' },
    customer_count: { label: 'Firma sayısı', sql: 'count(distinct f.customer_id)', format: 'number' },
    avg_probability: { label: 'Ortalama olasılık', sql: 'avg(f.probability)', format: 'number' },
  },
};

const ACTIVITIES: DatasetDef = {
  key: 'activities',
  label: 'Aktiviteler',
  description: 'Gerçekleşmiş aktiviteler (planlanan sonraki aksiyonlar hariç). Tarih = aktivite tarihi.',
  permission: 'activity.read',
  from: `public.pipeline_eventleri pe left join public.musteriler m on m.id = pe.musteri_id`,
  baseWhere: [`not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)`],
  defaultDateField: 'activity_date',
  owner: { userId: `coalesce(pe.owner_user_id, pe.created_by_user_id::text)`, email: 'pe.created_by_email', name: 'pe.created_by' },
  dimensions: {
    activity_date: { label: 'Aktivite tarihi', sql: ACTIVITY_DATE, type: 'date', grains: ALL_GRAINS, group: 'Aktivite' },
    created_by: { label: 'Giren kişi', sql: `coalesce(nullif(trim(pe.created_by), ''), '—')`, type: 'string', group: 'Aktivite' },
    channel: { label: 'Aktivite tipi', sql: ACTIVITY_CHANNEL, type: 'string', group: 'Aktivite', options: ACTIVITY_CHANNEL_OPTIONS },
    is_activity_record: { label: 'AKTIVITE: kaydı mı', sql: `coalesce(pe.aksiyon, '') like 'AKTIVITE:%'`, type: 'boolean', group: 'Aktivite' },
    status: { label: 'Durum', sql: 'pe.durum::text', type: 'string', group: 'Aktivite', options: Object.values(DURUM_CANONICAL) },
    activity_context: { label: 'Aktivite bağlamı', sql: 'pe.activity_context', type: 'string', group: 'Aktivite', options: ['customer', 'business_partner'], description: 'Müşteri veya iş ortağı süreci. Eski kayıtlarda boş olabilir.' },
    phase_no: { label: 'Faz no', sql: 'pe.faz_no', type: 'number', group: 'Aktivite' },
    scope: { label: 'Kapsam', sql: 'pe.activity_scope', type: 'string', group: 'Aktivite', options: ['account', 'technical'] },
    ...customerDims(),
  },
  measures: {
    activity_count: { label: 'Aktivite sayısı', sql: 'count(*)', format: 'number' },
    customer_count: { label: 'Temas edilen firma', sql: 'count(distinct pe.musteri_id)', format: 'number' },
    sales_activity_count: { label: 'Satış görüşmesi', sql: `count(*) filter (where (${ACTIVITY_CHANNEL}) in ('Telefon','Yerinde Ziyaret','Online Toplantı'))`, format: 'number' },
    technical_activity_count: { label: 'Teknik aktivite', sql: `count(*) filter (where (${ACTIVITY_CHANNEL}) in ('Teknik Ziyaret','Teknik Online','POM'))`, format: 'number' },
    visit_count: { label: 'Yerinde ziyaret', sql: `count(*) filter (where (${ACTIVITY_CHANNEL}) = 'Yerinde Ziyaret')`, format: 'number' },
    late_entry_count: { label: 'Geç girilen', sql: `count(*) filter (where pe.aktivite_tarihi < (pe.created_at at time zone 'Europe/Istanbul')::date)`, format: 'number' },
  },
};

const CUSTOMERS: DatasetDef = {
  key: 'customers',
  label: 'Müşteriler',
  description: 'Müşteri kartı + aktif faz (faz dağılımı, portföy).',
  permission: 'customer.read',
  from: `public.musteriler m
    left join public.musteri_pipeline mp on mp.musteri_id = m.id
    left join lateral (select ft.asama_adi from public.faz_tanimlari ft where ft.faz_no = mp.aktif_faz_no limit 1) ft on true`,
  baseWhere: [],
  defaultDateField: 'created_date',
  owner: { userId: 'm.owner_user_id::text', name: 'm.sorumlu' },
  dimensions: {
    created_date: { label: 'Kayıt tarihi', sql: `(m.created_at at time zone 'Europe/Istanbul')::date`, type: 'date', grains: ALL_GRAINS, group: 'Müşteri' },
    phase_no: { label: 'Aktif faz no', sql: 'mp.aktif_faz_no', type: 'number', group: 'Faz' },
    phase_name: { label: 'Aktif faz', sql: `coalesce(ft.asama_adi, 'Fazsız')`, type: 'string', group: 'Faz' },
    phase_group: { label: 'Faz grubu', sql: PHASE_GROUP, type: 'string', group: 'Faz', options: ['Fazsız', 'Fırsat', 'İlk Temas', 'Business', 'Operasyon', 'Yayılım'] },
    pipeline_status: { label: 'Pipeline durumu', sql: 'mp.durum::text', type: 'string', group: 'Faz' },
    pipeline_policy: { label: 'Faz zorunluluğu politikası', sql: 'm.pipeline_policy', type: 'string', group: 'Müşteri', options: ['phase_required', 'phase_optional'], description: 'Müşteri kartındaki faz zorunlu / yalnız aktivite seçimi; mevcut pipeline durumundan bağımsızdır.' },
    integration_type: { label: 'Entegrasyon tipi', sql: 'm.entegrasyon_tipi::text', type: 'string', group: 'Müşteri' },
    ...customerDims(),
  },
  measures: {
    customer_count: { label: 'Müşteri sayısı', sql: 'count(*)', format: 'number' },
    with_phase_count: { label: 'Fazı olan', sql: 'count(*) filter (where mp.aktif_faz_no is not null)', format: 'number' },
    active_kasa_total: { label: 'Aktif satış kasası (toplam)', sql: 'coalesce(sum(m.aktif_satis_kasasi), 0)', format: 'number' },
    active_kasa_avg: { label: 'Aktif satış kasası (ort.)', sql: 'avg(m.aktif_satis_kasasi)', format: 'number' },
  },
};

const QUOTES: DatasetDef = {
  key: 'quotes',
  label: 'Teklifler',
  description: 'Teklifler; tarih = teklif tarihi (proposal_date).',
  permission: 'quote.read',
  from: `public.quotes q join public.musteriler m on m.id = q.customer_id`,
  baseWhere: [],
  defaultDateField: 'proposal_date',
  owner: { userId: 'q.owner_user_id::text', email: 'q.owner_email', name: 'q.owner_name' },
  dimensions: {
    quote_id: { label: 'Teklif kayıt kimliği', sql: 'q.id::text', type: 'string', group: 'Kayıt bağlantıları' },
    proposal_date: { label: 'Teklif tarihi', sql: 'q.proposal_date', type: 'date', grains: ALL_GRAINS, group: 'Teklif' },
    valid_until: { label: 'Teklif geçerlilik tarihi', sql: 'q.valid_until', type: 'date', grains: ALL_GRAINS, group: 'Teklif', description: 'Teklif kaydında saklanan son geçerlilik günü.' },
    closed_date: { label: 'Kapanış tarihi', sql: `(coalesce(q.closed_at, q.updated_at) at time zone 'Europe/Istanbul')::date`, type: 'date', grains: ALL_GRAINS, group: 'Teklif' },
    owner: { label: 'Satıcı', sql: `coalesce(nullif(trim(q.owner_name), ''), '—')`, type: 'string', group: 'Teklif' },
    status: { label: 'Durum', sql: 'q.status', type: 'string', group: 'Teklif' },
    closed_reason: { label: 'Kapanış nedeni', sql: `coalesce(q.closed_reason, '—')`, type: 'string', group: 'Teklif' },
    probability: { label: 'Olasılık (%)', sql: 'q.probability', type: 'number', group: 'Teklif' },
    ...customerDims(),
  },
  measures: {
    quote_count: { label: 'Teklif sayısı', sql: 'count(*)', format: 'number' },
    total_amount: { label: 'Teklif tutarı', sql: 'coalesce(sum(q.total_amount), 0)', format: 'money' },
    device_count: { label: 'Teklif cihaz adedi', sql: 'coalesce(sum(q.total_device_count), 0)', format: 'number' },
    won_count: { label: 'Kazanılan', sql: `count(*) filter (where q.status = 'closed' and q.closed_reason = 'won')`, format: 'number' },
    customer_count: { label: 'Firma sayısı', sql: 'count(distinct q.customer_id)', format: 'number' },
  },
};

// Geliştirici sabiti (kullanıcı girdisi değil) → literal dizi; tırnaklar kaçırılır.
const INTEGRATION_KEYS_SQL = (() => {
  const arr = `array[${INTEGRATION_DEVICE_SERVICE_KEYS.map((k) => `'${k.replace(/'/g, "''")}'`).join(', ')}]::text[]`;
  return `(lower(btrim(i.service_key)) = any(${arr}) or lower(btrim(i.service_label)) = any(${arr}))`;
})();

// Hizmet faturası kalemleri (KasaPOS entegrasyonu vb.). Tarih = fatura dönemi (period_month).
// lib/reports/kasapos-entegrasyon ile aynı kaynak; KasaPOS kalem kümesi service_key filtresiyle seçilir.
const SERVICE_INVOICE_ITEMS: DatasetDef = {
  key: 'service_invoice_items',
  label: 'Hizmet faturası kalemleri',
  description: 'Aktif hizmet faturalarının kalemleri; tarih = fatura dönemi (ay). Cihaz cirosuna dahil değil.',
  permission: 'quote.read',
  from: `public.crm_service_invoice_items i
    join public.crm_service_invoices s on s.id = i.invoice_id
    join public.musteriler m on m.id = s.customer_id`,
  baseWhere: [`s.status = 'active'`],
  defaultDateField: 'period_month',
  owner: { userId: 's.owner_user_id::text', name: 's.owner_name' },
  dimensions: {
    period_month: { label: 'Fatura dönemi', sql: 's.period_month', type: 'date', grains: ['month', 'quarter', 'year'], group: 'Fatura' },
    owner: { label: 'Satıcı', sql: `coalesce(nullif(trim(s.owner_name), ''), '—')`, type: 'string', group: 'Fatura' },
    service_key: { label: 'Hizmet kalemi', sql: 'lower(btrim(i.service_key))', type: 'string', group: 'Kalem' },
    service_label: { label: 'Hizmet adı', sql: 'i.service_label', type: 'string', group: 'Kalem' },
    is_integration_device: { label: 'KasaPOS entegrasyon kalemi', sql: INTEGRATION_KEYS_SQL, type: 'boolean', group: 'Kalem', description: 'Canlı Ekran / KasaPOS raporuyla aynı kalem kümesi' },
    currency: { label: 'Para birimi', sql: 's.currency', type: 'string', group: 'Fatura', options: ['TRY', 'USD'] },
    invoice_no: { label: 'Fatura no', sql: 's.invoice_no', type: 'string', group: 'Fatura' },
    ...customerDims(),
  },
  measures: {
    quantity: { label: 'Adet', sql: 'coalesce(sum(i.quantity), 0)', format: 'number' },
    total_usd: { label: 'Tutar (USD)', sql: `coalesce(sum(i.total_price) filter (where s.currency = 'USD'), 0)`, format: 'money' },
    total_try: { label: 'Tutar (TRY)', sql: `coalesce(sum(i.total_price) filter (where s.currency = 'TRY'), 0)`, format: 'money' },
    invoice_count: { label: 'Fatura sayısı', sql: 'count(distinct s.id)', format: 'number' },
    customer_count: { label: 'Firma sayısı', sql: 'count(distinct s.customer_id)', format: 'number' },
  },
};

// Her müşteri tek satır: fatura kalemleri stokla birleştirilmeden önce ay bazında toplanır.
// Güncel künye stoku geçmiş stok değildir; period_month yalnız son fatura referans dönemidir.
const KASAPOS_SNAPSHOT: DatasetDef = {
  key: 'kasapos_snapshot',
  label: 'KasaPOS operasyon anlık durumu',
  description: 'Son entegrasyon fatura ayı ve güncel kasa stoku. Geçmiş tarihli stok yeniden kurulmaz; firma başına tek satır.',
  permission: 'quote.read',
  from: `public.musteriler m
    join (
      with monthly as (
        select s.customer_id, date_trunc('month', s.period_month)::date as period_month,
          sum(i.quantity)::numeric as billed,
          coalesce(sum(i.total_price) filter (where s.currency = 'USD'), 0)::numeric as usd
        from public.crm_service_invoices s
        join public.crm_service_invoice_items i on i.invoice_id = s.id
        where s.status = 'active' and ${INTEGRATION_KEYS_SQL}
        group by s.customer_id, date_trunc('month', s.period_month)::date
      ), reference as (select max(period_month) as period_month from monthly)
      select customers.customer_id, reference.period_month,
        coalesce(billed.billed, 0) as billed, coalesce(billed.usd, 0) as usd,
        price.unit_price
      from reference
      join lateral (
        select distinct customer_id from monthly
        where period_month >= date_trunc('year', reference.period_month)::date
          and period_month <= reference.period_month
      ) customers on true
      left join monthly billed on billed.customer_id = customers.customer_id and billed.period_month = reference.period_month
      left join lateral (
        select round(p.usd / p.billed, 2) as unit_price from monthly p
        where p.customer_id = customers.customer_id and p.billed > 0 and p.usd > 0
          and p.period_month >= date_trunc('year', reference.period_month)::date
          and p.period_month <= reference.period_month
        order by p.period_month desc limit 1
      ) price on true
    ) snapshot on snapshot.customer_id = m.id
    left join lateral (
      select coalesce(
        case when btrim(k.sabit_kasa_adedi) ~ '^[0-9]+$' then btrim(k.sabit_kasa_adedi)::numeric end,
        m.aktif_satis_kasasi::numeric
      ) as active_registers
      from (select 1) seed
      left join lateral (
        select mk.sabit_kasa_adedi from public.musteri_kunye_v2 mk
        where mk.musteri_id = m.id order by mk.updated_at desc nulls last limit 1
      ) k on true
    ) stock on true`,
  baseWhere: [],
  defaultDateField: 'period_month',
  owner: { userId: 'm.owner_user_id::text', name: 'm.sorumlu' },
  dimensions: {
    ...customerDims(),
    owner: { label: 'Müşteri sorumlusu', sql: `coalesce(nullif(trim(m.sorumlu), ''), 'Havuz')`, type: 'string', group: 'Müşteri' },
    period_month: { label: 'Son fatura referans ayı (güncel stok)', sql: 'snapshot.period_month', type: 'date', grains: ['month', 'quarter', 'year'], group: 'KasaPOS' },
  },
  measures: {
    active_registers: { label: 'Güncel aktif kasa', sql: 'coalesce(sum(stock.active_registers), 0)', format: 'number' },
    billed_registers: { label: 'Son ay faturalanan kasa', sql: 'coalesce(sum(snapshot.billed), 0)', format: 'number' },
    monthly_usd: { label: 'Son ay hizmet geliri (USD)', sql: 'coalesce(sum(snapshot.usd), 0)', format: 'money' },
    opportunity_registers: { label: 'Ek kasa fırsatı (stok bilinen)', sql: 'coalesce(sum(greatest(stock.active_registers - snapshot.billed, 0)) filter (where stock.active_registers is not null), 0)', format: 'number' },
    utilization_pct: { label: 'Kasa kullanım oranı (stok bilinen)', sql: 'round(100.0 * sum(snapshot.billed) filter (where stock.active_registers is not null) / nullif(sum(stock.active_registers), 0))', format: 'percent' },
    potential_monthly_usd: { label: 'Ek aylık gelir fırsatı (USD, fiyatı bilinen)', sql: 'coalesce(sum(round(greatest(stock.active_registers - snapshot.billed, 0) * snapshot.unit_price, 2)) filter (where stock.active_registers is not null and snapshot.unit_price is not null), 0)', format: 'money' },
    customer_count: { label: 'Referans yılı faturalı firma', sql: 'count(*)', format: 'number' },
    known_stock_count: { label: 'Kasa stoku bilinen firma', sql: 'count(*) filter (where stock.active_registers is not null)', format: 'number' },
    known_price_count: { label: 'Stoku ve USD fiyatı bilinen firma', sql: 'count(*) filter (where stock.active_registers is not null and snapshot.unit_price is not null)', format: 'number' },
  },
};

const PERFORMANCE_COMPARISON: DatasetDef = {
  key: 'performance_comparison',
  label: 'Gerçekleşen / hedef / forecast',
  description: 'Account ve ay bazında karşılaştırma. Kişi hedefleri: çeyrek /3, yıl /12 (çeyrek öncelikli). Şirket hedefi eklenmez; müşteri/model hedefi yoktur. Cihaz = kiralama hariç satış. Forecast yalnız katalogda cihaz/paket olarak doğrulanan ürünler; USD forecast saklanmadığından gösterilmez.',
  permission: 'report.performance.read',
  requiredPermissions: ['report.performance.read', 'quote.read', 'forecast.read'],
  from: PERFORMANCE_COMPARISON_FROM,
  baseWhere: [],
  defaultDateField: 'month',
  owner: { userId: 'pc.owner_user_id', email: 'pc.owner_email', name: 'pc.owner_label' },
  dimensions: {
    month: { label: 'Ay (aylık hedef payı)', sql: 'pc.month', type: 'date', grains: ['month', 'quarter', 'year'], group: 'Dönem', description: 'Ayın ilk günü; tam ay dönemleri kullanın.' },
    owner: { label: 'Account', sql: 'pc.owner_label', type: 'string', group: 'Account' },
  },
  measures: {
    actual_quantity: { label: 'Gerçekleşen satılan cihaz', sql: 'coalesce(sum(pc.actual_quantity), 0)', format: 'number' },
    target_quantity: { label: 'Cihaz hedefi (aylık pay)', sql: 'sum(pc.target_quantity)', format: 'number', description: 'Kişi hedefi; çeyrek /3 veya yıl /12. Eksik hedef boş kalır.' },
    forecast_quantity: { label: 'Forecast cihaz (katalog doğrulanmış)', sql: 'coalesce(sum(pc.forecast_quantity), 0)', format: 'number' },
    weighted_forecast_quantity: { label: 'Ağırlıklı forecast cihaz', sql: 'coalesce(sum(pc.weighted_forecast_quantity), 0)', format: 'number' },
    quantity_gap: { label: 'Cihaz farkı (gerçekleşen − hedef)', sql: 'sum(pc.actual_quantity) - sum(pc.target_quantity)', format: 'number' },
    quantity_achievement: { label: 'Cihaz hedef gerçekleşme (%)', sql: '100.0 * sum(pc.actual_quantity) / nullif(sum(pc.target_quantity), 0)', format: 'percent' },
    actual_usd: { label: 'Gerçekleşen ciro (yalnız USD)', sql: 'coalesce(sum(pc.actual_usd), 0)', format: 'money' },
    target_usd: { label: 'Ciro hedefi (USD, aylık pay)', sql: 'sum(pc.target_usd)', format: 'money', description: 'sales_revenue kişi bütçesi (USD); döviz dönüşümü yapılmaz.' },
    usd_gap: { label: 'Ciro farkı (USD)', sql: 'sum(pc.actual_usd) - sum(pc.target_usd)', format: 'money' },
    usd_achievement: { label: 'Ciro hedef gerçekleşme (%)', sql: '100.0 * sum(pc.actual_usd) / nullif(sum(pc.target_usd), 0)', format: 'percent' },
  },
};

const ACTUAL_FORECAST: DatasetDef = {
  key:'actual_forecast',label:'Müşteri / model · gerçekleşen ve Forecast',
  description:'Müşteri, model kodu, Account ve tam ay üzerinden cihaz satışı ile Forecast karşılaştırması. Kiralama ve kalemsiz satışlar hariçtir. Model kodu eksik kayıtlar birbirine eşleştirilmez. Fark gerçekleşen eksi tahmindir; hedef veya USD Forecast tutarı üretilmez.',
  permission:'quote.read',requiredPermissions:['quote.read','forecast.read'],from:ACTUAL_FORECAST_FROM,baseWhere:[],defaultDateField:'month',
  owner:{userId:'af.owner_user_id',email:'af.owner_email',name:'af.owner_name'},
  dimensions:{...customerDims(),model:{label:'Model kodu',sql:'af.model',type:'string',group:'Ortak kırılımlar'},owner:{label:'Account',sql:"coalesce(nullif(trim(af.owner_name),''),af.owner_email,'Havuz')",type:'string',group:'Ortak kırılımlar'},month:{label:'Ay',sql:'af.month',type:'date',grains:['month','quarter','year'],group:'Ortak kırılımlar'}},
  measures:{actual_quantity:{label:'Gerçekleşen cihaz satışı',sql:'coalesce(sum(af.actual_quantity),0)',format:'number'},forecast_quantity:{label:'Forecast cihaz adedi',sql:'coalesce(sum(af.forecast_quantity),0)',format:'number'},weighted_forecast_quantity:{label:'Olasılık ağırlıklı Forecast',sql:'coalesce(sum(af.weighted_forecast_quantity),0)',format:'number'},quantity_gap:{label:'Gerçekleşen − Forecast',sql:'sum(af.actual_quantity)-sum(af.forecast_quantity)',format:'number'},weighted_gap:{label:'Gerçekleşen − ağırlıklı Forecast',sql:'sum(af.actual_quantity)-sum(af.weighted_forecast_quantity)',format:'number'},actual_usd:{label:'Gerçekleşen kalem tutarı (yalnız USD)',sql:'coalesce(sum(af.actual_usd),0)',format:'money'}},
};

export const DATASETS: Readonly<Record<string, DatasetDef>> = Object.freeze({
  actual_forecast: ACTUAL_FORECAST,
  performance_comparison: PERFORMANCE_COMPARISON,
  kasapos_snapshot: KASAPOS_SNAPSHOT,
  service_invoice_items: SERVICE_INVOICE_ITEMS,
  sales: SALES,
  sale_items: SALE_ITEMS,
  forecast: FORECAST,
  activities: ACTIVITIES,
  customers: CUSTOMERS,
  quotes: QUOTES,
});

export function getDataset(key: string): DatasetDef | null {
  return Object.prototype.hasOwnProperty.call(DATASETS, key) ? DATASETS[key] : null;
}

/** İstemciye giden katalog: SQL parçaları dışarı sızmaz. */
export function datasetCatalog(canAccess: (permission: Permission) => boolean) {
  return Object.values(DATASETS)
    .filter((dataset) => canAccess(dataset.permission) && (dataset.requiredPermissions ?? []).every(canAccess))
    .map((dataset) => ({
      key: dataset.key,
      label: dataset.label,
      description: dataset.description,
      defaultDateField: dataset.defaultDateField,
      dimensions: Object.entries(dataset.dimensions).map(([key, d]) => ({
        key, label: d.label, type: d.type, group: d.group ?? null, grains: d.grains ?? null, options: d.options ?? null, description: d.description ?? null,
      })),
      measures: Object.entries(dataset.measures).map(([key, m]) => ({
        key, label: m.label, format: m.format, description: m.description ?? null,
      })),
    }));
}

export type DatasetCatalogEntry = ReturnType<typeof datasetCatalog>[number];
