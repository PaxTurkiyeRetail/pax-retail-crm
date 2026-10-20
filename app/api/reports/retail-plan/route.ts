import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { createRetailPlan, retailPlanCreateSchema } from '@/lib/reports/retail-plan';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const user = await requireReportsAccessOrThrow();
    const input = await parseJsonBody(request, retailPlanCreateSchema);
    return NextResponse.json({ data: await createRetailPlan(user, input) }, { status: 201 });
  } catch (error) { return apiErrorResponse(error, 'Retail planı eklenemedi.'); }
}
