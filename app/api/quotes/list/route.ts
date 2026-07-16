import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { isMissingRelationError } from '@/lib/quotes/service';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatState(validUntil: string | null, followUpDate: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (followUpDate && followUpDate < today) return 'overdue';
  if (followUpDate && followUpDate <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)) return 'approaching';
  if (validUntil && validUntil < today) return 'expired';
  return 'on_track';
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function escapeIlike(value: string) {
  return String(value ?? '').replace(/[\%_]/g, ' ').trim();
}

export async function GET(request: Request) {
  try {
    await requireCrmAccessOrThrow();
    const admin = createPgAdminClient();
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('tr');
    const status = String(url.searchParams.get('status') ?? '').trim().toLowerCase();
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), 20), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let quoteQuery = admin
      .from('quotes')
      .select('id,quote_no,opportunity_title,proposal_date,valid_until,follow_up_date,probability,status,closed_reason,owner_name,total_device_count,total_amount,customer_id,created_at', { count: q ? undefined : 'exact' })
      .order('created_at', { ascending: false });
    let ownersQuery = admin.from('quotes').select('owner_name').limit(5000);

    if (status) quoteQuery = quoteQuery.ilike('status', status);
    if (owner) quoteQuery = quoteQuery.ilike('owner_name', escapeIlike(owner));

    // Arama modunda müşteri/ürün özetinde de filtre olabildiği için önce sınırlı havuz alıp
    // uygulama katmanında süzüyoruz. Normal modda gerçek server-side pagination çalışır.
    if (q) {
      quoteQuery = quoteQuery.limit(1000);
    } else {
      quoteQuery = quoteQuery.range(from, to);
    }

    const [{ data: quotes, error, count }, { data: ownerRows, error: ownerError }] = await Promise.all([quoteQuery, ownersQuery]);

    if (error || ownerError) {
      const relationError = error ?? ownerError;
      if (relationError && isMissingRelationError(relationError)) {
        return NextResponse.json({ rows: [], ownerOptions: [], onboardingNeeded: true, message: 'quote_module_not_setup', total: 0, page, pageSize });
      }
      return NextResponse.json({ message: (error ?? ownerError)?.message || 'Teklif listesi alınamadı.' }, { status: 500 });
    }

    const ownerOptions = Array.from(new Set((ownerRows ?? []).map((row: any) => String(row.owner_name ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));

    const quoteRows = quotes ?? [];
    if (!quoteRows.length) return NextResponse.json({ rows: [], ownerOptions, onboardingNeeded: false, total: 0, page, pageSize });

    const customerIds = Array.from(new Set(quoteRows.map((row: any) => row.customer_id).filter(Boolean)));
    const quoteIds = quoteRows.map((row: any) => row.id);

    const [{ data: customers }, { data: items }] = await Promise.all([
      customerIds.length ? admin.from('musteriler').select('id,musteri,sektor,sorumlu').in('id', customerIds) : Promise.resolve({ data: [] }),
      quoteIds.length ? admin.from('quote_items').select('quote_id,product_name_snapshot,product_code_snapshot,quantity,total_price,is_recurring').in('quote_id', quoteIds).order('line_no', { ascending: true }) : Promise.resolve({ data: [] }),
    ]);

    const customerMap = new Map((customers ?? []).filter((row: any) => !isReportOnlyCustomer(row)).map((row: any) => [row.id, row]));
    const itemsByQuote = new Map<string, any[]>();
    (items ?? []).forEach((item: any) => {
      const list = itemsByQuote.get(item.quote_id) ?? [];
      list.push(item);
      itemsByQuote.set(item.quote_id, list);
    });

    let rows = quoteRows.map((quote: any) => {
      const itemRows = itemsByQuote.get(quote.id) ?? [];
      const customer = customerMap.get(quote.customer_id) ?? null;
      const summary = itemRows.slice(0, 2).map((item) => `${item.quantity} ${item.product_code_snapshot || item.product_name_snapshot}`).join(' + ');
      const weightedAmount = Math.round(Number(quote.total_amount ?? 0) * (Number(quote.probability ?? 0) / 100));
      return {
        ...quote,
        customer,
        items: itemRows,
        summary,
        weighted_amount: weightedAmount,
        health_state: formatState(quote.valid_until, quote.follow_up_date),
      };
    });

    if (q) {
      rows = rows.filter((row: any) => {
        const haystack = [row.quote_no, row.opportunity_title, row.owner_name, row.customer?.musteri, row.summary, row.status, row.closed_reason].join(' ').toLocaleLowerCase('tr');
        return haystack.includes(q);
      });
    }

    const total = q ? rows.length : Number(count ?? rows.length);
    const pagedRows = q ? rows.slice(from, from + pageSize) : rows;

    return NextResponse.json({ rows: pagedRows, ownerOptions, onboardingNeeded: false, total, page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
