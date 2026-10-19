import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { buildRetailOperasyon } from '@/lib/reports/retail-operasyon';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const year = Number(new URL(request.url).searchParams.get('year')) || undefined;
    return NextResponse.json(await buildRetailOperasyon({ year }));
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yetkisiz' }, { status: error?.status || 500 });
  }
}
