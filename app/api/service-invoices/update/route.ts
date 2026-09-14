export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requirePermissionOrThrow, userHasPermission } from '@/lib/authz';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { updateServiceInvoice } from '@/lib/sales/service-invoices';
import { serviceInvoiceUpdateSchema } from '@/lib/sales/service-invoices-schema';

// Hizmet faturası düzenleme: Satışlar ile aynı gevşek kural (Sinan, 10.09) — quote.update.own
// olan herkes düzenleyebilir; her değişiklik crm_audit_events'e düşer.

export async function POST(request: Request) {
  try {
    const me = await requirePermissionOrThrow('quote.read');
    if (!userHasPermission(me, 'quote.update.own') && !userHasPermission(me, 'quote.update.any')) {
      throw new ApiError('FORBIDDEN', 'Hizmet faturası düzenleme yetkiniz yok.', 403);
    }
    const input = await parseJsonBody(request, serviceInvoiceUpdateSchema);
    const row = await updateServiceInvoice(
      { id: me.id, name: String(me.full_name ?? me.email ?? '').trim() || 'Bilinmiyor', email: me.email },
      input.id,
      {
        customerId: input.customer_id, periodMonth: input.period_month, currency: input.currency,
        invoiceDate: input.invoice_date ?? null, invoiceNo: input.invoice_no ?? null,
        ownerName: input.owner_name ?? null, note: input.note ?? null, lines: input.lines,
      },
    );
    revalidatePath('/crm/sales');
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    return apiErrorResponse(error, 'Hizmet faturası güncellenemedi.');
  }
}
