import { NextResponse } from 'next/server';
import { getUserDepartments, requireReportsAccessOrThrow } from '@/lib/authz';
import { requireTvScreenOrReportsAccess } from '@/lib/tv-devices';
import { createPgAdminClient } from '@/lib/pg/admin';
import { buildWeeklyManagementPresentation } from '@/lib/weekly-management-presentation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireTvScreenOrReportsAccess('activity');
    // TV cihazında oturum yok → departman kısıtı yok; kullanıcıda izinli departmanlar uygulanır.
    const me = await requireReportsAccessOrThrow().catch(() => null);
    const allowedDepartments = me ? await getUserDepartments(me) : null;
    const admin = createPgAdminClient();
    const url = new URL(request.url);
    const payload = await buildWeeklyManagementPresentation(admin, {
      from: String(url.searchParams.get('from') ?? '').trim(),
      to: String(url.searchParams.get('to') ?? '').trim(),
      owner: String(url.searchParams.get('owner') ?? '').trim(),
      segment: String(url.searchParams.get('segment') ?? '').trim(),
      department: String(url.searchParams.get('department') ?? '').trim(),
      allowedDepartments,
    });
    return NextResponse.json({ ...payload, allowedDepartments });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yetkisiz' }, { status: error?.status || 401 });
  }
}
