import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { buildRetailOperasyon } from '@/lib/reports/retail-operasyon';
import { canEditRetailPlan } from '@/lib/reports/retail-plan';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const user = await requireReportsAccessOrThrow();
    const year = Number(new URL(request.url).searchParams.get('year')) || undefined;
    return NextResponse.json({ ...await buildRetailOperasyon({ year }), canEditRetailPlan: canEditRetailPlan(user) });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yetkisiz' }, { status: error?.status || 500 });
  }
}
