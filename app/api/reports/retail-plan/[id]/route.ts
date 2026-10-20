import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { patchRetailPlan, retailPlanPatchSchema } from '@/lib/reports/retail-plan';

export const dynamic = 'force-dynamic';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReportsAccessOrThrow();
    const id = z.string().uuid().parse((await context.params).id);
    const patch = await parseJsonBody(request, retailPlanPatchSchema);
    return NextResponse.json({ data: await patchRetailPlan(user, id, patch) });
  } catch (error) { return apiErrorResponse(error, 'Retail planı kaydedilemedi.'); }
}
