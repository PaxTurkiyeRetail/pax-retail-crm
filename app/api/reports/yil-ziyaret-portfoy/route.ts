import { NextResponse } from 'next/server';
import { getUserDepartments, requireReportsAccessOrThrow } from '@/lib/authz';
import { resolveDepartmentFilter } from '@/lib/departments';
import { buildYilZiyaretPortfoyRaporu } from '@/lib/reports/yil-ziyaret-portfoy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Yıl Ziyaret & Portföy Sağlığı Raporu — tüm satışçıların yıl ziyaret oranı ve portföy sağlığı tek listede.
export async function GET(request: Request) {
  try {
    const me = await requireReportsAccessOrThrow();
    const allowedDepartments = await getUserDepartments(me);
    const departments = resolveDepartmentFilter(new URL(request.url).searchParams.get('department'), allowedDepartments);
    const payload = await buildYilZiyaretPortfoyRaporu({ departments });
    return NextResponse.json({ ...payload, allowedDepartments }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Rapor oluşturulamadı.' },
      { status: error?.status || 500 },
    );
  }
}
