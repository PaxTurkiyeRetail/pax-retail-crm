import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermissionOrThrow, requireReportsAccessOrThrow } from '@/lib/authz';
import { userHasPermission } from '@/lib/permissions';
import { apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { createItem, loadCustomerList } from '@/lib/reports/customer-list';
import { CUSTOMER_LIST_CATEGORY_KEYS, FIRM_NAME_MAX, type CustomerListPayload } from '@/lib/reports/customer-list-shared';

// Müşteri Listesi (H/F/L/K) — Raporlar › Müşteri Listesi.
//   GET  : herkes (report.read.all — Raporlar menüsündeki diğer ekranlarla aynı kapı)
//   POST : yeni firma; yalnız customer.assignment_list.manage (admin, super_admin)
// Ekran görünmese de API yetkiyi kendisi doğrular (kılavuz: "görünmeyen menü güvenlik sayılmaz").

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const categorySchema = z.enum(CUSTOMER_LIST_CATEGORY_KEYS as [string, ...string[]]);

const createSchema = z.object({
  category: categorySchema,
  ownerUserId: z.string().uuid().nullish(),
  owner: z.string().trim().min(1).max(120).nullish(),
  firma: z.string().trim().min(1, 'Firma adı boş olamaz.').max(FIRM_NAME_MAX),
  note: z.string().trim().max(500).nullish(),
}).refine((value) => Boolean(value.ownerUserId || value.owner), 'Kişi seçilmeli.');

export async function GET() {
  try {
    const me = await requireReportsAccessOrThrow();
    const { items, owners } = await loadCustomerList();
    const payload: CustomerListPayload = {
      generatedAt: new Date().toISOString(),
      items,
      owners,
      canManage: userHasPermission(me, 'customer.assignment_list.manage'),
    };
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Müşteri listesi yüklenemedi.');
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermissionOrThrow('customer.assignment_list.manage');
    const input = await parseJsonBody(request, createSchema);
    const item = await createItem(actor, {
      category: input.category as (typeof CUSTOMER_LIST_CATEGORY_KEYS)[number],
      ownerUserId: input.ownerUserId ?? null,
      owner: input.owner ?? null,
      firma: input.firma,
      note: input.note ?? null,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Firma eklenemedi.');
  }
}
