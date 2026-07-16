import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { addDaysToIsoDate, buildQuoteSummaryText, createQuoteActivity, getQuoteDetailById, getTurkeyTodayIso, normalizeDateOnly } from '@/lib/quotes/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  quote_id?: string;
  status?: 'draft' | 'sent' | 'closed';
  closed_reason?: 'won' | 'lost' | 'expired' | 'no_interest' | null;
  close_note?: string | null;
};

export async function POST(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = (await request.json().catch(() => ({}))) as Body;
    const quoteId = String(body.quote_id ?? '').trim();
    const status = String(body.status ?? '').trim().toLowerCase();
    const closedReason = body.closed_reason ? String(body.closed_reason).trim().toLowerCase() : null;
    const closeNote = String(body.close_note ?? '').trim();
    if (!quoteId) return NextResponse.json({ message: 'quote_id gerekli' }, { status: 400 });
    if (!['draft', 'sent', 'closed'].includes(status)) return NextResponse.json({ message: 'Geçersiz durum.' }, { status: 400 });
    if (status === 'closed' && ['lost', 'expired', 'no_interest'].includes(String(closedReason ?? '')) && !closeNote) {
      return NextResponse.json({ message: 'Bu kapanış nedeni için açıklama zorunlu.' }, { status: 400 });
    }

    const admin = createPgAdminClient();
    const detail = await getQuoteDetailById(admin, quoteId);
    if (!detail) return NextResponse.json({ message: 'Teklif bulunamadı.' }, { status: 404 });

    let activityId = (detail as any).activity_event_id ?? null;
    if (status === 'sent' && !activityId) {
      const today = getTurkeyTodayIso();
      activityId = await createQuoteActivity({
        admin,
        customerId: String((detail as any).customer_id),
        quoteId,
        quoteNo: String((detail as any).quote_no),
        ownerName: String(me.full_name ?? me.email ?? ''),
        ownerUserId: me.id,
        ownerEmail: me.email,
        followUpDate: normalizeDateOnly((detail as any).follow_up_date, addDaysToIsoDate(today, 30)) ?? addDaysToIsoDate(today, 30),
        validUntil: normalizeDateOnly((detail as any).valid_until, addDaysToIsoDate(today, 15)) ?? addDaysToIsoDate(today, 15),
        summaryText: buildQuoteSummaryText(((detail.items ?? []) as any[]).map((item) => ({ product_name: item.product_name_snapshot ?? item.product_name, quantity: Number(item.quantity ?? 0) }))),
      });
    }

    const payload: Record<string, unknown> = { status };
    if (status === 'closed') {
      payload.closed_reason = closedReason;
      payload.closed_at = new Date().toISOString();
      if (closeNote) {
        const existingNote = String((detail as any).note ?? '').trim();
        const closeNoteBlock = `[Kapanış Notu - ${closedReason ?? 'closed'}] ${closeNote}`;
        payload.note = existingNote ? `${existingNote}

${closeNoteBlock}` : closeNoteBlock;
      }
    } else {
      payload.closed_reason = null;
      payload.closed_at = null;
    }

    const { error } = await admin.from('quotes').update(payload).eq('id', quoteId);
    if (error) {
      if (status === 'sent' && activityId && !(detail as any).activity_event_id) {
        await admin.from('pipeline_eventleri').delete().eq('id', activityId);
        await admin.from('quotes').update({ activity_event_id: null }).eq('id', quoteId);
      }
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, activity_id: activityId });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'İşlem başarısız' }, { status: e?.status || 500 });
  }
}
