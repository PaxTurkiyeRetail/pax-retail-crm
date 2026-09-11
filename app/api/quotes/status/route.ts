import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwnedResourceAccess, requireCrmAccessOrThrow } from '@/lib/authz';
import { tryRecordAuditEvent } from '@/lib/audit';
import { createPgAdminClient } from '@/lib/pg/admin';
import { addDaysToIsoDate, buildQuoteSummaryText, createQuoteActivity, getQuoteDetailById, getTurkeyTodayIso, normalizeDateOnly } from '@/lib/quotes/service';
import { copySaleItemsFromQuote } from '@/lib/quotes/sales-service';
import { assertActiveParameterValue } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  quote_id?: string;
  status?: 'draft' | 'sent' | 'closed';
  closed_reason?: 'won' | 'lost' | 'expired' | 'no_interest' | null;
  close_note?: string | null;
  /** Kaybedilen teklifte iş nedeni (quote_loss_reason parametre anahtarı). */
  loss_reason_key?: string | null;
  /** Kazanıldı: müşteriyi Sipariş fazına (15) taşı. Satıcı onay kutusuyla seçer. */
  move_to_order_phase?: boolean;
};

/** Sipariş fazı — Canlı Ekran'daki huninin "Sipariş" adımı da bu fazdan besleniyor. */
const ORDER_PHASE_NO = 15;

