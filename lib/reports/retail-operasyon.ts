import 'server-only';
import { db } from '@/lib/db';
import { buildKasaposEntegrasyonRaporu } from './kasapos-entegrasyon';
import { DEFAULT_RENTAL_OPS_STATUS, RENTAL_OPS_STATUSES, isRentalOpsStatus, rentalOpsLabel, type RentalOpsStatus } from '@/lib/sales/rental-ops';
import { summarizeRental, type RentalItemRow } from './retail-rental';
import { normalizeDelimitedList } from '@/lib/kunye';

// Retail Operasyon Paneli — müdürün statik Retail_2026_2027.html panelinin canlı veri karşılığı.
// Kaynaklar:
//   * Gerçekleşen satış: crm_sales (status=active) + crm_sale_items (cihaz kalemleri, sale_type).
//     S210 aksesuardır: ciroya girer, terminal adedine girmez.
//   * KasaPOS aktif / faturalanan / aylık gelir: buildKasaposEntegrasyonRaporu (tek tanım).
//   * Yıl fırsatları: aktif crm_forecasts + müşterinin güncel Retail departmanı.
//   * CRM havuzu: musteriler + musteri_kunye_v2 + musteri_pipeline.

export const ACCESSORY_MODELS = ['S210'];

export type RetailSaleLine = { firm: string; model: string; month: number; qty: number; usd: number; usdQty?: number; saleType: 'sale' | 'rental' };
export type RetailOpportunity = {
  firm: string; model: string; qty: number; month: number; channel: string; prob: number; note: string; owner: string;
  /** Kanonik Forecast kimliği, gerçek iş modeli ve güncelleme bilgisi. */
  id?: string;
  customerId?: string;
  productId?: string;
  saleType?: 'sale' | 'rental' | 'bank';
  businessModel?: 'sale' | 'rental' | 'bank';
  source?: 'retail_plan' | 'forecast';
  referenceKey?: string;
  sourceName?: string;
  updatedAt?: string;
  ownerUserId?: string;
  canEditForecast?: boolean;
  canEdit?: boolean;
  unitPrice?: number | null;
  rentalMonthlyPrice?: number | null;
  includeInRetailPlan?: boolean;
};
export type RetailRentalStatusRow = { status: RentalOpsStatus; label: string; contracts: number; qty: number; monthly: number };
export type RetailRentalContract = {
  saleId: string; firm: string; status: RentalOpsStatus; statusLabel: string; note: string;
  qty: number; monthly: number; start: string | null; end: string | null;
};
export type RetailRentalSummary = {
  /** Aktif kiralık cihaz: satış aktif + operasyon 'aktif' + dönem bitmemiş. */
  activeQty: number;
  /** Aktif kiralamaların aylık kira geliri (birim kira × adet), USD. */
  monthlyRevenue: number;
  /** Ortalama aylık birim kira = monthlyRevenue / activeQty. */
  avgMonthlyPrice: number | null;
  byStatus: RetailRentalStatusRow[];
  contracts: RetailRentalContract[];
};
export type RetailCrmRow = {
  id: string; customerId?: string; name: string; sector: string; kasa: string; rawKasa?: string; register: number | null; owner: string;
  phase?: string;
  ownerUserId?: string;
  canEditForecast?: boolean;
  canPlan?: boolean;
  hasForecast?: boolean;
  forecastYears?: number[];
  status: string; pos: string; posOwner: string; banks: string;
};
export type RetailKasaRow = {
  firm: string; active: number | null; billed: number; gap: number | null; rate: number | null;
  /** Aynı hizmet faturası kaynağından firma × ay mutabakatı; eksik ay null kalır. */
  monthly?: Array<{ month: string; billed: number; usd: number } | null>;
  yearBilled?: number;
  totalUsd?: number;
};
export type RetailOperasyonPayload = {
  accountManagers?: Array<{ value: string; label: string }>;
  accountManager?: string;
  canEditRetailPlan?: boolean;
  canEditForecast?: boolean;
  year: number;
  generatedAt: string;
  sales: RetailSaleLine[];
  opportunities: { current: RetailOpportunity[]; next: RetailOpportunity[] };
  kasapos: {
    refMonth: string | null;
    rows: RetailKasaRow[];
    monthly: Array<{ month: string; billed: number; usd: number }>;
    aktifKasa: number; faturalanan: number; aylikGelir: number; firsat: number; potansiyel: number;
  };
  crm: RetailCrmRow[];
  /** 045 — kiralama operasyonu (opsiyonel: eski istemci yok sayar). */
  rental?: RetailRentalSummary;
};

