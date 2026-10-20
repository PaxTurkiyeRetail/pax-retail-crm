import 'server-only';
import { db } from '@/lib/db';
import { buildKasaposEntegrasyonRaporu } from './kasapos-entegrasyon';
import { DEFAULT_RENTAL_OPS_STATUS, RENTAL_OPS_STATUSES, isRentalOpsStatus, rentalOpsLabel, type RentalOpsStatus } from '@/lib/sales/rental-ops';
import { summarizeRental, type RentalItemRow } from './retail-rental';
import { loadRetailPlan } from './retail-plan';

// Retail Operasyon Paneli — müdürün statik Retail_2026_2027.html panelinin canlı veri karşılığı.
// Kaynaklar:
//   * Gerçekleşen satış: crm_sales (status=active) + crm_sale_items (cihaz kalemleri, sale_type).
//     S210 aksesuardır: ciroya girer, terminal adedine girmez.
//   * KasaPOS aktif / faturalanan / aylık gelir: buildKasaposEntegrasyonRaporu (tek tanım).
//   * Yıl fırsatları: ayrı Retail planı (crm_retail_plan_entries); genel Forecast kayıtları karıştırılmaz.
//   * CRM havuzu: musteriler + musteri_kunye_v2 + musteri_pipeline.

export const ACCESSORY_MODELS = ['S210'];

export type RetailSaleLine = { firm: string; model: string; month: number; qty: number; usd: number; usdQty?: number; saleType: 'sale' | 'rental' };
export type RetailOpportunity = {
  firm: string; model: string; qty: number; month: number; channel: string; prob: number; note: string; owner: string;
  /** Ayrı Retail planı ve eski Forecast istemcileri için açık kaynak / iş modeli bilgisi. */
  id?: string;
  customerId?: string;
  productId?: string;
  saleType?: 'sale' | 'rental' | 'bank';
  businessModel?: 'sale' | 'rental' | 'bank';
  source?: 'retail_plan' | 'forecast';
  referenceKey?: string;
  sourceName?: string;
  updatedAt?: string;
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
  canEditRetailPlan?: boolean;
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
             coalesce(sum(i.quantity) filter (where s.currency = 'USD'), 0)::int as usd_qty,
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
    usdQty: Number(x.usd_qty) || 0,
    saleType: x.sale_type === 'rental' ? 'rental' : 'sale',
  }));
}

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
             rpm.retail_status, rpm.register_vendor_group,
             ft.asama_adi as faz, k.kasapos_firmasi, k.sabit_kasa_adedi, k.pos_markasi, k.pos_mulkiyet,
             k.pos_mulkiyet_bankalari, k.bankalar
      from public.crm_retail_pool_memberships rpm
      join public.musteriler m on m.id = rpm.customer_id
      left join public.musteri_kunye_v2 k on k.musteri_id = m.id
      left join public.musteri_pipeline mp on mp.musteri_id = m.id
      left join public.faz_tanimlari ft on ft.faz_no = mp.aktif_faz_no
      -- Açık rapor havuzu: kanonik üyelikler, departmandan bağımsız. Boşsa global havuza dönülmez.
      order by m.musteri
    `,
  );
  const seen = new Set<string>();
  const rows: RetailCrmRow[] = [];
  for (const x of r.rows as any[]) {
    const customerId = String(x.id);
    const name = txt(x.musteri, 'Adsız müşteri');
    if (seen.has(customerId)) continue;
    seen.add(customerId);
    const kasaAdet = txt(x.sabit_kasa_adedi);
    const owners = Array.isArray(x.pos_mulkiyet_bankalari) ? x.pos_mulkiyet_bankalari.filter(Boolean) : [];
    const mulk = txt(x.pos_mulkiyet, 'Bilinmeyen');
    rows.push({
      id: customerId,
      customerId,
      name,
      sector: txt(x.sektor),
      kasa: txt(x.register_vendor_group, 'Bilinmeyen'),
      rawKasa: txt(x.kasapos_firmasi, 'Bilinmeyen'),
      register: /^\d+$/.test(kasaAdet) ? Number(kasaAdet) : null,
      owner: txt(x.sorumlu),
      status: txt(x.retail_status, 'Bilinmeyen'),
      phase: txt(x.faz, 'Faz yok'),
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
    loadRetailPlan([year, year + 1]),
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
