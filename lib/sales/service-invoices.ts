import 'server-only';
import type { PoolClient } from 'pg';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { ApiError } from '@/lib/http/api-error';
import { getParameterOptionsByGroups } from '@/lib/system-parameters';
import { OWNER_ORDER, normalizeName } from '@/lib/reports/live-board-shared';
import {
  computeLineTotals,
  currentPeriod,
  isServiceCurrency,
  missingFirms,
  normalizePeriodMonth,
  previousPeriod,
  sumByCurrency,
  type ServiceCurrency,
  type ServiceInvoiceInput,
  type ServiceInvoiceRow,
  type ServiceInvoiceSummary,
} from '@/lib/sales/service-invoices-shared';

// HİZMET FATURALARI — veri erişimi (migration 032). Kurallar `service-invoices-shared.ts` başında.
//   * Fatura = başlık (firma · ay · para birimi · tutar) + kalemler (hizmet × adet × birim fiyat).
//     Tutar HER ZAMAN kalemlerden hesaplanır (elle tutar yok: satırlar zaten adet × fiyat).
//   * Hizmet listesi `system_parameters.service_invoice_item`; kayıtta değer + etiket kopyası saklanır.
//   * Satışçı: verilmemişse firmanın CRM sorumlusu; o da yoksa 'Havuz Account'. Liste OWNER_ORDER'a
//     (kullanıcı olmayan sabit sahipler dahil) daraltılır — kılavuz kural 32.
//   * Her yazma işlemi tek transaction + crm_audit_events (resource_type 'service_invoice').

export const SERVICE_ITEM_GROUP = 'service_invoice_item';

type Actor = { id: string; name: string; email: string };

const SELECT_ROWS = `
  select i.id::text as id, i.customer_id::text as customer_id, m.musteri,
         i.owner_name, i.owner_user_id, i.period_month::text as period_month,
         i.invoice_date::text as invoice_date, i.invoice_no, i.currency,
         i.amount::float8 as amount, i.status, i.note, i.cancel_reason,
         i.created_at::text as created_at, i.updated_at::text as updated_at, i.updated_by,
         coalesce((
           select json_agg(json_build_object(
                    'id', li.id::text, 'line_no', li.line_no, 'service_key', li.service_key,
                    'service_label', li.service_label, 'quantity', li.quantity,
                    'unit_price', li.unit_price::float8, 'total_price', li.total_price::float8)
                  order by li.line_no)
           from public.crm_service_invoice_items li where li.invoice_id = i.id
         ), '[]'::json) as items
  from public.crm_service_invoices i
  join public.musteriler m on m.id = i.customer_id
`;

export type ListServiceInvoicesOptions = {
  /** 'YYYY-MM' ya da 'YYYY-MM-01' — verilmezse tüm aylar. */
  period?: string | null;
  year?: number | null;
  owner?: string | null;
  status?: string | null;
  q?: string | null;
  customerId?: string | null;
  limit?: number;
};

export async function listServiceInvoices(options: ListServiceInvoicesOptions = {}): Promise<ServiceInvoiceRow[]> {
  const period = options.period ? normalizePeriodMonth(options.period) : null;
  const { rows } = await db.query(
    `${SELECT_ROWS}
     where ($1::date is null or i.period_month = $1::date)
       and ($2::int is null or extract(year from i.period_month) = $2::int)
       and ($3 = '' or i.owner_name = $3)
       and ($4 = '' or i.status = $4)
       and ($5 = '' or m.musteri ilike '%' || $5 || '%' or coalesce(i.invoice_no, '') ilike '%' || $5 || '%')
       and ($6::uuid is null or i.customer_id = $6::uuid)
     order by i.period_month desc, m.musteri, i.created_at desc
     limit $7`,
    [
      period, options.year ?? null, String(options.owner ?? '').trim(), String(options.status ?? '').trim(),
      String(options.q ?? '').trim(), options.customerId ?? null, Math.min(2000, Math.max(1, options.limit ?? 1000)),
    ],
  );
  return rows as ServiceInvoiceRow[];
}

