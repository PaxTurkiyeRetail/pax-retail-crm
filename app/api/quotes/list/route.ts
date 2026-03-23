import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow, isAdminLike } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isMissingRelationError } from '@/lib/quotes/service';

function formatState(validUntil: string | null, followUpDate: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (followUpDate && followUpDate < today) return 'overdue';
  if (followUpDate && followUpDate <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)) return 'approaching';
  if (validUntil && validUntil < today) return 'expired';
  return 'on_track';
}

export async function GET(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const admin = createSupabaseAdminClient();
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('tr');
    const status = String(url.searchParams.get('status') ?? '').trim().toLowerCase();
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const rowsLimit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 500), 1), 1000);

    let quoteQuery = admin.from('quotes').select('*').order('created_at', { ascending: false }).limit(rowsLimit);
    if (status) quoteQuery = quoteQuery.eq('status', status);
    if (owner) quoteQuery = quoteQuery.eq('owner_name', owner);
    if (!isAdminLike(me.role)) quoteQuery = quoteQuery.eq('owner_name', String(me.full_name ?? '').trim());

    const { data: quotes, error } = await quoteQuery;
    if (error) {
      if (isMissingRelationError(error)) return NextResponse.json({ rows: [], kpis: null, onboardingNeeded: true, message: 'quote_module_not_setup' });
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const quoteRows = quotes ?? [];
    if (!quoteRows.length) return NextResponse.json({ rows: [], onboardingNeeded: false });

    const customerIds = Array.from(new Set(quoteRows.map((row: any) => row.customer_id).filter(Boolean)));
    const quoteIds = quoteRows.map((row: any) => row.id);

    const [{ data: customers }, { data: items }] = await Promise.all([
      admin.from('musteriler').select('id,musteri,sektor,sorumlu').in('id', customerIds),
      admin.from('quote_items').select('quote_id,product_name_snapshot,product_code_snapshot,quantity,total_price,is_recurring').in('quote_id', quoteIds).order('line_no', { ascending: true }),
    ]);

    const customerMap = new Map((customers ?? []).map((row: any) => [row.id, row]));
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

    return NextResponse.json({ rows, onboardingNeeded: false });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
