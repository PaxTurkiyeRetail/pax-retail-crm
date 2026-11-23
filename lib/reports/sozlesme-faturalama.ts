import { db } from '@/lib/db';

// Sözleşme / Faturalama raporu (054). Faturalama tarihi = fatura başlangıcı, yoksa satış tarihi.
// Kaynak: crm_sales (aktif). Kurallar crm_sales_billing_v ile aynı.

export type BillingSaleRow = {
  saleId: string;
  customerId: string;
  musteri: string;
  owner: string;
  saleDate: string;
  billingStart: string | null;
  billingDate: string;
  fromSaleDate: boolean;
  contractNo: string | null;
  contractMonths: number | null;
  contractEnd: string | null;
  saleType: 'sale' | 'rental' | 'mixed';
  salesChannel: string | null;
  devices: number;
  amount: number;
  rentalMonthly: number;
};

export type BillingMonth = { month: string; adet: number; cihaz: number; tutar: number; kira: number; firma: number };

export type SozlesmeFaturalamaPayload = {
  year: number;
  months: string[];
  refMonthIndex: number;
  monthly: BillingMonth[];
  rows: BillingSaleRow[];
  kpi: {
    refAdet: number; prevAdet: number;
    refCihaz: number; prevCihaz: number;
    refTutar: number; prevTutar: number;
    toplamAdet: number; toplamTutar: number; toplamKira: number;
    faturaGirilmemis: number;
    yaklasanBitis: number;
  };
  generatedAt: string;
};

export async function buildSozlesmeFaturalama({ year }: { year?: number } = {}): Promise<SozlesmeFaturalamaPayload> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const curYear = Number(today.slice(0, 4));
  const y = year && year > 2000 && year < 2100 ? year : curYear;
  // Seçilen yılın Ocak ayından başlar, ileri tarihli en son fatura başlangıcına kadar kesintisiz devam eder
  // (en az o yılın Aralık'ı ve bu ay).

  const { rows } = await db.query<any>(
    `
      with s as (
        select s.id, s.customer_id, coalesce(m.musteri, '—') as musteri,
               coalesce(nullif(trim(s.owner_name), ''), 'Havuz Account') as owner,
               s.sale_date, s.billing_start_date,
               coalesce(s.billing_start_date, s.sale_date) as billing_date,
               s.contract_no, s.contract_months, s.sale_type, s.sales_channel,
               s.amount, s.rental_monthly_amount, s.device_count,
               coalesce((select sum(i.quantity) filter (where public.crm_sale_item_is_device(i.product_type, i.is_recurring))
                         from public.crm_sale_items i where i.sale_id = s.id), 0)::int as item_devices,
               (select count(*) from public.crm_sale_items i where i.sale_id = s.id)::int as item_count
        from public.crm_sales s
        left join public.musteriler m on m.id = s.customer_id
        where s.status = 'active'
          -- Yalnız sözleşme / faturalama bilgisi girilmiş satışlar.
          and (s.billing_start_date is not null or nullif(trim(s.contract_no), '') is not null or s.contract_months is not null)
      )
      select id::text as sale_id, customer_id::text as customer_id, musteri, owner,
             sale_date::text as sale_date, billing_start_date::text as billing_start,
             billing_date::text as billing_date, contract_no, contract_months,
             case when contract_months is null then null
                  else (billing_date + make_interval(months => contract_months) - interval '1 day')::date::text end as contract_end,
             sale_type, sales_channel,
             (case when item_count > 0 then item_devices else device_count end)::int as devices,
             coalesce(amount, 0)::float8 as amount, coalesce(rental_monthly_amount, 0)::float8 as rental_monthly
      from s
      where billing_date >= make_date($1::int, 1, 1)
      order by billing_date desc, musteri
    `,
    [y],
  );

  const list: BillingSaleRow[] = rows.map((r: any) => ({
    saleId: r.sale_id,
    customerId: r.customer_id,
    musteri: r.musteri,
    owner: r.owner,
    saleDate: r.sale_date,
    billingStart: r.billing_start,
    billingDate: r.billing_date,
    fromSaleDate: !r.billing_start,
    contractNo: r.contract_no,
    contractMonths: r.contract_months == null ? null : Number(r.contract_months),
    contractEnd: r.contract_end,
    saleType: r.sale_type,
    salesChannel: r.sales_channel,
    devices: Number(r.devices ?? 0),
    amount: Number(r.amount ?? 0),
    rentalMonthly: Number(r.rental_monthly ?? 0),
  }));

  const lastKey = [`${y}-12`, today.slice(0, 7), ...list.map((r) => r.billingDate.slice(0, 7))].sort().at(-1)!;
  const months: string[] = [];
  for (let yy = y, mm = 1; ; ) {
    const k = `${yy}-${String(mm).padStart(2, '0')}`;
    months.push(k);
    if (k >= lastKey) break;
    if (++mm > 12) { mm = 1; yy++; }
  }
  const curIdx = months.indexOf(today.slice(0, 7));
  const refIdx = curIdx >= 0 ? curIdx : months.length - 1;

  const monthly: BillingMonth[] = months.map((month) => {
    const inMonth = list.filter((r) => r.billingDate.startsWith(month));
    return {
      month,
      adet: inMonth.length,
      cihaz: inMonth.reduce((s, r) => s + r.devices, 0),
      tutar: inMonth.reduce((s, r) => s + r.amount, 0),
      kira: inMonth.reduce((s, r) => s + r.rentalMonthly, 0),
      firma: new Set(inMonth.map((r) => r.customerId)).size,
    };
  });

  const ref = refIdx;
  const cur = monthly[ref];
  const prev = ref > 0 ? monthly[ref - 1] : { adet: 0, cihaz: 0, tutar: 0 } as BillingMonth;
  const in90 = new Date(`${today}T00:00:00Z`);
  in90.setUTCDate(in90.getUTCDate() + 90);
  const limit = in90.toISOString().slice(0, 10);

  return {
    year: y,
    months,
    refMonthIndex: ref,
    monthly,
    rows: list,
    kpi: {
      refAdet: cur.adet, prevAdet: prev.adet,
      refCihaz: cur.cihaz, prevCihaz: prev.cihaz,
      refTutar: cur.tutar, prevTutar: prev.tutar,
      toplamAdet: list.length,
      toplamTutar: list.reduce((s, r) => s + r.amount, 0),
      toplamKira: list.reduce((s, r) => s + r.rentalMonthly, 0),
      faturaGirilmemis: list.filter((r) => r.fromSaleDate).length,
      yaklasanBitis: list.filter((r) => r.contractEnd && r.contractEnd >= today && r.contractEnd <= limit).length,
    },
    generatedAt: new Date().toISOString(),
  };
}
