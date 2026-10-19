import 'server-only';
import { db } from '@/lib/db';
import { buildKasaposEntegrasyonRaporu } from './kasapos-entegrasyon';
import { DEFAULT_RENTAL_OPS_STATUS, RENTAL_OPS_STATUSES, isRentalOpsStatus, rentalOpsLabel, type RentalOpsStatus } from '@/lib/sales/rental-ops';
import { summarizeRental, type RentalItemRow } from './retail-rental';

// Retail Operasyon Paneli — müdürün statik Retail_2026_2027.html panelinin canlı veri karşılığı.
// Kaynaklar:
//   * Gerçekleşen satış: crm_sales (status=active) + crm_sale_items (cihaz kalemleri, sale_type).
//     S210 aksesuardır: ciroya girer, terminal adedine girmez.
//   * KasaPOS aktif / faturalanan / aylık gelir: buildKasaposEntegrasyonRaporu (tek tanım).
//   * Yıl fırsatları: crm_forecasts (is_active, forecast_year).
//   * CRM havuzu: musteriler + musteri_kunye_v2 + musteri_pipeline.

export const ACCESSORY_MODELS = ['S210'];

export type RetailSaleLine = { firm: string; model: string; month: number; qty: number; usd: number; saleType: 'sale' | 'rental' };
export type RetailOpportunity = {
  firm: string; model: string; qty: number; month: number; channel: string; prob: number; note: string; owner: string;
  /** 045 — forecast satırı satış/kiralama, fiyat ve Retail planı kuralı. Liste FİLTRELENMEZ; istemci `includeInRetailPlan` ile süzer. */
  id?: string;
  customerId?: string;
  saleType?: 'sale' | 'rental';
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
  id: string; name: string; sector: string; kasa: string; register: number | null; owner: string;
  status: string; pos: string; posOwner: string; banks: string;
};
export type RetailKasaRow = { firm: string; active: number | null; billed: number; gap: number | null; rate: number | null };
export type RetailOperasyonPayload = {
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

async function fetchSales(year: number): Promise<RetailSaleLine[]> {
  const r = await db.query(
    `
      select m.musteri as firm, i.product_code, extract(month from s.sale_date)::int as ay,
             i.sale_type, sum(i.quantity)::int as qty,
             coalesce(sum(i.total_price) filter (where s.currency = 'USD'), 0)::numeric as usd
      from public.crm_sales s
      join public.crm_sale_items i on i.sale_id = s.id
      join public.musteriler m on m.id = s.customer_id
      where s.status = 'active'
        and s.sale_date >= make_date($1::int, 1, 1) and s.sale_date < make_date($1::int + 1, 1, 1)
        and public.crm_sale_item_is_device(i.product_type, i.is_recurring)
      group by 1, 2, 3, 4
    `,
    [year],
  );
  return (r.rows as any[]).map((x) => ({
    firm: txt(x.firm, '-'),
    model: normModel(x.product_code),
    month: Number(x.ay),
    qty: Number(x.qty) || 0,
    usd: Math.round((Number(x.usd) || 0) * 100) / 100,
    saleType: x.sale_type === 'rental' ? 'rental' : 'sale',
  }));
}

async function fetchOpportunities(years: number[]): Promise<Map<number, RetailOpportunity[]>> {
  const r = await db.query(
    `
      select f.forecast_year, f.forecast_month, m.musteri as firm,
             coalesce(nullif(btrim(f.product_code_snapshot), ''), f.product_name_snapshot) as model,
             f.quantity, f.sales_channel, f.probability, f.note, f.owner_name,
             f.id::text as id, f.customer_id::text as customer_id,
             -- 045 kolonları to_jsonb ile: migration öncesinde de sorgu kırılmaz.
             to_jsonb(f) ->> 'sale_type' as sale_type,
             to_jsonb(f) ->> 'unit_price' as unit_price,
             to_jsonb(f) ->> 'rental_monthly_price' as rental_monthly_price,
             to_jsonb(f) ->> 'include_in_retail_plan' as include_in_retail_plan
      from public.crm_forecasts f
      join public.musteriler m on m.id = f.customer_id
      where f.is_active = true and f.forecast_year = any($1::int[])
      order by f.quantity desc
    `,
    [years],
  );
  const out = new Map<number, RetailOpportunity[]>(years.map((y) => [y, []]));
  for (const x of r.rows as any[]) {
    out.get(Number(x.forecast_year))?.push({
      firm: txt(x.firm, '-'),
      model: normModel(x.model),
      qty: Number(x.quantity) || 0,
      month: Number(x.forecast_month),
      channel: txt(x.sales_channel, '-'),
      prob: Number(x.probability) || 0,
      note: txt(x.note),
      owner: txt(x.owner_name),
      id: String(x.id),
      customerId: String(x.customer_id),
      saleType: x.sale_type === 'rental' ? 'rental' : 'sale',
      unitPrice: numOrNull(x.unit_price),
      rentalMonthlyPrice: numOrNull(x.rental_monthly_price),
      includeInRetailPlan: x.include_in_retail_plan == null ? true : String(x.include_in_retail_plan) === 'true',
    });
  }
  return out;
}

const numOrNull = (v: unknown) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Kiralama kalemleri (sözleşme = satış kaydı; durum crm_sales.rental_ops_status). Yıl filtresi yok: stok. */
async function fetchRental(): Promise<RetailRentalSummary> {
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
        and public.crm_sale_item_is_device(i.product_type, i.is_recurring)
    `,
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

async function fetchCrmPool(): Promise<RetailCrmRow[]> {
  const r = await db.query(
    `
      select m.id::text as id, m.musteri, m.sektor, m.sorumlu,
             ft.asama_adi as faz, k.kasapos_firmasi, k.sabit_kasa_adedi, k.pos_markasi, k.pos_mulkiyet,
             k.pos_mulkiyet_bankalari, k.bankalar
      from public.musteriler m
      left join public.musteri_kunye_v2 k on k.musteri_id = m.id
      left join public.musteri_pipeline mp on mp.musteri_id = m.id
      left join public.faz_tanimlari ft on ft.faz_no = mp.aktif_faz_no
      -- Havuz departman bazlı: yalnız Retail iş kolu (Bank/Vertical hariç).
      where m.is_kolu = 'Retail'
      order by m.musteri
    `,
  );
  const seen = new Set<string>();
  const rows: RetailCrmRow[] = [];
  for (const x of r.rows as any[]) {
    const name = txt(x.musteri);
    const key = name.toLocaleLowerCase('tr-TR');
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const kasaAdet = txt(x.sabit_kasa_adedi);
    const owners = Array.isArray(x.pos_mulkiyet_bankalari) ? x.pos_mulkiyet_bankalari.filter(Boolean) : [];
    const mulk = txt(x.pos_mulkiyet, 'Bilinmeyen');
    rows.push({
      id: String(x.id),
      name,
      sector: txt(x.sektor),
      kasa: txt(x.kasapos_firmasi, 'Bilinmeyen'),
      register: /^\d+$/.test(kasaAdet) ? Number(kasaAdet) : null,
      owner: txt(x.sorumlu),
      status: txt(x.faz, 'Faz yok'),
      pos: txt(x.pos_markasi, 'Bilinmeyen'),
      posOwner: owners.length ? `${mulk} - ${owners.join(', ')}` : mulk,
      banks: Array.isArray(x.bankalar) ? x.bankalar.filter(Boolean).join(', ') : '',
    });
  }
  return rows;
}

export async function buildRetailOperasyon(options?: { year?: number }): Promise<RetailOperasyonPayload> {
  const req = options?.year;
  const year = Number.isInteger(req) && req! > 2000 ? req! : new Date().getFullYear();
  const [sales, opps, kasa, crm, rental] = await Promise.all([
    fetchSales(year),
    fetchOpportunities([year, year + 1]),
    buildKasaposEntegrasyonRaporu({ year }),
    fetchCrmPool(),
    fetchRental(),
  ]);
  const ref = kasa.refMonthIndex;
  return {
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
