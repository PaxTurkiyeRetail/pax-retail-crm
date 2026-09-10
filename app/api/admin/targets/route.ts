import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTargetsAccessOrThrow } from '@/lib/authz';
import { apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { loadTargetsAdmin, saveUserTargets } from '@/lib/reports/targets';
import { TARGET_CODES, targetYearOf } from '@/lib/reports/targets-shared';

// Hedefler (v2) — Yönetim › Hedefler (/admin/targets). Çağdaş Bey (10.09.2026): kişi bazlı
// hedefleri yalnız Admin / Super Admin girer (admin.targets.manage).
//   GET ?year=2026 : kişi × hedef değerleri (yıl + çeyrek) + haftalık aktivite hedefi
//   PUT            : bir kişinin bir yılına ait hedefleri (gönderilmeyen alanlara dokunulmaz)
// Ekran görünmese de API yetkiyi kendisi doğrular.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const valueSchema = z.union([z.number(), z.string(), z.null()]).optional();
const codeKeys = Object.fromEntries(TARGET_CODES.map((code) => [code, valueSchema])) as Record<(typeof TARGET_CODES)[number], typeof valueSchema>;
const quarterKeys = Object.fromEntries(TARGET_CODES.map((code) => [code, z.array(valueSchema).length(4).optional()])) as Record<(typeof TARGET_CODES)[number], z.ZodOptional<z.ZodArray<typeof valueSchema>>>;

const saveSchema = z.object({
  year: z.number().int().min(2024).max(2100),
  userId: z.string().uuid(),
  weeklyTotal: valueSchema,
  yearly: z.object(codeKeys).partial().optional(),
  quarterly: z.object(quarterKeys).partial().optional(),
});

export async function GET(request: Request) {
  try {
    await requireTargetsAccessOrThrow();
    const url = new URL(request.url);
    const year = targetYearOf(url.searchParams.get('year'), new Date().getFullYear());
    const payload = await loadTargetsAdmin(year);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Hedefler yüklenemedi.');
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireTargetsAccessOrThrow();
    const input = await parseJsonBody(request, saveSchema);
    const user = await saveUserTargets(actor, {
      year: input.year,
      userId: input.userId,
      weeklyTotal: input.weeklyTotal,
      yearly: input.yearly,
      quarterly: input.quarterly,
    });
    return NextResponse.json({ user });
  } catch (error) {
    return apiErrorResponse(error, 'Hedefler kaydedilemedi.');
  }
}
