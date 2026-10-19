import 'server-only';
import { db } from '@/lib/db';
import { buildKasaposEntegrasyonRaporu } from './kasapos-entegrasyon';

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
             f.quantity, f.sales_channel, f.probability, f.note, f.owner_name
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
    });
  }
  return out;
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
  const [sales, opps, kasa, crm] = await Promise.all([
    fetchSales(year),
    fetchOpportunities([year, year + 1]),
    buildKasaposEntegrasyonRaporu({ year }),
    fetchCrmPool(),
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
  };
}
