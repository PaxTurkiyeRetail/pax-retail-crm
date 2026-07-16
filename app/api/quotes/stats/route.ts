import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { isMissingRelationError } from '@/lib/quotes/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const admin = createPgAdminClient();
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('tr');
    const status = String(url.searchParams.get('status') ?? '').trim().toLowerCase();
    const owner = String(url.searchParams.get('owner') ?? '').trim();

    let query = admin
      .from('quotes')
      .select('id,status,closed_reason,total_amount,total_device_count,probability,follow_up_date,valid_until,owner_name,quote_no,opportunity_title,customer_id')
      .limit(5000);

    if (status) query = query.ilike('status', status);
    if (owner) query = query.ilike('owner_name', owner.replace(/[\%_]/g, ' ').trim());

    const { data, error } = await query;
    if (error) {
      if (isMissingRelationError(error)) return NextResponse.json({ onboardingNeeded: true, kpis: null, message: 'quote_module_not_setup' });
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    let rows = data ?? [];

    if (q && rows.length) {
      const customerIds = Array.from(new Set(rows.map((row: any) => row.customer_id).filter(Boolean)));
      const quoteIds = rows.map((row: any) => row.id);

      const [{ data: customers }, { data: items }] = await Promise.all([
        customerIds.length
          ? admin.from('musteriler').select('id,musteri').in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
        quoteIds.length
          ? admin.from('quote_items').select('quote_id,product_name_snapshot,product_code_snapshot,quantity').in('quote_id', quoteIds)
          : Promise.resolve({ data: [], error: null }),
      ] as any);

      const customerMap = new Map<string, any>((customers ?? []).map((row: any) => [String(row.id), row]));
      const itemTextByQuote = new Map<string, string>();
      (items ?? []).forEach((item: any) => {
        const prev = itemTextByQuote.get(item.quote_id) ?? '';
        const next = `${prev} ${item.quantity ?? ''} ${item.product_code_snapshot ?? ''} ${item.product_name_snapshot ?? ''}`.trim();
        itemTextByQuote.set(item.quote_id, next);
      });

      rows = rows.filter((row: any) => {
        const haystack = [
          row.quote_no,
          row.opportunity_title,
          row.owner_name,
          customerMap.get(row.customer_id)?.musteri,
          row.status,
          row.closed_reason,
          itemTextByQuote.get(row.id),
        ]
          .join(' ')
          .toLocaleLowerCase('tr');
        return haystack.includes(q);
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    const kpis = {
      total_quotes: rows.length,
      sent_quotes: rows.filter((row: any) => row.status === 'sent').length,
      closed_quotes: rows.filter((row: any) => row.status === 'closed').length,
      won_quotes: rows.filter((row: any) => row.status === 'closed' && row.closed_reason === 'won').length,
      lost_quotes: rows.filter((row: any) => row.status === 'closed' && ['lost', 'expired', 'no_interest'].includes(String(row.closed_reason ?? ''))).length,
      draft_quotes: rows.filter((row: any) => row.status === 'draft').length,
      overdue_followups: rows.filter((row: any) => row.status !== 'closed' && row.follow_up_date && row.follow_up_date < today).length,
      expiring_soon: rows.filter((row: any) => row.status === 'sent' && row.valid_until && row.valid_until >= today && row.valid_until <= inThreeDays).length,
      total_devices: rows.reduce((sum: number, row: any) => sum + Number(row.total_device_count ?? 0), 0),
      total_amount: rows.reduce((sum: number, row: any) => sum + Number(row.total_amount ?? 0), 0),
      weighted_amount: rows.reduce((sum: number, row: any) => sum + (Number(row.total_amount ?? 0) * Number(row.probability ?? 0) / 100), 0),
    };

    return NextResponse.json({ onboardingNeeded: false, kpis });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
