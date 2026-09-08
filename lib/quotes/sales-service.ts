import 'server-only';
import { db } from '@/lib/db';
import { rentalMonths, round2 } from '@/lib/quotes/line-pricing';

// Satış kaydı (crm_sales) — kazanılan teklifin türevi, DÜZENLENEBİLİR kayıt.
// Teklif donmuş belgedir: satış düzenlenince teklif satırları/tutarı DEĞİŞMEZ.
// Ciro tek kaynak: status='active' satışların `amount` toplamı.
//
// Tutar hesabı (Sinan, 07.09): cihaz adedi değişince tutar katalog kademesinden
// (quote_pricing_rules) yeniden hesaplanır; "anlaşma fiyatı" girilirse elle ezilir
// ve price_source='manual' olarak işaretlenir.

export type SaleRow = {
  id: string;
  quote_id: string;
  customer_id: string;
  musteri: string;
  quote_no: string;
  owner_name: string;
  sale_date: string;
  device_count: number;
  amount: number;
  price_source: 'catalog' | 'manual';
  status: 'active' | 'cancelled';
  note: string | null;
  /** Kiralama (08.09): 'rental' tümü kiralama, 'mixed' satış + kiralama satırı birlikte. */
  sale_type: 'sale' | 'rental' | 'mixed';
  rental_start_date: string | null;
  rental_end_date: string | null;
  /** Kiralama satırlarının aylık toplamı (birim kira × adet). */
  rental_monthly_amount: number;
  /** Tek seferlik satış satırlarının tutarı. */
  hardware_amount: number;
  /** Teklifteki orijinal değerler — satış düzenlendiyse fark görünür. */
  quote_device_count: number;
  quote_amount: number;
  updated_at: string | null;
  updated_by: string | null;
};

export type RentalPeriod = { start: string | null; end: string | null };

/**
 * Teklifin satırlarını cihaz adedine göre yeniden fiyatlar.
 * Cihaz satırları (product_type='device'|'peripheral') yeni adede göre ölçeklenir;
 * aylık hizmet satırları (is_recurring) teklifteki adetle korunur — donanım adedi
 * değişse de hizmet kalemi ayrı sözleşme kalemidir.
 *
 * Dönen tutar: donanım satırlarının yeni kademe fiyatı × yeni adet + diğer satırlar.
 */
