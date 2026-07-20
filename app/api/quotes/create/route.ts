import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { QUOTE_PROBABILITIES } from '@/lib/quotes/catalog';
import { addDaysToIsoDate, buildQuoteSummaryText, ensureCustomerExistsOrThrow, getQuoteCatalog, getTurkeyTodayIso, isMissingRelationError, resolveQuoteLines, type QuoteLineInput } from '@/lib/quotes/service';
import { createQuoteTransaction } from '@/lib/quotes/write-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  customer_id?: string;
  opportunity_title?: string | null;
  probability?: number;
  items?: QuoteLineInput[];
  save_mode?: 'draft' | 'sent';
  note?: string | null;
};

export async function POST(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = (await request.json().catch(() => ({}))) as Body;
    const customerId = String(body.customer_id ?? '').trim();
    const probability = Number(body.probability ?? 0);
    const items = Array.isArray(body.items) ? body.items : [];
    const saveMode = body.save_mode === 'sent' ? 'sent' : 'draft';
    const opportunityTitle = String(body.opportunity_title ?? '').trim() || null;
    const note = String(body.note ?? '').trim() || null;

    if (!customerId) return NextResponse.json({ message: 'Müşteri seçimi zorunlu.' }, { status: 400 });
    if (!QUOTE_PROBABILITIES.includes(probability as any)) return NextResponse.json({ message: 'Probability sadece %10 / %30 / %60 / %90 olabilir.' }, { status: 400 });
    if (!items.length) return NextResponse.json({ message: 'En az bir teklif satırı girilmeli.' }, { status: 400 });

    const admin = createPgAdminClient();
    await ensureCustomerExistsOrThrow({ admin, customerId });

    const catalog = await getQuoteCatalog(admin);
    const resolved = resolveQuoteLines(items, catalog);
    const proposalDate = getTurkeyTodayIso();
    const validUntil = addDaysToIsoDate(proposalDate, 15);
    const followUpDate = addDaysToIsoDate(proposalDate, 30);
    const ownerName = String(me.full_name ?? '').trim();

    const quote = await createQuoteTransaction({
      customerId,
      opportunityTitle,
      probability,
      note,
      status: saveMode,
      ownerName,
      ownerEmail: me.email,
      ownerUserId: me.id,
      dates: { proposalDate, validUntil, followUpDate },
      totals: resolved,
      items: resolved.items,
      summaryText: buildQuoteSummaryText(resolved.items.map((item) => ({ product_name: item.product_name, quantity: item.quantity }))),
    });

    return NextResponse.json({ ok: true, id: quote.id, quote_no: quote.quote_no, status: quote.status, activity_id: quote.activity_id });
  } catch (e: any) {
    if (isMissingRelationError(e)) return NextResponse.json({ message: 'quote_module_not_setup' }, { status: 400 });
    return NextResponse.json({ message: e?.message || 'İşlem başarısız' }, { status: e?.status || 500 });
  }
}
