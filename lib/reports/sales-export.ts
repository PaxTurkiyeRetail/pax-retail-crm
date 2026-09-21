import 'server-only';
import { db } from '@/lib/db';
import { getParameterOptionsByGroups } from '@/lib/system-parameters';
import type { DeviceSaleLine, ServiceInvoiceLine } from '@/lib/reports/sales-export-shared';

// SATIŞ RAPORLARI (Excel) — veri katmanı (Sinan, 21.09). Kurallar `sales-export-shared.ts` başında.
// Satır = kalem; kalemi olmayan satış LEFT JOIN ile yine gelir (line_no null) ve raporda söylenir.
// Yalnız aktif kayıtlar. Tarih: cihazda `sale_date`, hizmette `period_month` (fatura dönemi).

const Q_DEVICE_LINES = `
  select s.id::text as sale_id, s.sale_date::text as sale_date, m.musteri, s.owner_name, s.source,
         s.quote_no, s.sales_channel, s.note,
         s.device_count as sale_device_count, s.amount::float8 as sale_amount,
         i.line_no, i.product_code, i.product_name, i.sale_type, i.quantity,
         i.unit_price::float8 as unit_price, i.total_price::float8 as total_price,
         i.rental_monthly_price::float8 as rental_monthly_price,
         i.rental_start_date::text as rental_start_date, i.rental_end_date::text as rental_end_date
  from public.crm_sales s
  join public.musteriler m on m.id = s.customer_id
  left join public.crm_sale_items i on i.sale_id = s.id
  where s.status = 'active'
    and s.sale_date between $1::date and $2::date
    and ($3 = '' or s.owner_name = $3)
  order by s.sale_date, m.musteri, s.created_at, i.line_no nulls first
`;

const Q_SERVICE_LINES = `
  select v.id::text as invoice_id, v.period_month::text as period_month, v.invoice_date::text as invoice_date,
         v.invoice_no, m.musteri, v.owner_name, v.currency, v.note, v.amount::float8 as invoice_amount,
         li.line_no, li.service_label, li.quantity,
         li.unit_price::float8 as unit_price, li.total_price::float8 as total_price
  from public.crm_service_invoices v
  join public.musteriler m on m.id = v.customer_id
  left join public.crm_service_invoice_items li on li.invoice_id = v.id
  where v.status = 'active'
    and v.period_month between $1::date and $2::date
    and ($3 = '' or v.owner_name = $3)
  order by v.period_month, m.musteri, v.created_at, li.line_no nulls first
`;

export type ExportRange = { from: string; to: string; owner: string };

/** Cihaz satış kalemleri; satış kanalı kodu parametre listesinden etikete çevrilir (Satışlar ekranıyla aynı liste, 027). */
export async function listDeviceSaleLines(range: ExportRange): Promise<DeviceSaleLine[]> {
  const [{ rows }, parameterOptions] = await Promise.all([
    db.query(Q_DEVICE_LINES, [range.from, range.to, range.owner]),
    getParameterOptionsByGroups(['forecast_sales_channel']),
  ]);
  const channelLabel = new Map(
    (parameterOptions.forecast_sales_channel ?? []).map((item) => [String(item.value), String(item.label)]),
  );
  return (rows as any[]).map((row) => ({
    sale_id: String(row.sale_id),
    sale_date: String(row.sale_date),
    musteri: String(row.musteri ?? ''),
    owner_name: String(row.owner_name ?? ''),
    source: row.source === 'direct' ? 'direct' : 'quote',
    quote_no: row.quote_no ?? null,
    // Kod listede yoksa kodun kendisi yazılır — boş bırakılıp bilgi kaybedilmez.
    sales_channel: row.sales_channel ? (channelLabel.get(String(row.sales_channel)) ?? String(row.sales_channel)) : null,
    note: row.note ?? null,
    line_no: row.line_no == null ? null : Number(row.line_no),
    product_code: row.product_code ?? null,
    product_name: row.product_name ?? null,
    sale_type: row.sale_type === 'rental' ? 'rental' : row.sale_type === 'sale' ? 'sale' : null,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit_price: row.unit_price == null ? null : Number(row.unit_price),
    total_price: row.total_price == null ? null : Number(row.total_price),
    rental_monthly_price: row.rental_monthly_price == null ? null : Number(row.rental_monthly_price),
    rental_start_date: row.rental_start_date ?? null,
    rental_end_date: row.rental_end_date ?? null,
    sale_device_count: Number(row.sale_device_count ?? 0),
    sale_amount: Number(row.sale_amount ?? 0),
  }));
}

export async function listServiceInvoiceLines(range: ExportRange): Promise<ServiceInvoiceLine[]> {
  const { rows } = await db.query(Q_SERVICE_LINES, [range.from, range.to, range.owner]);
  return (rows as any[]).map((row) => ({
    invoice_id: String(row.invoice_id),
    period_month: String(row.period_month),
    invoice_date: row.invoice_date ?? null,
    invoice_no: row.invoice_no ?? null,
    musteri: String(row.musteri ?? ''),
    owner_name: String(row.owner_name ?? ''),
    currency: row.currency === 'USD' ? 'USD' : 'TRY',
    note: row.note ?? null,
    line_no: row.line_no == null ? null : Number(row.line_no),
    service_label: row.service_label ?? null,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit_price: row.unit_price == null ? null : Number(row.unit_price),
    total_price: row.total_price == null ? null : Number(row.total_price),
    invoice_amount: Number(row.invoice_amount ?? 0),
  }));
}
