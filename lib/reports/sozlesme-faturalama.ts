import { db } from '@/lib/db';
import { INTEGRATION_DEVICE_SERVICE_KEYS } from '@/lib/sales/service-invoices-shared';

// Sözleşme / Faturalama raporu (057). Kaynak: Hizmet Faturaları (crm_service_invoices) — KasaPOS Adet & Tutar
// ile aynı süzgeç (KasaPOS kalemleri; adet = quantity, tutar = USD total_price).
// Sözleşme = firma. Başlangıç = faturalardaki sözleşme başlangıcı, yoksa ilk fatura dönemi.
// Bitiş = sözleşme bitişi (Bitir); yoksa süresiz. Fatura olan ay gerçek değer; faturasız ay (sözleşme sürerken)
// son faturanın değeriyle devam eder.

export type ContractFirmRow = {
  customerId: string;
  /** fatura = Hizmet Faturaları (KasaPOS) · satis = kiralama satışı (Satışlar). */
  source: 'fatura' | 'satis';
  musteri: string;
  owner: string;
  start: string;
  fromPeriod: boolean;
  end: string | null;
  firstPeriod: string;
  lastPeriod: string;
  invoices: number;
  lastAdet: number;
  lastTutar: number;
  /** Ay başına değer; `actual` false ise son faturadan taşındı. */
  cells: Array<{ adet: number; tutar: number; actual: boolean }>;
};

/** adet/tutar = KasaPOS faturaları + kiralama satışları; satisAdet = bunun kiralama satışından gelen kısmı. */
export type BillingMonth = { month: string; adet: number; tutar: number; firma: number; yeni: number; satisAdet: number };

export type SozlesmeFaturalamaPayload = {
  year: number;
  months: string[];
  refMonthIndex: number;
  monthly: BillingMonth[];
  rows: ContractFirmRow[];
  kpi: {
    refAdet: number; prevAdet: number;
    refTutar: number; prevTutar: number;
    refFirma: number; prevFirma: number;
    toplamFirma: number; devamEden: number; biten: number;
    baslangicGirilmemis: number;
    yaklasanBitis: number;
  };
  generatedAt: string;
};

const mk = (v: string) => v.slice(0, 7);

