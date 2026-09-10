import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermissionOrThrow } from '@/lib/authz';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { deactivateItem, updateItem } from '@/lib/reports/customer-list';
import { CUSTOMER_LIST_CATEGORY_KEYS, FIRM_NAME_MAX } from '@/lib/reports/customer-list-shared';

// Müşteri Listesi (H/F/L/K) tek kayıt: PATCH = yeniden adlandır / not / TAŞI
// (kategori ve/veya kişi, sürükle-bırak sırası `beforeId`), DELETE = pasife al.
// Yalnız customer.assignment_list.manage (admin, super_admin).

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();

const patchSchema = z.object({
  firma: z.string().trim().min(1, 'Firma adı boş olamaz.').max(FIRM_NAME_MAX).optional(),
  note: z.string().trim().max(500).nullable().optional(),
  category: z.enum(CUSTOMER_LIST_CATEGORY_KEYS as [string, ...string[]]).optional(),
  ownerUserId: z.string().uuid().nullish(),
  owner: z.string().trim().min(1).max(120).nullish(),
  beforeId: z.string().uuid().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Değişecek alan yok.');

async function parseId(ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new ApiError('INVALID_ID', 'Geçersiz kayıt kimliği.', 400);
  return parsed.data;
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermissionOrThrow('customer.assignment_list.manage');
    const id = await parseId(ctx);
    const input = await parseJsonBody(request, patchSchema);
    const item = await updateItem(actor, id, {
      firma: input.firma,
      note: input.note,
      category: input.category as (typeof CUSTOMER_LIST_CATEGORY_KEYS)[number] | undefined,
      ownerUserId: input.ownerUserId ?? null,
      owner: input.owner ?? null,
      beforeId: input.beforeId,
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiErrorResponse(error, 'Kayıt güncellenemedi.');
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermissionOrThrow('customer.assignment_list.manage');
    const id = await parseId(ctx);
    const item = await deactivateItem(actor, id);
    return NextResponse.json({ item });
  } catch (error) {
    return apiErrorResponse(error, 'Kayıt kaldırılamadı.');
  }
}
