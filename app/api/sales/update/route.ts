export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwnedResourceAccess, requirePermissionOrThrow } from '@/lib/authz';
import { tryRecordAuditEvent } from '@/lib/audit';
import { createPgAdminClient } from '@/lib/pg/admin';
import { repriceFromCatalog } from '@/lib/quotes/sales-service';

type Body = {
  sale_id?: string;
  device_count?: number;
  /** Anlaşma fiyatı: doluysa katalog hesabı ezilir (price_source='manual'). */
  manual_amount?: number | null;
  sale_date?: string | null;
  note?: string | null;
  /** Kiralama dönemi (08.09): satış kaydında düzenlenebilir; tutar = donanım + aylık kira × ay. */
  rental_start_date?: string | null;
  rental_end_date?: string | null;
};

const isoDate = (value: unknown) => {
  const raw = String(value ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};

// SATIŞ DÜZENLEME. Teklife DOKUNULMAZ (Sinan, 07.09: "satış düzenlenebilir olsun,
// cihaz adedi güncellenebilir olsun, ama teklif değişmesin").
export async function POST(request: Request) {
  try {
    const me = await requirePermissionOrThrow('quote.read');
    const body = (await request.json().catch(() => ({}))) as Body;
    const saleId = String(body.sale_id ?? '').trim();
    if (!saleId) return NextResponse.json({ message: 'sale_id gerekli' }, { status: 400 });

    const admin = createPgAdminClient();
    const { data: sale, error: readError } = await admin
      .from('crm_sales')
      .select('id,quote_id,owner_user_id,owner_name,device_count,amount,price_source,status,sale_date,note,sale_type,rental_start_date,rental_end_date,rental_monthly_amount,hardware_amount')
      .eq('id', saleId)
      .maybeSingle();
    if (readError) return NextResponse.json({ message: readError.message }, { status: 400 });
    if (!sale) return NextResponse.json({ message: 'Satış kaydı bulunamadı.' }, { status: 404 });
    if ((sale as any).status === 'cancelled') return NextResponse.json({ message: 'İptal edilmiş satış düzenlenemez.' }, { status: 409 });
    assertOwnedResourceAccess({ user: me, resource: sale, ownPermission: 'quote.update.own', anyPermission: 'quote.update.any' });

    const deviceCount = body.device_count == null ? Number((sale as any).device_count ?? 0) : Math.max(0, Math.floor(Number(body.device_count)));
    if (!Number.isFinite(deviceCount)) return NextResponse.json({ message: 'Cihaz adedi geçersiz.' }, { status: 400 });

    const manualAmountRaw = body.manual_amount == null || String(body.manual_amount) === '' ? null : Number(body.manual_amount);
    if (manualAmountRaw != null && (!Number.isFinite(manualAmountRaw) || manualAmountRaw < 0)) {
      return NextResponse.json({ message: 'Anlaşma fiyatı geçersiz.' }, { status: 400 });
    }

    // Kiralama dönemi: gönderilmediyse mevcut değer, gönderildiyse doğrulanır.
    const hasRental = String((sale as any).sale_type ?? 'sale') !== 'sale';
    const rentalStart = Object.prototype.hasOwnProperty.call(body, 'rental_start_date') ? isoDate(body.rental_start_date) : ((sale as any).rental_start_date ?? null);
    const rentalEnd = Object.prototype.hasOwnProperty.call(body, 'rental_end_date') ? isoDate(body.rental_end_date) : ((sale as any).rental_end_date ?? null);
    // Dönem satış ekranında düzenlenmiyor (Sinan, 08.09: "satıştaki kiralamada tarihe gerek yok");
    // gönderilirse doğrulanır, gönderilmezse teklif satırlarındaki tarihlerle hesaplanır.
    if (hasRental && rentalStart && rentalEnd && rentalEnd <= rentalStart) {
      return NextResponse.json({ message: 'Kiralama bitiş tarihi başlangıçtan sonra olmalı.' }, { status: 400 });
    }
    const rentalPeriod = hasRental && rentalStart && rentalEnd ? { start: rentalStart, end: rentalEnd } : null;

    // Tutar: anlaşma fiyatı varsa o, yoksa katalog kademesinden (+ kira × ay) yeniden hesap.
    let amount = manualAmountRaw;
    let priceSource: 'catalog' | 'manual' = 'manual';
    let pricedFully = true;
    let noLines = false;
    let hardwareAmount = Number((sale as any).hardware_amount ?? 0);
    let rentalMonthlyAmount = Number((sale as any).rental_monthly_amount ?? 0);
    const repriced = await repriceFromCatalog(String((sale as any).quote_id), deviceCount, rentalPeriod);
    if (repriced.hasLines) {
      hardwareAmount = repriced.hardwareAmount;
      rentalMonthlyAmount = repriced.rentalMonthlyAmount;
    }
    if (amount == null) {
      pricedFully = repriced.priced;
      priceSource = (sale as any).price_source === 'manual' ? 'manual' : 'catalog';
      if (repriced.hasLines) {
        amount = repriced.amount;
        priceSource = 'catalog';
      } else {
        // Kalemi olmayan teklif: cihaz adedi güncellenir, tutar olduğu gibi korunur.
        amount = Number((sale as any).amount ?? 0);
        noLines = true;
      }
    }

    const payload = {
      device_count: deviceCount,
      amount,
      price_source: priceSource,
      hardware_amount: hardwareAmount,
      rental_monthly_amount: rentalMonthlyAmount,
      rental_start_date: hasRental ? rentalStart : ((sale as any).rental_start_date ?? null),
      rental_end_date: hasRental ? rentalEnd : ((sale as any).rental_end_date ?? null),
      sale_date: String(body.sale_date ?? '').trim() || (sale as any).sale_date,
      note: body.note == null ? (sale as any).note : (String(body.note).trim() || null),
      updated_by: String(me.full_name ?? me.email ?? '').trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin.from('crm_sales').update(payload).eq('id', saleId);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });

    await tryRecordAuditEvent({
      actorId: me.id, actorEmail: me.email, action: 'sale.updated', resourceType: 'sale', resourceId: saleId,
      before: { device_count: (sale as any).device_count, amount: (sale as any).amount, price_source: (sale as any).price_source, rental_start_date: (sale as any).rental_start_date, rental_end_date: (sale as any).rental_end_date },
      after: payload,
    });

    revalidatePath('/crm/sales');
    return NextResponse.json({
      ok: true,
      amount,
      price_source: priceSource,
      rental_months: repriced.rentalMonths,
      warning: noLines
        ? 'Teklifte ürün kalemi yok; cihaz adedi güncellendi ama tutar değişmedi. Doğru tutar için "anlaşma fiyatı" girin.'
        : pricedFully ? null : 'Bazı satırlar için katalog kademesi bulunamadı; o satırlar teklifteki birim fiyatla hesaplandı.',
    });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