export async function repriceFromCatalog(quoteId: string, newDeviceCount: number, rentalPeriod?: RentalPeriod | null) {
  const { rows } = await db.query<{
    product_id: string;
    quantity: number;
    is_recurring: boolean;
    product_type: string;
    unit_price: number;
    sale_type: string | null;
    rental_start_date: string | null;
    rental_end_date: string | null;
    rental_monthly_price: number | null;
  }>(
    `
      select qi.product_id, qi.quantity, qi.is_recurring, qi.product_type, qi.unit_price::float8 as unit_price,
             qi.sale_type, qi.rental_start_date::text as rental_start_date, qi.rental_end_date::text as rental_end_date,
             qi.rental_monthly_price::float8 as rental_monthly_price
      from public.quote_items qi
      where qi.quote_id = $1
      order by qi.line_no
    `,
    [quoteId],
  );
  const empty = { amount: 0, hardwareAmount: 0, rentalAmount: 0, rentalMonthlyAmount: 0, rentalMonths: 0, deviceCount: newDeviceCount, priced: false, hasLines: false };
  // Teklifte hiç kalem yok (eski/dışarıdan girilmiş teklif): tutar uydurulmaz,
  // çağıran taraf mevcut tutarı korur ve kullanıcıdan anlaşma fiyatı ister.
  if (!rows.length) return empty;

  const isDeviceLike = (row: (typeof rows)[number]) => !row.is_recurring && (row.product_type === 'device' || row.product_type === 'peripheral' || row.product_type === 'bundle');
  const rentalRows = rows.filter((row) => row.sale_type === 'rental');
  const deviceRows = rows.filter((row) => row.sale_type !== 'rental' && isDeviceLike(row));
  const otherRows = rows.filter((row) => row.sale_type !== 'rental' && !isDeviceLike(row));
  // Yeni cihaz adedi satış + kiralama cihaz satırlarına teklifteki paylarıyla dağıtılır.
  const originalDevices = [...deviceRows, ...rentalRows].reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  const scaledQty = (row: (typeof rows)[number]) => {
    const share = originalDevices > 0 ? Number(row.quantity ?? 0) / originalDevices : 1 / Math.max(1, deviceRows.length + rentalRows.length);
    return Math.max(0, Math.round(newDeviceCount * share));
  };

  let hardwareAmount = 0;
  let priced = true;

  for (const row of deviceRows) {
    const qty = scaledQty(row);
    if (!qty) continue;
    const rule = await db.query<{ unit_price: number }>(
      `
        select unit_price::float8 as unit_price
        from public.quote_pricing_rules
        where product_id = $1 and $2::int >= min_qty and (max_qty is null or $2::int <= max_qty)
        order by min_qty asc
        limit 1
      `,
      [row.product_id, qty],
    );
    const unitPrice = rule.rows[0]?.unit_price;
    if (unitPrice == null) { priced = false; hardwareAmount += Number(row.unit_price ?? 0) * qty; continue; }
    hardwareAmount += unitPrice * qty;
  }

  // Aylık hizmet / diğer kalemler teklifteki hâliyle kalır (tek seferlik tutara dahil).
  for (const row of otherRows) hardwareAmount += Number(row.unit_price ?? 0) * Number(row.quantity ?? 0);

  // Kiralama: aylık birim kira × adet. Tarih yoksa (08.09 modeli) satır tutarı aylık tutardır;
  // eski tarihli kayıtta (ya da satışta dönem verilmişse) sözleşme değeri = aylık × ay.
  let rentalMonthlyAmount = 0;
  let rentalAmount = 0;
  let months = 0;
  for (const row of rentalRows) {
    const qty = scaledQty(row);
    if (!qty) continue;
    const hasPeriod = Boolean((rentalPeriod?.start && rentalPeriod?.end) || (row.rental_start_date && row.rental_end_date));
    const lineMonths = rentalPeriod?.start && rentalPeriod?.end
      ? rentalMonths(rentalPeriod.start, rentalPeriod.end)
      : rentalMonths(row.rental_start_date, row.rental_end_date);
    if (hasPeriod && lineMonths <= 0) priced = false;
    months = Math.max(months, lineMonths);
    const monthly = Number(row.rental_monthly_price ?? row.unit_price ?? 0) * qty;
    if (monthly <= 0) priced = false;
    rentalMonthlyAmount += monthly;
    rentalAmount += hasPeriod ? monthly * lineMonths : monthly;
  }

  return {
    amount: round2(hardwareAmount + rentalAmount),
    hardwareAmount: round2(hardwareAmount),
    rentalAmount: round2(rentalAmount),
    rentalMonthlyAmount: round2(rentalMonthlyAmount),
    rentalMonths: months,
    deviceCount: newDeviceCount,
    priced,
    hasLines: true,
  };
}

export async function listSales(options?: { owner?: string; status?: string; q?: string; limit?: number }) {
  const owner = String(options?.owner ?? '').trim();
  const status = String(options?.status ?? '').trim();
  const search = String(options?.q ?? '').trim();
  const limit = Math.min(500, Math.max(1, Number(options?.limit ?? 200)));

  const { rows } = await db.query(
    `
      select s.id::text, s.quote_id::text, s.customer_id::text, m.musteri, s.quote_no, s.owner_name,
             s.sale_date::text, s.device_count, s.amount::float8 as amount, s.price_source, s.status,
             s.note, s.updated_at, s.updated_by,
             s.sale_type, s.rental_start_date::text as rental_start_date, s.rental_end_date::text as rental_end_date,
             s.rental_monthly_amount::float8 as rental_monthly_amount, s.hardware_amount::float8 as hardware_amount,
             coalesce(q.total_device_count, 0) as quote_device_count,
             coalesce(q.total_amount, 0)::float8 as quote_amount
      from public.crm_sales s
      join public.musteriler m on m.id = s.customer_id
      left join public.quotes q on q.id = s.quote_id
      where ($1 = '' or s.owner_name = $1)
        and ($2 = '' or s.status = $2)
        and ($3 = '' or m.musteri ilike '%' || $3 || '%' or s.quote_no ilike '%' || $3 || '%')
      order by s.sale_date desc, s.created_at desc
      limit $4
    `,
    [owner, status, search, limit],
  );
  return rows as unknown as SaleRow[];
}

/** Satış özeti: adet/tutar + dönüşüm oranı için kazanılan sayısı. */
export async function salesSummary(year: number) {
  const { rows } = await db.query(
    `
      select count(*)::int as sale_count,
             coalesce(sum(amount), 0)::float8 as amount,
             coalesce(sum(device_count), 0)::int as devices
      from public.crm_sales
      where status = 'active' and extract(year from sale_date) = $1
    `,
    [year],
  );
  return rows[0] as { sale_count: number; amount: number; devices: number };
}
