import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { QUOTE_PROBABILITIES } from '@/lib/quotes/catalog';
import { buildQuoteActivityNote, buildQuoteSummaryText, getQuoteCatalog, getQuoteDetailById, isMissingRelationError, normalizeDateOnly, resolveQuoteLines, type QuoteLineInput } from '@/lib/quotes/service';

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
    if (!QUOTE_PROBABILITIES.includes(probability as any)) return NextResponse.json({ message: 'Probability sadece %10 / %30 / %60 / %90 olabilir.' }, { status: 400 });
    if (!items.length) return NextResponse.json({ message: 'En az bir teklif satırı girilmeli.' }, { status: 400 });

    const admin = createPgAdminClient();
    const detail = await getQuoteDetailById(admin, quoteId).catch((error) => {
      if (isMissingRelationError(error)) return null;
      throw error;
    });

    if (!detail) return NextResponse.json({ message: 'Teklif bulunamadı.' }, { status: 404 });
    if (String((detail as any).status ?? '') === 'closed') {
      return NextResponse.json({ message: 'Kapalı teklifler düzenlenemez.' }, { status: 400 });
    }

    const catalog = await getQuoteCatalog(admin);
    const resolved = resolveQuoteLines(items, catalog);

    const { error: quoteErr } = await admin.from('quotes').update({
      opportunity_title: opportunityTitle,
      probability,
      note,
      total_device_count: resolved.totalDeviceCount,
      total_amount: resolved.totalAmount,
      monthly_amount: resolved.monthlyAmount,
      hardware_amount: resolved.hardwareAmount,
    }).eq('id', quoteId);

    if (quoteErr) return NextResponse.json({ message: quoteErr.message }, { status: 400 });

    const { error: deleteErr } = await admin.from('quote_items').delete().eq('quote_id', quoteId);
    if (deleteErr) return NextResponse.json({ message: deleteErr.message }, { status: 400 });

    const linePayload = resolved.items.map((item, index) => ({
      quote_id: quoteId,
      line_no: index + 1,
      product_id: item.product_id,
      product_code_snapshot: item.product_code,
      product_name_snapshot: item.product_name,
      product_type: item.product_type,
      category: item.category,
      is_recurring: item.is_recurring,
      billing_period: item.billing_period,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      rule_min_qty: item.pricing_rule.min_qty,
      rule_max_qty: item.pricing_rule.max_qty,
    }));

    const { error: itemErr } = await admin.from('quote_items').insert(linePayload);
    if (itemErr) return NextResponse.json({ message: itemErr.message }, { status: 400 });

    const activityId = String((detail as any).activity_event_id ?? '').trim();
    const isSent = String((detail as any).status ?? '').trim() === 'sent';
    if (isSent && activityId) {
      const summaryText = buildQuoteSummaryText(resolved.items.map((item) => ({ product_name: item.product_name, quantity: item.quantity })));
      const activityNote = buildQuoteActivityNote({
        quoteNo: String((detail as any).quote_no ?? ''),
        summaryText,
        validUntil: normalizeDateOnly((detail as any).valid_until, null),
      });
      const { error: activityErr } = await admin
        .from('pipeline_eventleri')
        .update({ notlar: activityNote })
        .eq('id', activityId);
      if (activityErr) return NextResponse.json({ message: activityErr.message }, { status: 400 });
    }

    revalidatePath('/crm/quotes');
    revalidatePath(`/crm/quotes/${quoteId}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'İşlem başarısız' }, { status: e?.status || 500 });
  }
}
