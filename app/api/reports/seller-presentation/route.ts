import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { buildWeeklyManagementPresentation } from '@/lib/weekly-management-presentation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const admin = createPgAdminClient();
    const url = new URL(request.url);
    const payload = await buildWeeklyManagementPresentation(admin, {
      from: String(url.searchParams.get('from') ?? '').trim(),
      to: String(url.searchParams.get('to') ?? '').trim(),
      owner: String(url.searchParams.get('owner') ?? '').trim(),
      segment: String(url.searchParams.get('segment') ?? '').trim(),
      sellerMode: true,
    });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yetkisiz' }, { status: error?.status || 401 });
  }
}
