import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwnedResourceAccess, requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { buildQuoteActivityNote, buildQuoteSummaryText, getQuoteCatalog, getQuoteDetailById, isMissingRelationError, normalizeDateOnly, resolveQuoteLines, type QuoteLineInput } from '@/lib/quotes/service';
import { tryRecordAuditEvent } from '@/lib/audit';
import { updateQuoteTransaction } from '@/lib/quotes/write-service';
import { assertActiveParameterValue } from '@/lib/system-parameters';

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
    const me = await requireCrmAccessOrThrow();
    const body = (await request.json().catch(() => ({}))) as Body;
    const quoteId = String(body.quote_id ?? '').trim();
    const probability = Number(body.probability ?? 0);
    const items = Array.isArray(body.items) ? body.items : [];
    const opportunityTitle = String(body.opportunity_title ?? '').trim() || null;
    const note = String(body.note ?? '').trim() || null;

    if (!quoteId) return NextResponse.json({ message: 'quote_id gerekli' }, { status: 400 });
    await assertActiveParameterValue('quote_probability', String(probability));
    if (!items.length) return NextResponse.json({ message: 'En az bir teklif satırı girilmeli.' }, { status: 400 });

    const admin = createPgAdminClient();
    const existing = await getQuoteDetailById(admin, quoteId);
    if (!existing) return NextResponse.json({ message: 'Teklif bulunamadı.' }, { status: 404 });
    assertOwnedResourceAccess({ user: me, resource: existing, ownPermission: 'quote.update.own', anyPermission: 'quote.update.any' });
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
    await tryRecordAuditEvent({ actorId: me.id, actorEmail: me.email, action: 'quote.updated', resourceType: 'quote', resourceId: quoteId, before: existing });

    revalidatePath('/crm/quotes');
    revalidatePath(`/crm/quotes/${quoteId}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (isMissingRelationError(e)) return NextResponse.json({ message: 'quote_module_not_setup' }, { status: 400 });
    return NextResponse.json({ message: e?.message || 'İşlem başarısız' }, { status: e?.status || 500 });
  }
}