export async function buildSozlesmeFaturalama({ year }: { year?: number } = {}): Promise<SozlesmeFaturalamaPayload> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const curYear = Number(today.slice(0, 4));
  const y = year && year > 2000 && year < 2100 ? year : curYear;

  const { rows } = await db.query<any>(
    `
      select s.customer_id::text as customer_id, coalesce(m.musteri, '—') as musteri,
             coalesce(nullif(trim(s.owner_name), ''), 'Havuz Account') as owner,
             s.period_month::text as period, s.contract_start_date::text as c_start, s.contract_end_date::text as c_end,
             coalesce(sum(i.quantity), 0)::int as adet,
             coalesce(sum(i.total_price) filter (where s.currency = 'USD'), 0)::float8 as tutar
      from public.crm_service_invoices s
      join public.crm_service_invoice_items i on i.invoice_id = s.id
      left join public.musteriler m on m.id = s.customer_id
      where s.status = 'active'
        and (lower(btrim(i.service_key)) = any($1::text[]) or lower(btrim(i.service_label)) = any($1::text[]))
      group by s.id, s.customer_id, m.musteri, s.owner_name, s.period_month, s.contract_start_date, s.contract_end_date
      order by s.period_month
    `,
    [INTEGRATION_DEVICE_SERVICE_KEYS],
  );

  type Inv = { period: string; adet: number; tutar: number; owner: string; start: string | null; end: string | null };
  const firms = new Map<string, { musteri: string; inv: Map<string, Inv> }>();
  for (const r of rows) {
    const f = firms.get(r.customer_id) ?? { musteri: r.musteri, inv: new Map<string, Inv>() };
    const key = mk(r.period);
    const cur = f.inv.get(key);
    // Aynı ay birden fazla fatura (TL + USD) → topla.
    f.inv.set(key, {
      period: key,
      adet: (cur?.adet ?? 0) + Number(r.adet ?? 0),
      tutar: (cur?.tutar ?? 0) + Number(r.tutar ?? 0),
      owner: r.owner,
      start: r.c_start ?? cur?.start ?? null,
      end: r.c_end ?? cur?.end ?? null,
    });
    firms.set(r.customer_id, f);
  }

  // Kiralama satışları (Satışlar): fatura başlangıcından (yoksa satış tarihi) itibaren her ay, bitene kadar
  // cihaz adedi + aylık kira KasaPOS sayılarının üstüne eklenir. Tek seferlik cihaz satışları dahil değil.
  const { rows: rentals } = await db.query<any>(
    `
      select s.customer_id::text as customer_id, coalesce(m.musteri, '—') as musteri,
             coalesce(nullif(trim(s.owner_name), ''), 'Havuz Account') as owner,
             coalesce(s.billing_start_date, s.sale_date)::text as start, (s.billing_start_date is null) as from_sale,
             s.contract_ended_on::text as c_end,
             (case when exists (select 1 from public.crm_sale_items i where i.sale_id = s.id)
                   then coalesce((select sum(i.quantity) filter (where public.crm_sale_item_is_device(i.product_type, i.is_recurring))
                                  from public.crm_sale_items i where i.sale_id = s.id), 0)
                   else coalesce(s.device_count, 0) end)::int as adet,
             (case when s.currency = 'USD' then coalesce(nullif(s.rental_monthly_amount, 0), s.amount, 0) else 0 end)::float8 as tutar
      from public.crm_sales s
      left join public.musteriler m on m.id = s.customer_id
      where s.status = 'active' and s.sale_type in ('rental', 'mixed')
    `,
  );

  const base = [...firms.entries()].map(([customerId, f]) => {
    const inv = [...f.inv.values()].sort((a, b) => a.period.localeCompare(b.period));
    const starts = inv.map((x) => x.start).filter(Boolean) as string[];
    const last = inv[inv.length - 1];
    // Bitiş: en son faturadaki bitiş; yoksa herhangi bir faturadaki en geç bitiş.
    const ends = inv.map((x) => x.end).filter(Boolean) as string[];
    const end = last.end ?? (ends.length ? ends.sort().at(-1)! : null);
    const start = starts.length ? starts.sort()[0] : `${inv[0].period}-01`;
    return { customerId, musteri: f.musteri, inv, start, fromPeriod: !starts.length, end, last };
  });

  // Ay aralığı: seçilen yılın Ocak'ından en az o yılın Aralık'ı / bu ay / en geç faturaya kadar kesintisiz.
  const lastKey = [`${y}-12`, mk(today), ...base.map((b) => b.last.period)].sort().at(-1)!;
  const months: string[] = [];
  for (let yy = y, mm = 1; ; ) {
    const k = `${yy}-${String(mm).padStart(2, '0')}`;
    months.push(k);
    if (k >= lastKey) break;
    if (++mm > 12) { mm = 1; yy++; }
  }
  const curIdx = months.indexOf(mk(today));
  const ref = curIdx >= 0 ? curIdx : months.length - 1;

  const list: ContractFirmRow[] = base
    .map((b) => {
      const sKey = mk(b.start);
      const eKey = b.end ? mk(b.end) : null;
      const cells = months.map((month) => {
        const own = b.inv.find((x) => x.period === month);
        if (own) return { adet: own.adet, tutar: own.tutar, actual: true };
        if (month < sKey || (eKey && month > eKey)) return { adet: 0, tutar: 0, actual: false };
        const prev = [...b.inv].reverse().find((x) => x.period < month);
        return prev ? { adet: prev.adet, tutar: prev.tutar, actual: false } : { adet: 0, tutar: 0, actual: false };
      });
      return {
        customerId: b.customerId,
        source: 'fatura' as const,
        musteri: b.musteri,
        owner: b.last.owner,
        start: b.start,
        fromPeriod: b.fromPeriod,
        end: b.end,
        firstPeriod: b.inv[0].period,
        lastPeriod: b.last.period,
        invoices: b.inv.length,
        lastAdet: b.last.adet,
        lastTutar: b.last.tutar,
        cells,
      };
    })
    .filter((r) => r.cells.some((c) => c.adet || c.tutar))
    .sort((a, b) => b.cells[ref].adet - a.cells[ref].adet || b.lastAdet - a.lastAdet || a.musteri.localeCompare(b.musteri, 'tr'));

  const rentalFirms = new Map<string, any[]>();
  for (const r of rentals) rentalFirms.set(r.customer_id, [...(rentalFirms.get(r.customer_id) ?? []), r]);
  for (const [customerId, rs] of rentalFirms) {
    const sorted = [...rs].sort((a, b) => String(a.start).localeCompare(String(b.start)));
    const active = (r: any, month: string) => mk(r.start) <= month && (!r.c_end || mk(r.c_end) >= month);
    const cells = months.map((month) => {
      const act = sorted.filter((r) => active(r, month));
      return { adet: act.reduce((s, r) => s + Number(r.adet ?? 0), 0), tutar: act.reduce((s, r) => s + Number(r.tutar ?? 0), 0), actual: true };
    });
    if (!cells.some((c) => c.adet || c.tutar)) continue;
    const ends = sorted.map((r) => r.c_end);
    const lastSale = sorted[sorted.length - 1];
    const refCell = cells[ref].adet ? cells[ref] : cells.find((c) => c.adet) ?? cells[0];
    list.push({
      customerId,
      source: 'satis',
      musteri: lastSale.musteri,
      owner: lastSale.owner,
      start: sorted[0].start,
      fromPeriod: sorted.some((r) => r.from_sale),
      end: ends.every(Boolean) ? ends.sort().at(-1) : null,
      firstPeriod: mk(sorted[0].start),
      lastPeriod: mk(lastSale.start),
      invoices: sorted.length,
      lastAdet: refCell.adet,
      lastTutar: refCell.tutar,
      cells,
    });
  }
  list.sort((a, b) => b.cells[ref].adet - a.cells[ref].adet || b.lastAdet - a.lastAdet || a.musteri.localeCompare(b.musteri, 'tr'));

  const monthly: BillingMonth[] = months.map((month, i) => {
    const act = list.filter((r) => r.cells[i].adet || r.cells[i].tutar);
    return {
      month,
      adet: act.reduce((s, r) => s + r.cells[i].adet, 0),
      tutar: act.reduce((s, r) => s + r.cells[i].tutar, 0),
      firma: new Set(act.map((r) => r.customerId)).size,
      yeni: list.filter((r) => mk(r.start) === month).length,
      satisAdet: act.filter((r) => r.source === 'satis').reduce((s, r) => s + r.cells[i].adet, 0),
    };
  });

  const cur = monthly[ref];
  const prev = ref > 0 ? monthly[ref - 1] : { adet: 0, tutar: 0, firma: 0, satisAdet: 0 } as BillingMonth;
  const in90 = new Date(`${today}T00:00:00Z`);
  in90.setUTCDate(in90.getUTCDate() + 90);
  const limit = in90.toISOString().slice(0, 10);
  const biten = list.filter((r) => r.end && r.end < today).length;

  return {
    year: y,
    months,
    refMonthIndex: ref,
    monthly,
    rows: list,
    kpi: {
      refAdet: cur.adet, prevAdet: prev.adet,
      refTutar: cur.tutar, prevTutar: prev.tutar,
      refFirma: cur.firma, prevFirma: prev.firma,
      toplamFirma: list.length,
      devamEden: list.length - biten,
      biten,
      baslangicGirilmemis: list.filter((r) => r.source === 'fatura' && r.fromPeriod).length,
      yaklasanBitis: list.filter((r) => r.end && r.end >= today && r.end <= limit).length,
    },
    generatedAt: new Date().toISOString(),
  };
}