/**
 * Özet: yıl toplamı ve seçili ay toplamı (para birimine göre AYRI — TL ile USD toplanmaz) +
 * "her ay kesilmesi zorunlu" kontrolü: geçen ay faturası olup bu ay olmayan firmalar.
 */
export async function serviceInvoiceSummary(args: { year: number; period: string; today?: Date }): Promise<ServiceInvoiceSummary> {
  const period = normalizePeriodMonth(args.period) ?? currentPeriod(new Date().toISOString().slice(0, 10));
  const prev = previousPeriod(period);
  const [ytd, month, prevRows, curRows] = await Promise.all([
    db.query<{ currency: ServiceCurrency; amount: number }>(
      `select currency, amount::float8 as amount from public.crm_service_invoices
       where status = 'active' and extract(year from period_month) = $1`, [args.year]),
    db.query<{ currency: ServiceCurrency; amount: number }>(
      `select currency, amount::float8 as amount from public.crm_service_invoices
       where status = 'active' and period_month = $1::date`, [period]),
    db.query(
      `select i.customer_id::text as customer_id, m.musteri, i.owner_name, i.period_month::text as period_month,
              i.amount::float8 as amount, i.currency
       from public.crm_service_invoices i join public.musteriler m on m.id = i.customer_id
       where i.status = 'active' and i.period_month = $1::date`, [prev]),
    db.query<{ customer_id: string }>(
      `select distinct customer_id::text as customer_id from public.crm_service_invoices
       where status = 'active' and period_month = $1::date`, [period]),
  ]);
  return {
    year: args.year,
    period,
    ytd: sumByCurrency(ytd.rows),
    period_totals: sumByCurrency(month.rows),
    missing: missingFirms(prevRows.rows as any[], curRows.rows),
  };
}

/* --- Yazma ------------------------------------------------------------------- */

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Satışçı adı → (ad, kullanıcı id). Kullanıcı olmayan sabit sahipler (Havuz Account…) ad olarak yazılır. */
async function resolveOwner(client: PoolClient, requested: string | null | undefined, fallback: string | null): Promise<{ name: string; userId: string | null }> {
  const wanted = String(requested ?? '').trim() || String(fallback ?? '').trim() || 'Havuz Account';
  const { rows } = await client.query<{ id: string; name: string }>(
    `select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name
     from public.allowed_users u
     where u.is_active = true and lower(coalesce(nullif(trim(u.full_name), ''), u.email)) = lower($1)
     limit 1`,
    [wanted],
  );
  if (rows[0]) return { name: rows[0].name, userId: rows[0].id };
  const fixed = OWNER_ORDER.find((name) => normalizeName(name) === normalizeName(wanted));
  if (fixed) return { name: fixed, userId: null };
  // Firmanın sorumlusu listede olmayan eski bir ad olabilir (Can, Dilara…): Havuz'a düşür, gizlice başka ada yazma.
  if (!requested) return { name: 'Havuz Account', userId: null };
  throw new ApiError('OWNER_UNKNOWN', 'Seçilen satışçı bulunamadı.', 400);
}

/** Hizmet kalemi anahtarlarını aktif listeyle doğrular; etiket kopyasını döner. */
async function resolveServiceLabels(keys: string[]): Promise<Map<string, string>> {
  const options = await getParameterOptionsByGroups([SERVICE_ITEM_GROUP]);
  const list = options[SERVICE_ITEM_GROUP] ?? [];
  const byValue = new Map(list.map((item) => [String(item.value), String(item.label)]));
  for (const key of keys) {
    if (!byValue.has(key)) throw new ApiError('SERVICE_ITEM_UNKNOWN', `Hizmet kalemi listede yok: ${key}. Liste Yönetimleri › Hizmet Kalemleri'nden ekleyin.`, 400);
  }
  return byValue;
}

