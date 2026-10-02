export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requirePermissionOrThrow } from '@/lib/authz';
import { apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { createServiceInvoice } from '@/lib/sales/service-invoices';
import { updateAktifSatisKasasi } from '@/lib/reports/kasapos-entegrasyon';
import { serviceInvoiceSchema } from '@/lib/sales/service-invoices-schema';

// Hizmet faturası açma (032). Yetki `sale.create`; sahiplik kısıtı yok (entegrasyon ekibi tüm
// firmalara fatura girer). Tutar kalemlerden hesaplanır; elle tutar alınmaz.
export async function POST(request: Request) {
  try {
    const me = await requirePermissionOrThrow('sale.create');
    const input = await parseJsonBody(request, serviceInvoiceSchema);
    const row = await createServiceInvoice(
      { id: me.id, name: String(me.full_name ?? me.email ?? '').trim() || 'Bilinmiyor', email: me.email },
      {
        customerId: input.customer_id, periodMonth: input.period_month, currency: input.currency,
        invoiceDate: input.invoice_date ?? null, invoiceNo: input.invoice_no ?? null,
        ownerName: input.owner_name ?? null, note: input.note ?? null, lines: input.lines,
      },
    );
    if (input.aktif_satis_kasasi !== undefined) {
      await updateAktifSatisKasasi(input.customer_id, input.aktif_satis_kasasi ?? null, {
        id: me.id, email: me.email, name: String(me.full_name ?? me.email ?? '').trim() || 'Bilinmiyor',
      });
    }
    revalidatePath('/crm/sales');
    return NextResponse.json({ ok: true, row }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Hizmet faturası kaydedilemedi.');
  }
}
