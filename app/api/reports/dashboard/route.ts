import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { userHasPermission } from '@/lib/permissions';
import { normalizeName } from '@/lib/reports/live-board-shared';
import { isPerfPeriod } from '@/lib/reports/performance-card';
import { buildPerformanceReport } from '@/lib/reports/performance-report';
import { buildPerformanceEvents } from '@/lib/reports/performance-activity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// DASHBOARD (05.10.2026) — karne yapısında tek sayfa. Her hesap açınca KENDİ durumunu görür.
// Yönetici (report.performance.read / report.read.all): tüm satıcılar + sıralama; diğerleri yalnız kendisi.
export async function GET(request: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const privileged = userHasPermission(user, 'report.performance.read') || userHasPermission(user, 'report.read.all');
    const raw = new URL(request.url).searchParams.get('period');
    const period = isPerfPeriod(raw) ? raw : 'month';
    const report = await buildPerformanceReport({ period });
    const names = [user.full_name, user.email].filter(Boolean).map((v) => normalizeName(String(v)));
    const me = report.owners.find((o) => names.includes(normalizeName(o.owner)))?.owner ?? null;
    if (!privileged && !me) {
      return NextResponse.json({ report: { ...report, owners: [] }, me: null, privileged, recent: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const events = await buildPerformanceEvents({ period, owner: privileged ? null : me });
    return NextResponse.json(
      {
        report: privileged ? report : { ...report, owners: report.owners.filter((o) => o.owner === me), team: null },
        me,
        privileged,
        recent: events.events.filter((e) => e.type !== 'aktivite').slice(0, 40),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Dashboard oluşturulamadı.' }, { status: error?.status || 500 });
  }
}