function validateInput(input: ServiceInvoiceInput) {
  const period = normalizePeriodMonth(input.periodMonth);
  if (!period) throw new ApiError('PERIOD_INVALID', 'Dönem (ay) geçersiz.', 400);
  if (!isServiceCurrency(input.currency)) throw new ApiError('CURRENCY_INVALID', 'Para birimi TL ya da USD olmalı.', 400);
  const { lines, amount } = computeLineTotals(input.lines ?? []);
  if (!lines.length) throw new ApiError('LINES_REQUIRED', 'En az bir hizmet kalemi girilmeli (adet > 0).', 400);
  const invoiceDate = input.invoiceDate ? String(input.invoiceDate).slice(0, 10) : null;
  if (invoiceDate && !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) throw new ApiError('DATE_INVALID', 'Fatura tarihi geçersiz.', 400);
  return { period, lines, amount, invoiceDate, invoiceNo: String(input.invoiceNo ?? '').trim() || null, note: String(input.note ?? '').trim() || null };
}

async function writeItems(client: PoolClient, invoiceId: string, lines: Array<{ service_key: string; quantity: number; unit_price: number; total_price: number }>, labels: Map<string, string>) {
  await client.query('delete from public.crm_service_invoice_items where invoice_id = $1', [invoiceId]);
  let lineNo = 0;
  for (const line of lines) {
    lineNo += 1;
    await client.query(
      `insert into public.crm_service_invoice_items (invoice_id, line_no, service_key, service_label, quantity, unit_price, total_price)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [invoiceId, lineNo, line.service_key, labels.get(line.service_key) ?? line.service_key, line.quantity, line.unit_price, line.total_price],
    );
  }
}

async function loadOne(client: PoolClient | typeof db, id: string): Promise<ServiceInvoiceRow | null> {
  const { rows } = await client.query(`${SELECT_ROWS} where i.id = $1`, [id]);
  return (rows[0] as ServiceInvoiceRow | undefined) ?? null;
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

export async function createServiceInvoice(actor: Actor, input: ServiceInvoiceInput): Promise<ServiceInvoiceRow> {
  const v = validateInput(input);
  const labels = await resolveServiceLabels(v.lines.map((line) => line.service_key));
  return withTransaction(async (client) => {
    const customer = await client.query<{ id: string; musteri: string; sorumlu: string | null }>(
      'select id::text as id, musteri, nullif(trim(sorumlu), \'\') as sorumlu from public.musteriler where id = $1', [input.customerId]);
    if (!customer.rows[0]) throw new ApiError('NOT_FOUND', 'Müşteri bulunamadı.', 404);
    const owner = await resolveOwner(client, input.ownerName, customer.rows[0].sorumlu);
    let id: string;
    try {
      const inserted = await client.query<{ id: string }>(
        `insert into public.crm_service_invoices
           (customer_id, owner_name, owner_user_id, period_month, invoice_date, invoice_no, currency, amount, status, note,
            created_by, created_by_user_id, updated_by)
         values ($1, $2, $3, $4::date, $5::date, $6, $7, $8, 'active', $9, $10, $11, $10)
         returning id::text as id`,
        [input.customerId, owner.name, owner.userId, v.period, v.invoiceDate, v.invoiceNo, input.currency, v.amount, v.note, actor.name, actor.id],
      );
      id = inserted.rows[0].id;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError('INVOICE_NO_DUPLICATE', `Bu fatura numarası (${v.invoiceNo}) zaten kayıtlı.`, 409);
      throw error;
    }
    await writeItems(client, id, v.lines, labels);
    const after = await loadOne(client, id);
    await recordAuditEvent({
      actorId: actor.id, actorEmail: actor.email, action: 'service_invoice.created', resourceType: 'service_invoice', resourceId: id,
      after: { customer: customer.rows[0].musteri, period: v.period, currency: input.currency, amount: v.amount, lines: v.lines.length, invoice_no: v.invoiceNo },
    }, client);
    return after!;
  });
}

export async function updateServiceInvoice(actor: Actor, id: string, input: Omit<ServiceInvoiceInput, 'customerId'> & { customerId?: string }): Promise<ServiceInvoiceRow> {
  return withTransaction(async (client) => {
    const before = await loadOne(client, id);
    if (!before) throw new ApiError('NOT_FOUND', 'Hizmet faturası bulunamadı.', 404);
    if (before.status === 'cancelled') throw new ApiError('CANCELLED', 'İptal edilmiş fatura düzenlenemez.', 409);
    const v = validateInput({ ...input, customerId: input.customerId ?? before.customer_id });
    const labels = await resolveServiceLabels(v.lines.map((line) => line.service_key));
    const customerId = input.customerId ?? before.customer_id;
    const customer = await client.query<{ musteri: string; sorumlu: string | null }>(
      'select musteri, nullif(trim(sorumlu), \'\') as sorumlu from public.musteriler where id = $1', [customerId]);
    if (!customer.rows[0]) throw new ApiError('NOT_FOUND', 'Müşteri bulunamadı.', 404);
    const owner = await resolveOwner(client, input.ownerName ?? before.owner_name, customer.rows[0].sorumlu);
    try {
      await client.query(
        `update public.crm_service_invoices
         set customer_id = $2, owner_name = $3, owner_user_id = $4, period_month = $5::date, invoice_date = $6::date,
             invoice_no = $7, currency = $8, amount = $9, note = $10, updated_by = $11
         where id = $1`,
        [id, customerId, owner.name, owner.userId, v.period, v.invoiceDate, v.invoiceNo, input.currency, v.amount, v.note, actor.name],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError('INVOICE_NO_DUPLICATE', `Bu fatura numarası (${v.invoiceNo}) zaten kayıtlı.`, 409);
      throw error;
    }
    await writeItems(client, id, v.lines, labels);
    const after = await loadOne(client, id);
    await recordAuditEvent({
      actorId: actor.id, actorEmail: actor.email, action: 'service_invoice.updated', resourceType: 'service_invoice', resourceId: id,
      before: { period: before.period_month, currency: before.currency, amount: before.amount, owner: before.owner_name, lines: before.items.length, invoice_no: before.invoice_no },
      after: { period: v.period, currency: input.currency, amount: v.amount, owner: owner.name, lines: v.lines.length, invoice_no: v.invoiceNo },
    }, client);
    return after!;
  });
}

export async function cancelServiceInvoice(actor: Actor, id: string, reason: string | null): Promise<ServiceInvoiceRow> {
  return withTransaction(async (client) => {
    const before = await loadOne(client, id);
    if (!before) throw new ApiError('NOT_FOUND', 'Hizmet faturası bulunamadı.', 404);
    if (before.status === 'cancelled') return before;
    await client.query(
      `update public.crm_service_invoices
       set status = 'cancelled', cancel_reason = $2, cancelled_at = now(), cancelled_by = $3, updated_by = $3
       where id = $1`,
      [id, String(reason ?? '').trim() || null, actor.name],
    );
    const after = await loadOne(client, id);
    await recordAuditEvent({
      actorId: actor.id, actorEmail: actor.email, action: 'service_invoice.cancelled', resourceType: 'service_invoice', resourceId: id,
      before: { status: 'active', amount: before.amount, currency: before.currency, period: before.period_month },
      after: { status: 'cancelled', reason: String(reason ?? '').trim() || null },
    }, client);
    return after!;
  });
}

/** Ekran seçenekleri: hizmet kalemleri (parametre listesi) + satışçı listesi (OWNER_ORDER). */
export async function serviceInvoiceOptions() {
  const [options, users] = await Promise.all([
    getParameterOptionsByGroups([SERVICE_ITEM_GROUP]),
    db.query<{ id: string; name: string }>(
      `select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name
       from public.allowed_users u
       where u.is_active = true
         and (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))`,
    ),
  ]);
  const team = users.rows.filter((row) => OWNER_ORDER.some((known) => normalizeName(known) === normalizeName(row.name)));
  const fixed = OWNER_ORDER.filter((name) => !team.some((row) => normalizeName(row.name) === normalizeName(name)));
  const owners = [...team.map((row) => row.name), ...fixed].sort((a, b) => OWNER_ORDER.findIndex((n) => normalizeName(n) === normalizeName(a)) - OWNER_ORDER.findIndex((n) => normalizeName(n) === normalizeName(b)));
  return {
    services: (options[SERVICE_ITEM_GROUP] ?? []).map((item) => ({ value: String(item.value), label: String(item.label) })),
    owners,
  };
}