export async function POST(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = (await request.json().catch(() => ({}))) as Body;
    const quoteId = String(body.quote_id ?? '').trim();
    const status = String(body.status ?? '').trim().toLowerCase();
    const closedReason = body.closed_reason ? String(body.closed_reason).trim().toLowerCase() : null;
    const closeNote = String(body.close_note ?? '').trim();
    const lossReasonKey = String(body.loss_reason_key ?? '').trim();
    const moveToOrderPhase = body.move_to_order_phase !== false;
    if (!quoteId) return NextResponse.json({ message: 'quote_id gerekli' }, { status: 400 });
    if (!['draft', 'sent', 'closed'].includes(status)) return NextResponse.json({ message: 'Geçersiz durum.' }, { status: 400 });
    const isLosing = status === 'closed' && ['lost', 'expired', 'no_interest'].includes(String(closedReason ?? ''));
    if (isLosing && !closeNote) {
      return NextResponse.json({ message: 'Bu kapanış nedeni için açıklama zorunlu.' }, { status: 400 });
    }
    // Kayıp nedeni Liste Yönetimleri'nden gelir (quote_loss_reason); analiz bu kırılımdan çıkar.
    let lossReasonLabel: string | null = null;
    if (isLosing) {
      if (!lossReasonKey) return NextResponse.json({ message: 'Kayıp nedeni seçilmeli.' }, { status: 400 });
      try {
        lossReasonLabel = await assertActiveParameterValue('quote_loss_reason', lossReasonKey);
      } catch (error: any) {
        return NextResponse.json({ message: error?.message || 'Geçersiz kayıp nedeni.' }, { status: 400 });
      }
    }

    const admin = createPgAdminClient();
    const detail = await getQuoteDetailById(admin, quoteId);
    if (!detail) return NextResponse.json({ message: 'Teklif bulunamadı.' }, { status: 404 });
    assertOwnedResourceAccess({ user: me, resource: detail, ownPermission: 'quote.status.own', anyPermission: 'quote.status.any' });

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
      payload.loss_reason_key = isLosing ? lossReasonKey : null;
      payload.close_note = closeNote || null;
      if (closeNote) {
        const existingNote = String((detail as any).note ?? '').trim();
        const closeNoteBlock = `[Kapanış Notu - ${closedReason ?? 'closed'}] ${closeNote}`;
        payload.note = existingNote ? `${existingNote}

${closeNoteBlock}` : closeNoteBlock;
      }
    } else {
      payload.closed_reason = null;
      payload.closed_at = null;
      payload.loss_reason_key = null;
      payload.close_note = null;
    }

    const { error } = await admin.from('quotes').update(payload).eq('id', quoteId);
    if (error) {
      if (status === 'sent' && activityId && !(detail as any).activity_event_id) {
        await admin.from('pipeline_eventleri').delete().eq('id', activityId);
        await admin.from('quotes').update({ activity_event_id: null }).eq('id', quoteId);
      }
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    // ---- KAZANILDI → SATIŞ KAYDI -------------------------------------------
    // Teklif donmuş belge olarak kalır; ciro bu satış kaydından okunur. Satış
    // kaydı sonradan düzenlenebilir (cihaz adedi / anlaşma fiyatı).
    let saleId: string | null = null;
    let phaseMoved = false;
    if (status === 'closed' && closedReason === 'won') {
      const today = getTurkeyTodayIso();
      // Kiralama (08.09): satış kaydı teklifin kiralama bilgisini taşır ve orada düzenlenir.
      const lines = Array.isArray((detail as any).items) ? ((detail as any).items as any[]) : [];
      const rentalLines = lines.filter((line) => String(line.sale_type ?? 'sale') === 'rental');
      const saleType = rentalLines.length === 0 ? 'sale' : rentalLines.length === lines.length ? 'rental' : 'mixed';
      const rentalStart = rentalLines.map((line) => String(line.rental_start_date ?? '').slice(0, 10)).filter(Boolean).sort()[0] ?? null;
      const rentalEnd = rentalLines.map((line) => String(line.rental_end_date ?? '').slice(0, 10)).filter(Boolean).sort().at(-1) ?? null;
      const rentalMonthly = rentalLines.reduce((sum, line) => sum + Number(line.rental_monthly_price ?? 0) * Number(line.quantity ?? 0), 0);
      const rentalTotal = rentalLines.reduce((sum, line) => sum + Number(line.total_price ?? 0), 0);
      // Kiralama dışı kısım (donanım + hizmet kalemleri): dönem değişince tutar = bu + aylık kira × ay.
      const nonRentalAmount = Math.max(0, Number((detail as any).total_amount ?? 0) - rentalTotal);
      const { data: sale, error: saleError } = await admin
        .from('crm_sales')
        .upsert({
          quote_id: quoteId,
          customer_id: String((detail as any).customer_id),
          quote_no: String((detail as any).quote_no),
          owner_name: String((detail as any).owner_name ?? me.full_name ?? me.email ?? '').trim() || 'Bilinmiyor',
          owner_email: (detail as any).owner_email ?? null,
          owner_user_id: (detail as any).owner_user_id ?? null,
          sale_date: today,
          device_count: Number((detail as any).total_device_count ?? 0) || 0,
          amount: Number((detail as any).total_amount ?? 0) || 0,
          hardware_amount: Math.round(nonRentalAmount * 100) / 100,
          sale_type: saleType,
          rental_start_date: rentalStart,
          rental_end_date: rentalEnd,
          rental_monthly_amount: Math.round(rentalMonthly * 100) / 100,
          currency: 'USD',
          price_source: 'catalog',
          status: 'active',
          note: closeNote || null,
          created_by: String(me.full_name ?? me.email ?? '').trim() || null,
          created_by_user_id: me.id,
          updated_by: String(me.full_name ?? me.email ?? '').trim() || null,
        }, { onConflict: 'quote_id' })
        .select('id')
        .maybeSingle();
      if (saleError) return NextResponse.json({ message: `Satış kaydı oluşturulamadı: ${saleError.message}` }, { status: 400 });
      saleId = String((sale as any)?.id ?? '') || null;
      // Fatura satırları (migration 030): teklifin kalemleri satışa KOPYALANIR. Canlı Ekran'daki
      // model bazlı cihaz kırılımı ve satış detayı buradan okunur (Çağdaş Bey, 11.09).
      // Kalem yazımı satışın kendisini bozmamalı: hata olursa satış kaydı yine de durur.
      if (saleId) await copySaleItemsFromQuote(saleId, quoteId).catch(() => undefined);

      // Müşteriyi Sipariş fazına taşı (satıcı onay kutusuyla seçer). Aktivite kaydı
      // olarak yazılır; musteri_pipeline tetikleyiciyle güncellenir.
      if (moveToOrderPhase) {
        const { data: pipeline } = await admin
          .from('musteri_pipeline')
          .select('aktif_faz_no,owner,partner_owner,iteration_no')
          .eq('musteri_id', String((detail as any).customer_id))
          .maybeSingle();
        const currentPhase = Number((pipeline as any)?.aktif_faz_no ?? 0) || 0;
        if (currentPhase < ORDER_PHASE_NO) {
          const { error: phaseError } = await admin.from('pipeline_eventleri').insert({
            musteri_id: String((detail as any).customer_id),
            faz_no: ORDER_PHASE_NO,
            iteration_no: Number((pipeline as any)?.iteration_no ?? 1) || 1,
            event_type: 'note_added',
            durum: 'Tamamlandı',
            aksiyon: 'AKTIVITE:Diğer',
            owner: String((detail as any).owner_name ?? '').trim() || null,
            partner_owner: (pipeline as any)?.partner_owner ?? 'Müşteri',
            notlar: `${(detail as any).quote_no} teklifi satışa dönüştürüldü.${closeNote ? ` ${closeNote}` : ''}`,
            created_by: String(me.full_name ?? me.email ?? '').trim() || null,
            created_by_user_id: me.id,
            created_by_email: me.email,
            activity_scope: 'account',
            affects_phase: true,
          });
          if (phaseError) return NextResponse.json({ message: `Faz güncellenemedi: ${phaseError.message}` }, { status: 400 });
          phaseMoved = true;
        }
      }
    }

    await tryRecordAuditEvent({
      actorId: me.id,
      actorEmail: me.email,
      action: 'quote.status_changed',
      resourceType: 'quote',
      resourceId: quoteId,
      before: { status: (detail as any).status, closed_reason: (detail as any).closed_reason },
      after: { ...payload, sale_id: saleId, phase_moved: phaseMoved, loss_reason: lossReasonLabel },
    });

    revalidatePath('/crm/sales');
    return NextResponse.json({ ok: true, activity_id: activityId, sale_id: saleId, phase_moved: phaseMoved });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'İşlem başarısız' }, { status: e?.status || 500 });
  }
}
