import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { QUOTE_PROBABILITIES } from '@/lib/quotes/catalog';
import { addDaysToIsoDate, buildQuoteSummaryText, createQuoteActivity, ensureCustomerAccessOrThrow, getNextQuoteNumber, getQuoteCatalog, getTurkeyTodayIso, isMissingRelationError, resolveQuoteLines, type QuoteLineInput } from '@/lib/quotes/service';

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

    const admin = createSupabaseAdminClient();
    await ensureCustomerAccessOrThrow({ admin, customerId, role: me.role, fullName: me.full_name });

    const catalog = await getQuoteCatalog(admin);
    const resolved = resolveQuoteLines(items, catalog);
    const numbering = await getNextQuoteNumber(admin);
    const proposalDate = getTurkeyTodayIso();
    const validUntil = addDaysToIsoDate(proposalDate, 15);
    const followUpDate = addDaysToIsoDate(proposalDate, 30);
    const ownerName = String(me.full_name ?? '').trim();

    const { data: quote, error: quoteErr } = await admin
      .from('quotes')
      .insert({
        customer_id: customerId,
        opportunity_title: opportunityTitle,
        proposal_date: proposalDate,
        valid_until: validUntil,
        follow_up_date: followUpDate,
        owner_name: ownerName,
        owner_email: me.email,
        probability,
        status: saveMode,
        closed_reason: null,
        total_device_count: resolved.totalDeviceCount,
        total_amount: resolved.totalAmount,
        monthly_amount: resolved.monthlyAmount,
        hardware_amount: resolved.hardwareAmount,
        note,
        quote_year: numbering.quote_year,
        quote_serial: numbering.quote_serial,
        quote_no: numbering.quote_no,
      })
      .select('id,quote_no,status,follow_up_date,valid_until')
      .single();

    if (quoteErr) {
      if (isMissingRelationError(quoteErr)) return NextResponse.json({ message: 'quote_module_not_setup' }, { status: 400 });
      return NextResponse.json({ message: quoteErr.message }, { status: 400 });
    }

    const linePayload = resolved.items.map((item, index) => ({
      quote_id: (quote as any).id,
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

    let activityId: string | null = null;
    if (saveMode === 'sent') {
      activityId = await createQuoteActivity({
        admin,
        customerId,
        quoteId: (quote as any).id,
        quoteNo: (quote as any).quote_no,
        ownerName,
        followUpDate,
        validUntil,
        summaryText: buildQuoteSummaryText(resolved.items.map((item) => ({ product_name: item.product_name, quantity: item.quantity }))),
      });
    }

    return NextResponse.json({ ok: true, id: (quote as any).id, quote_no: (quote as any).quote_no, status: (quote as any).status, activity_id: activityId });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'İşlem başarısız' }, { status: e?.status || 500 });
  }
}