const normModel = (code: unknown) => String(code ?? '').trim().toUpperCase() || 'DİĞER';
const txt = (v: unknown, fb = '') => String(v ?? '').trim() || fb;

async function fetchSales(year: number, customerIds?: string[]): Promise<RetailSaleLine[]> {
  const r = await db.query(
    `
      select m.musteri as firm, i.product_code, extract(month from s.sale_date)::int as ay,
             i.sale_type, sum(i.quantity)::int as qty,
             coalesce(sum(i.quantity) filter (where s.currency = 'USD'), 0)::int as usd_qty,
             coalesce(sum(i.total_price) filter (where s.currency = 'USD'), 0)::numeric as usd
      from public.crm_sales s
      join public.crm_sale_items i on i.sale_id = s.id
      join public.musteriler m on m.id = s.customer_id
      where s.status = 'active'
        and m.is_kolu = 'Retail'
        ${customerIds ? 'and m.id::text = any($2::text[])' : ''}
        and s.sale_date >= make_date($1::int, 1, 1) and s.sale_date < make_date($1::int + 1, 1, 1)
        and public.crm_sale_item_is_device(i.product_type, i.is_recurring)
      group by 1, 2, 3, 4
    `,
    customerIds ? [year, customerIds] : [year],
  );
  return (r.rows as any[]).map((x) => ({
    firm: txt(x.firm, '-'),
    model: normModel(x.product_code),
    month: Number(x.ay),
    qty: Number(x.qty) || 0,
    usd: Math.round((Number(x.usd) || 0) * 100) / 100,
    usdQty: Number(x.usd_qty) || 0,
    saleType: x.sale_type === 'rental' ? 'rental' : 'sale',
  }));
}

/** Active Forecast source only: no imported plan, cohort, or reference-file fallback. */
async function fetchOpportunities(years: number[], customerIds?: string[]): Promise<Map<number, RetailOpportunity[]>> {
  const { rows } = await db.query(`select f.id::text as id,f.customer_id::text as customer_id,f.product_id,
      m.musteri as firm,m.owner_user_id::text as customer_owner_user_id,
      f.product_code_snapshot,f.product_name_snapshot,f.quantity,f.forecast_year,f.forecast_month,
      f.sales_channel,f.probability,f.note,f.owner_name,f.updated_at::text as updated_at,
      exists(select 1 from public.system_parameters channel where channel.group_key='forecast_sales_channel'
        and channel.is_active=true and channel.value=f.sales_channel
        and (lower(trim(channel.label))='banka' or lower(trim(channel.value))='banka')) as is_bank_channel,
      coalesce(to_jsonb(f)->>'sale_type','sale') as sale_type,
      (to_jsonb(f)->>'unit_price')::numeric as unit_price,
      (to_jsonb(f)->>'rental_monthly_price')::numeric as rental_monthly_price,
      coalesce((to_jsonb(f)->>'include_in_retail_plan')::boolean,true) as include_in_retail_plan
    from public.crm_forecasts f join public.musteriler m on m.id=f.customer_id
    where f.is_active=true and f.forecast_year=any($1::int[]) and m.is_kolu='Retail'
      ${customerIds ? 'and m.id::text = any($2::text[])' : ''}
    order by f.forecast_year,f.forecast_month,f.quantity desc,f.id`, customerIds ? [years, customerIds] : [years]);
  const result = new Map<number, RetailOpportunity[]>(years.map(year => [year, []]));
  for (const row of rows) {
    const saleType = row.sale_type === 'rental' ? 'rental' : 'sale';
    const bankChannel = row.is_bank_channel === true || txt(row.sales_channel).toLocaleLowerCase('tr-TR') === 'banka';
    const businessModel = saleType === 'rental' ? 'rental' : bankChannel ? 'bank' : 'sale';
    result.get(Number(row.forecast_year))?.push({
      id: String(row.id), customerId: String(row.customer_id), productId: row.product_id == null ? undefined : String(row.product_id),
      firm: txt(row.firm, '-'), model: normModel(txt(row.product_code_snapshot, txt(row.product_name_snapshot))),
      qty: Number(row.quantity) || 0, month: Number(row.forecast_month), channel: txt(row.sales_channel),
      prob: Number(row.probability) || 0, note: txt(row.note), owner: txt(row.owner_name),
      saleType, businessModel, source: 'forecast', sourceName: 'CRM Forecast', updatedAt: txt(row.updated_at),
      ownerUserId: row.customer_owner_user_id == null ? undefined : String(row.customer_owner_user_id),
      unitPrice: row.unit_price == null ? null : Number(row.unit_price),
      rentalMonthlyPrice: row.rental_monthly_price == null ? null : Number(row.rental_monthly_price),
      includeInRetailPlan: row.include_in_retail_plan !== false,
    });
  }
  return result;
}

