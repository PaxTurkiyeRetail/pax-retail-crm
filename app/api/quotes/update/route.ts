import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { QUOTE_PROBABILITIES } from '@/lib/quotes/catalog';
import { buildQuoteActivityNote, buildQuoteSummaryText, getQuoteCatalog, isMissingRelationError, normalizeDateOnly, resolveQuoteLines, type QuoteLineInput } from '@/lib/quotes/service';
import { updateQuoteTransaction } from '@/lib/quotes/write-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  quote_id?: string;
  opportunity_title?: string | null;
  probability?: number;
  note?: string | null;
  items?: QuoteLineInput[];
};

export async function POST(request: Request) {
  try {
    await requireCrmAccessOrThrow();
    const body = (await request.json().catch(() => ({}))) as Body;
    const quoteId = String(body.quote_id ?? '').trim();
    const probability = Number(body.probability ?? 0);
    const items = Array.isArray(body.items) ? body.items : [];
    const opportunityTitle = String(body.opportunity_title ?? '').trim() || null;
    const note = String(body.note ?? '').trim() || null;

    if (!quoteId) return NextResponse.json({ message: 'quote_id gerekli' }, { status: 400 });
    if (!QUOTE_PROBABILITIES.includes(probability as any)) return NextResponse.json({ message: 'Probability sadece %10 / %30 / %60 / %90 olabilir.' }, { status: 400 });
    if (!items.length) return NextResponse.json({ message: 'En az bir teklif satırı girilmeli.' }, { status: 400 });

    const admin = createPgAdminClient();
    const catalog = await getQuoteCatalog(admin);
    const resolved = resolveQuoteLines(items, catalog);
    const summaryText = buildQuoteSummaryText(resolved.items.map((item) => ({ product_name: item.product_name, quantity: item.quantity })));
    await updateQuoteTransaction({
      quoteId,
      opportunityTitle,
      probability,
      note,
      totals: resolved,
      items: resolved.items,
      activityNote: (quote) => buildQuoteActivityNote({
        quoteNo: quote.quote_no,
        summaryText,
        validUntil: normalizeDateOnly(quote.valid_until, null),
      }),
    });

    revalidatePath('/crm/quotes');
    revalidatePath(`/crm/quotes/${quoteId}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (isMissingRelationError(e)) return NextResponse.json({ message: 'quote_module_not_setup' }, { status: 400 });
    return NextResponse.json({ message: e?.message || 'İşlem başarısız' }, { status: e?.status || 500 });
  }
}
