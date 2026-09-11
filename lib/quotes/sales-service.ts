import 'server-only';
import { db } from '@/lib/db';
import { rentalMonths, round2 } from '@/lib/quotes/line-pricing';
import { ApiError } from '@/lib/http/api-error';

// Satış kaydı (crm_sales) — kazanılan teklifin türevi, DÜZENLENEBİLİR kayıt.
// Teklif donmuş belgedir: satış düzenlenince teklif satırları/tutarı DEĞİŞMEZ.
// Ciro tek kaynak: status='active' satışların `amount` toplamı.
//
// Tutar hesabı (Sinan, 07.09): cihaz adedi değişince tutar katalog kademesinden
// (quote_pricing_rules) yeniden hesaplanır; "anlaşma fiyatı" girilirse elle ezilir
// ve price_source='manual' olarak işaretlenir.

export type SaleRow = {
  id: string;
  /** Teklifsiz (doğrudan) satışta null — migration 027. */
  quote_id: string | null;
  customer_id: string;
  musteri: string;
  quote_no: string | null;
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
  /** Satış kanalı (Banka · Direkt Satış · Kanal) — Forecast'in listesiyle aynı kaynak (027). */
  sales_channel: string | null;
  /** quote = kazanılan teklifden · direct = Satışlar ekranından teklifsiz girildi (027). */
  source: 'quote' | 'direct';
  /** Teklifteki orijinal değerler — satış düzenlendiyse fark görünür (doğrudan satışta 0). */
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
             s.note, s.updated_at, s.updated_by, s.sales_channel, s.source,
             s.sale_type, s.rental_start_date::text as rental_start_date, s.rental_end_date::text as rental_end_date,
             s.rental_monthly_amount::float8 as rental_monthly_amount, s.hardware_amount::float8 as hardware_amount,
             coalesce(q.total_device_count, 0) as quote_device_count,
             coalesce(q.total_amount, 0)::float8 as quote_amount
      from public.crm_sales s
      join public.musteriler m on m.id = s.customer_id
      left join public.quotes q on q.id = s.quote_id
      where ($1 = '' or s.owner_name = $1)
        and ($2 = '' or s.status = $2)
        and ($3 = '' or m.musteri ilike '%' || $3 || '%' or coalesce(s.quote_no, '') ilike '%' || $3 || '%')
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


/* ------------------------------------------------------------------------ */
/* Satış kalemleri (crm_sale_items · migration 030)                          */
/* ------------------------------------------------------------------------ */

export type SaleItemInput = {
  product_id: string | null;
  product_code: string;
  product_name?: string | null;
  product_type?: string | null;
  is_recurring?: boolean;
  quantity: number;
  sale_type?: 'sale' | 'rental';
  unit_price?: number;
  total_price?: number;
  rental_monthly_price?: number | null;
  rental_start_date?: string | null;
  rental_end_date?: string | null;
};

/**
 * Bir satışın kalemlerini (fatura satırları) yazar — önce varsa siler, sonra yeniden kurar.
 * Çağdaş Bey, 11.09: "Bunun altta kalemler olmalı… basınca ne sattığını göreyim."
 * Canlı Ekran'ın model bazlı cihaz kırılımı BU tablodan okunur; kalem yazılmayan satış
 * kırılımda görünmez (toplamda "kalemsiz" olarak sayılır).
 */
export async function replaceSaleItems(saleId: string, items: SaleItemInput[]) {
  await db.query('delete from public.crm_sale_items where sale_id = $1', [saleId]);
  let lineNo = 0;
  for (const item of items) {
    const quantity = Math.floor(Number(item.quantity ?? 0));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    lineNo += 1;
    await db.query(
      `insert into public.crm_sale_items
         (sale_id, line_no, product_id, product_code, product_name, product_type, is_recurring,
          quantity, sale_type, unit_price, total_price, rental_monthly_price, rental_start_date, rental_end_date)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14::date)`,
      [
        saleId, lineNo, item.product_id, String(item.product_code ?? '').trim() || 'BILINMIYOR',
        item.product_name ?? null, item.product_type ?? 'device', Boolean(item.is_recurring),
        quantity, item.sale_type === 'rental' ? 'rental' : 'sale',
        round2(Number(item.unit_price ?? 0)), round2(Number(item.total_price ?? 0)),
        item.rental_monthly_price == null ? null : round2(Number(item.rental_monthly_price)),
        item.rental_start_date ?? null, item.rental_end_date ?? null,
      ],
    );
  }
  return lineNo;
}

/** Teklif kazanılınca açılan satışın kalemleri: teklifin kalemlerinin KOPYASI (teklif donmuş belgedir). */
export async function copySaleItemsFromQuote(saleId: string, quoteId: string) {
  const { rows } = await db.query<SaleItemInput>(
    `select qi.product_id::text as product_id,
            coalesce(nullif(trim(p.code), ''), 'BILINMIYOR') as product_code,
            coalesce(nullif(trim(p.name), ''), nullif(trim(p.code), '')) as product_name,
            coalesce(nullif(trim(qi.product_type), ''), 'device') as product_type,
            coalesce(qi.is_recurring, false) as is_recurring,
            qi.quantity,
            case when qi.sale_type = 'rental' then 'rental' else 'sale' end as sale_type,
            coalesce(qi.unit_price, 0)::float8 as unit_price,
            coalesce(qi.total_price, 0)::float8 as total_price,
            qi.rental_monthly_price::float8 as rental_monthly_price,
            qi.rental_start_date::text as rental_start_date,
            qi.rental_end_date::text as rental_end_date
     from public.quote_items qi
     left join public.quote_products p on p.id = qi.product_id
     where qi.quote_id = $1
     order by qi.line_no, qi.id`,
    [quoteId],
  );
  return replaceSaleItems(saleId, rows);
}

/**
 * Satış düzenlenince (cihaz adedi değişince) kalemlerin adetleri ORANTILI ölçeklenir —
 * `repriceFromCatalog` tutarı nasıl ölçekliyorsa kalemler de öyle. Kalem yoksa hiçbir şey yapılmaz.
 * Aylık hizmet kalemleri (is_recurring) cihaz sayılmadığı için dokunulmaz.
 */
export async function rescaleSaleItems(saleId: string, newDeviceCount: number) {
  const { rows } = await db.query<{ id: string; quantity: number; unit_price: number; is_device: boolean }>(
    `select i.id::text as id, i.quantity, i.unit_price::float8 as unit_price,
            public.crm_sale_item_is_device(i.product_type, i.is_recurring) as is_device
     from public.crm_sale_items i where i.sale_id = $1 order by i.line_no`,
    [saleId],
  );
  const deviceRows = rows.filter((row) => row.is_device);
  const current = deviceRows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  if (!deviceRows.length || current === newDeviceCount) return false;
  let left = Math.max(0, Math.floor(newDeviceCount));
  for (let index = 0; index < deviceRows.length; index += 1) {
    const row = deviceRows[index];
    const last = index === deviceRows.length - 1;
    const share = current > 0 ? Number(row.quantity ?? 0) / current : 1 / deviceRows.length;
    const quantity = last ? left : Math.min(left, Math.max(0, Math.round(newDeviceCount * share)));
    left -= quantity;
    if (quantity <= 0) {
      await db.query('delete from public.crm_sale_items where id = $1', [row.id]);
      continue;
    }
    await db.query(
      'update public.crm_sale_items set quantity = $2, total_price = $3 where id = $1',
      [row.id, quantity, round2(Number(row.unit_price ?? 0) * quantity)],
    );
  }
  return true;
}

/** Satışın kalem tutarları toplamı — doğrudan satışta başlık tutarı buradan tazelenir. */
export async function sumSaleItems(saleId: string): Promise<number | null> {
  const { rows } = await db.query<{ total: number | null }>(
    'select sum(total_price)::float8 as total from public.crm_sale_items where sale_id = $1',
    [saleId],
  );
  const total = rows[0]?.total;
  return total == null ? null : round2(Number(total));
}

/** Satışın kalemleri (satış detayı ve model kırılımı). */
export async function listSaleItems(saleId: string) {
  const { rows } = await db.query(
    `select i.id::text as id, i.line_no, i.product_id::text as product_id, i.product_code, i.product_name,
            i.product_type, i.is_recurring, i.quantity, i.sale_type,
            i.unit_price::float8 as unit_price, i.total_price::float8 as total_price,
            i.rental_monthly_price::float8 as rental_monthly_price,
            i.rental_start_date::text as rental_start_date, i.rental_end_date::text as rental_end_date
     from public.crm_sale_items i where i.sale_id = $1 order by i.line_no`,
    [saleId],
  );
  return rows;
}

/* ------------------------------------------------------------------------ */
/* Doğrudan (teklifsiz) satış — Sinan/Furkan, 10.09; migration 027           */
/* ------------------------------------------------------------------------ */

export type DirectSaleLineInput = { product_id: string; quantity: number; sale_type?: 'sale' | 'rental'; rental_start_date?: string | null; rental_end_date?: string | null };

export type DirectSaleInput = {
  customerId: string;
  saleDate: string;
  salesChannel?: string | null;
  note?: string | null;
  /** Ürün + adet satırları; tutar katalog kademesinden hesaplanır (teklif ekranıyla aynı motor). */
  lines: DirectSaleLineInput[];
  /** Anlaşma fiyatı: verilirse katalog tutarını ezer, kayıt `manual` işaretlenir. */
  agreedAmount?: number | null;
};

export type DirectSaleActor = { id: string; name: string; email: string };

/**
 * Teklifi olmayan satışı kaydeder. Fiyat teklif oluşturmadaki motorla hesaplanır
 * (`resolveQuoteLines` → kademeli katalog fiyatı, kiralama tarifesi); böylece "ikinci bir
 * fiyat mantığı" doğmaz. Satış tipi satırlardan türetilir: hepsi kiralama → 'rental',
 * karışık → 'mixed', değilse 'sale'.
 *
 * Sahiplik kontrolü ÇAĞIRANDA (API): account_manager yalnız kendi portföyündeki firmaya.
 */
export async function createDirectSale(actor: DirectSaleActor, input: DirectSaleInput) {
  const { getQuoteCatalog, resolveQuoteLines } = await import('@/lib/quotes/service');
  const { createPgAdminClient } = await import('@/lib/pg/admin');
  // Katalog DB'den (Ürün & Fiyat Yönetimi'ndeki yürürlükteki liste); `getQuoteCatalog()` istemcisiz
  // çağrılırsa statik yedeğe düşer, satışta yanlış fiyat üretir.
  const catalog = await getQuoteCatalog(createPgAdminClient());
  const resolved = resolveQuoteLines(
    input.lines.map((line) => ({
      product_id: line.product_id,
      quantity: Number(line.quantity ?? 0),
      sale_type: line.sale_type ?? 'sale',
      rental_start_date: line.rental_start_date ?? null,
      rental_end_date: line.rental_end_date ?? null,
    })),
    catalog,
  );
  if (!resolved.items.length) throw new ApiError('SALE_NO_LINES', 'En az bir ürün satırı girilmeli.', 400);

  const rentalLines = resolved.items.filter((line) => line.sale_type === 'rental');
  const saleType = rentalLines.length === 0 ? 'sale' : rentalLines.length === resolved.items.length ? 'rental' : 'mixed';
  const rentalStart = rentalLines.map((line) => String(line.rental_start_date ?? '')).filter(Boolean).sort()[0] ?? null;
  const rentalEnd = rentalLines.map((line) => String(line.rental_end_date ?? '')).filter(Boolean).sort().at(-1) ?? null;
  const rentalMonthly = round2(rentalLines.reduce((sum, line) => sum + Number(line.rental_monthly_price ?? 0) * Number(line.quantity ?? 0), 0));
  const rentalTotal = rentalLines.reduce((sum, line) => sum + Number(line.total_price ?? 0), 0);
  const hardwareAmount = round2(Math.max(0, resolved.totalAmount - rentalTotal));

  const agreed = input.agreedAmount == null ? null : Number(input.agreedAmount);
  const manual = agreed != null && Number.isFinite(agreed) && agreed >= 0 && round2(agreed) !== round2(resolved.totalAmount);
  const amount = manual ? round2(agreed as number) : round2(resolved.totalAmount);

  const { rows } = await db.query<{ id: string }>(
    `
      insert into public.crm_sales (
        quote_id, quote_no, source, customer_id, owner_name, owner_email, owner_user_id,
        sale_date, device_count, amount, hardware_amount, sale_type,
        rental_start_date, rental_end_date, rental_monthly_amount,
        currency, price_source, status, sales_channel, note,
        created_by, created_by_user_id, updated_by
      ) values (
        null, null, 'direct', $1, $2, $3, $4,
        $5::date, $6, $7, $8, $9,
        $10::date, $11::date, $12,
        'USD', $13, 'active', $14, $15,
        $2, $4, $2
      )
      returning id::text as id
    `,
    [
      input.customerId, actor.name, actor.email, actor.id,
      input.saleDate, resolved.totalDeviceCount, amount, hardwareAmount, saleType,
      rentalStart, rentalEnd, rentalMonthly,
      manual ? 'manual' : 'catalog', input.salesChannel?.trim() || null, input.note?.trim() || null,
    ],
  );
  const saleId = rows[0]?.id ?? null;
  // Fatura satırları (030): model bazlı cihaz kırılımı ve satış detayı buradan okunur.
  if (saleId) {
    await replaceSaleItems(saleId, resolved.items.map((line) => ({
      product_id: line.product_id,
      product_code: line.product_code,
      product_name: line.product_name,
      product_type: line.product_type,
      is_recurring: line.is_recurring,
      quantity: line.quantity,
      sale_type: line.sale_type === 'rental' ? 'rental' : 'sale',
      unit_price: line.unit_price,
      total_price: line.total_price,
      rental_monthly_price: line.rental_monthly_price,
      rental_start_date: line.rental_start_date,
      rental_end_date: line.rental_end_date,
    })));
  }
  return { id: saleId, amount, deviceCount: resolved.totalDeviceCount, saleType, priceSource: manual ? 'manual' : 'catalog' };
}