/** Kiralama kalemleri (sözleşme = satış kaydı; durum crm_sales.rental_ops_status). Yıl filtresi yok: stok. */
async function fetchRental(customerIds?: string[]): Promise<RetailRentalSummary> {
  const r = await db.query(
    `
      select s.id::text as sale_id, m.musteri as firm,
             to_jsonb(s) ->> 'rental_ops_status' as ops_status,
             to_jsonb(s) ->> 'rental_ops_note' as ops_note,
             coalesce(i.rental_start_date, s.rental_start_date)::text as start_date,
             coalesce(i.rental_end_date, s.rental_end_date)::text as end_date,
             i.quantity::int as qty,
             coalesce(i.rental_monthly_price, 0)::float8 as monthly_price
      from public.crm_sales s
      join public.crm_sale_items i on i.sale_id = s.id
      join public.musteriler m on m.id = s.customer_id
      where s.status = 'active' and i.sale_type = 'rental'
        and m.is_kolu = 'Retail'
        ${customerIds ? 'and m.id::text = any($1::text[])' : ''}
        and public.crm_sale_item_is_device(i.product_type, i.is_recurring)
    `, customerIds ? [customerIds] : [],
  );
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const rows: RentalItemRow[] = (r.rows as any[]).map((x) => ({
    saleId: String(x.sale_id),
    firm: txt(x.firm, '-'),
    status: isRentalOpsStatus(x.ops_status) ? x.ops_status : DEFAULT_RENTAL_OPS_STATUS,
    note: txt(x.ops_note),
    start: x.start_date ?? null,
    end: x.end_date ?? null,
    qty: Number(x.qty) || 0,
    monthlyPrice: Number(x.monthly_price) || 0,
  }));
  return summarizeRental(rows, today, RENTAL_OPS_STATUSES.map((s) => s.value), rentalOpsLabel);
}

