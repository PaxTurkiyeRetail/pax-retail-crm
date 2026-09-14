export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermissionOrThrow, userHasPermission } from '@/lib/authz';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { cancelServiceInvoice } from '@/lib/sales/service-invoices';

// İptal: kayıt silinmez, status='cancelled' (ciro/eksik-ay kontrolünden düşer; geçmiş okunabilir).
const cancelSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).nullish() });

export async function POST(request: Request) {
  try {
    const me = await requirePermissionOrThrow('quote.read');
    if (!userHasPermission(me, 'quote.update.own') && !userHasPermission(me, 'quote.update.any')) {
      throw new ApiError('FORBIDDEN', 'Hizmet faturası iptal yetkiniz yok.', 403);
    }
    const input = await parseJsonBody(request, cancelSchema);
    const row = await cancelServiceInvoice(
      { id: me.id, name: String(me.full_name ?? me.email ?? '').trim() || 'Bilinmiyor', email: me.email },
      input.id, input.reason ?? null,
    );
    revalidatePath('/crm/sales');
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    return apiErrorResponse(error, 'Hizmet faturası iptal edilemedi.');
  }
}
