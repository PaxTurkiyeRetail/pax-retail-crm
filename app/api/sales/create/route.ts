export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermissionOrThrow, userHasPermission } from '@/lib/authz';
import { tryRecordAuditEvent } from '@/lib/audit';
import { apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { db } from '@/lib/db';
import { createDirectSale, saleAmountWarnings } from '@/lib/quotes/sales-service';

// DOĞRUDAN SATIŞ (teklifsiz) — Sinan/Furkan, 10.09; migration 027.
// "Tekliften satış girilebilir ve direkt satışta eklenebilir olsun."
//   * Yetki `sale.create` (account_manager, admin, super_admin).
//   * SAHİPLİK (Sinan, 10.09): satışçı yalnız KENDİ portföyündeki firmaya satış yazabilir; admin ve
//     super_admin kısıtsız. Yönetici işareti `quote.update.any` — `customer.read.any`/`quote.read.any`
//     satış ekibinde de var (hepsi tüm firmaları GÖRÜR), o yüzden sahiplik ölçütü olarak kullanılamaz.
//   * Tutar teklif motorundan (katalog kademesi + kiralama tarifesi); "anlaşma fiyatı" ezer.
//   * Ciro tanımı değişmez: aktif satışların toplamı (Canlı Ekran, Teklif Raporları).

const lineSchema = z.object({
  product_id: z.string().uuid('Ürün seçilmeli.'),
  quantity: z.number().int().min(1).max(100000),
  sale_type: z.enum(['sale', 'rental']).optional(),
  manual_unit_price: z.number().positive('Özel birim fiyat sıfırdan büyük olmalıdır.').nullish(),
  rental_start_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  rental_end_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
}).refine((line) => line.sale_type !== 'rental' || line.manual_unit_price == null, {
  message: 'Özel birim satış fiyatı kiralama satırında kullanılamaz.', path: ['manual_unit_price'],
});

const createSchema = z.object({
  customer_id: z.string().uuid('Müşteri seçilmeli.'),
  sale_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Satış tarihi geçersiz.'),
  sales_channel: z.string().trim().max(80).nullish(),
  note: z.string().trim().max(1000).nullish(),
  agreed_amount: z.number().min(0).nullish(),
  lines: z.array(lineSchema).min(1, 'En az bir ürün satırı girilmeli.').max(50),
});

export async function POST(request: Request) {
  try {
    const me = await requirePermissionOrThrow('sale.create');
    const input = await parseJsonBody(request, createSchema);

    const { rows } = await db.query<{ id: string; musteri: string; owner_user_id: string | null }>(
      `select id::text as id, musteri, owner_user_id::text as owner_user_id from public.musteriler where id = $1 limit 1`,
      [input.customer_id],
    );
    const customer = rows[0];
    if (!customer) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });
    const isManager = userHasPermission(me, 'quote.update.any');
    if (!isManager && String(customer.owner_user_id ?? '') !== me.id) {
      return NextResponse.json({ message: 'Bu firma sizin portföyünüzde değil; satış kaydını firmanın sorumlusu ya da yönetim açabilir.' }, { status: 403 });
    }

    // Anlaşma fiyatı yalnız quote.price.override ile (13.10.2026).
    if ((input.agreed_amount != null || input.lines.some((line) => line.manual_unit_price != null)) && !userHasPermission(me, 'quote.price.override')) {
      return NextResponse.json({ message: 'Anlaşma fiyatı girme yetkiniz yok; tutar katalogdan hesaplanır.' }, { status: 403 });
    }

    const result = await createDirectSale(
      { id: me.id, name: String(me.full_name ?? me.email ?? '').trim() || 'Bilinmiyor', email: me.email },
      {
        customerId: input.customer_id,
        saleDate: input.sale_date,
        salesChannel: input.sales_channel ?? null,
        note: input.note ?? null,
        agreedAmount: input.agreed_amount ?? null,
        lines: input.lines.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          manual_unit_price: line.manual_unit_price ?? null,
          sale_type: line.sale_type ?? 'sale',
          rental_start_date: line.rental_start_date ?? null,
          rental_end_date: line.rental_end_date ?? null,
        })),
      },
      { allowManualPrice: userHasPermission(me, 'quote.price.override') },
    );

    await tryRecordAuditEvent({
      actorId: me.id, actorEmail: me.email, action: 'sale.created_direct', resourceType: 'sale', resourceId: result.id,
      after: { customer: customer.musteri, sale_date: input.sale_date, amount: result.amount, device_count: result.deviceCount, sales_channel: input.sales_channel ?? null, source: 'direct' },
    });

    revalidatePath('/crm/sales');
    // Tutar tutarlılık uyarısı (engellemez) — 045.
    const amountWarnings = result.id ? await saleAmountWarnings(result.id, result.amount, result.deviceCount) : [];
    return NextResponse.json({ ok: true, ...result, amount_warnings: amountWarnings }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Satış kaydı oluşturulamadı.');
  }
}