async function fetchCrmPool(years: number[]): Promise<RetailCrmRow[]> {
  const r = await db.query(
    `
      select m.id::text as id, m.musteri, m.sektor, m.sorumlu,m.owner_user_id::text as owner_user_id,
             k.satici_etiketi,fc.forecast_years,
             ft.asama_adi as faz, k.kasapos_firmasi, k.sabit_kasa_adedi, k.pos_markasi, k.pos_mulkiyet,
             k.pos_mulkiyet_bankalari, k.bankalar
      from public.musteriler m
      left join public.musteri_kunye_v2 k on k.musteri_id = m.id
      left join public.musteri_pipeline mp on mp.musteri_id = m.id
      left join public.faz_tanimlari ft on ft.faz_no = mp.aktif_faz_no
      left join lateral (
        select array_agg(distinct f.forecast_year order by f.forecast_year) as forecast_years
        from public.crm_forecasts f where f.customer_id=m.id and f.is_active=true
          and f.forecast_year=any($1::int[])
          and coalesce((to_jsonb(f)->>'include_in_retail_plan')::boolean,true)
      ) fc on true
      -- Tüm güncel Retail müşterileri görünür; Forecast'i olanlar işaretlenir, gizlenmez.
      where m.is_kolu='Retail'
      order by m.musteri
    `,
    [years],
  );
  const seen = new Set<string>();
  const rows: RetailCrmRow[] = [];
  for (const x of r.rows as any[]) {
    const customerId = String(x.id);
    const name = txt(x.musteri, 'Adsız müşteri');
    if (seen.has(customerId)) continue;
    seen.add(customerId);
    const kasaAdet = txt(x.sabit_kasa_adedi);
    const owners = normalizeDelimitedList(x.pos_mulkiyet_bankalari) ?? [];
    const mulk = txt(x.pos_mulkiyet, 'Bilinmeyen');
    const nativeStatus = txt(x.satici_etiketi);
    const knownStatus: Record<string, string> = { hunter: 'Hunter', farmer: 'Farmer', lead: 'Lead', kasa: 'Kasa' };
    const forecastYears = Array.isArray(x.forecast_years) ? x.forecast_years.map(Number).filter(Number.isInteger) : [];
    rows.push({
      id: customerId,
      customerId,
      name,
      sector: txt(x.sektor),
      kasa: txt(x.kasapos_firmasi, 'Bilinmeyen'),
      rawKasa: txt(x.kasapos_firmasi, 'Bilinmeyen'),
      register: /^\d+$/.test(kasaAdet) ? Number(kasaAdet) : null,
      owner: txt(x.sorumlu),
      status: knownStatus[nativeStatus.toLocaleLowerCase('tr-TR')] ?? txt(nativeStatus, 'Girilmedi'),
      ownerUserId: x.owner_user_id == null ? undefined : String(x.owner_user_id),
      hasForecast: forecastYears.length > 0,
      forecastYears,
      phase: txt(x.faz, 'Faz yok'),
      pos: txt(x.pos_markasi, 'Bilinmeyen'),
      posOwner: owners.length ? `${mulk} - ${owners.join(', ')}` : mulk,
      banks: (normalizeDelimitedList(x.bankalar) ?? []).join(', '),
    });
  }
  return rows;
}

export function retailAccountManagerKey(row: RetailCrmRow): string {
  return row.ownerUserId ? `user:${row.ownerUserId}` : row.owner.trim() ? `name:${row.owner.trim()}` : 'unassigned';
}

export async function buildRetailOperasyon(options?: { year?: number; accountManager?: string }): Promise<RetailOperasyonPayload> {
  const req = options?.year;
  const year = Number.isInteger(req) && req! > 2000 ? req! : new Date().getFullYear();
  const pool = await fetchCrmPool([year, year + 1]);
  const accountManager = options?.accountManager?.trim() || '';
  const managers = new Map<string, string>();
  for (const row of pool) managers.set(retailAccountManagerKey(row), row.owner.trim() || (row.ownerUserId ? 'İsimsiz Account Manager' : 'Atanmamış'));
  const accountManagers = [...managers].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  const crm = accountManager ? pool.filter(row => retailAccountManagerKey(row) === accountManager) : pool;
  const customerIds = accountManager ? crm.map(row => row.id) : undefined;
  const [sales, opps, kasa, rental] = await Promise.all([
    fetchSales(year, customerIds),
    fetchOpportunities([year, year + 1], customerIds),
    buildKasaposEntegrasyonRaporu({ year, department: 'Retail', customerIds }),
    fetchRental(customerIds),
  ]);
  const ref = kasa.refMonthIndex;
  return {
    accountManagers,
    accountManager,
    year,
    generatedAt: new Date().toISOString(),
    sales,
    opportunities: { current: opps.get(year) ?? [], next: opps.get(year + 1) ?? [] },
    kasapos: {
      refMonth: kasa.months[ref] ?? null,
      rows: kasa.firms
        .map((f) => ({
          firm: f.musteri,
          active: f.aktifKasa,
          billed: f.refAdet,
          gap: f.firsatAdet,
          rate: f.kullanimPct,
          monthly: f.monthly.map((cell, index) => cell == null ? null : ({
            month: kasa.months[index], billed: cell.adet, usd: cell.tutar,
          })),
          yearBilled: f.toplamAdet,
          totalUsd: f.toplamTutar,
        }))
        .sort((a, b) => b.billed - a.billed),
      monthly: kasa.monthlyTotals.map((m, i) => ({ month: kasa.months[i], billed: m.adet, usd: m.tutar })),
      aktifKasa: kasa.kpi.aktifKasaToplam,
      faturalanan: kasa.kpi.refAdet,
      aylikGelir: kasa.kpi.refTutar,
      firsat: kasa.kpi.firsatAdet,
      potansiyel: kasa.kpi.potansiyel,
    },
    crm,
    rental,
  };
}
