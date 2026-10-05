import { NextResponse } from 'next/server';
import { requirePerformanceAccessOrThrow } from '@/lib/authz';
import { isPerfPeriod } from '@/lib/reports/performance-card';
import { buildPerformanceReport } from '@/lib/reports/performance-report';
import { buildPerformanceEvents } from '@/lib/reports/performance-activity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PERFORMANS KARNESİ (05.10.2026) — yalnız report.performance.read (admin + super_admin).
// GET ?period=month|quarter|ytd (varsayılan ytd) · &detail=events&owner=<ad> → Hareket Dökümü.
export async function GET(request: Request) {
  try {
    await requirePerformanceAccessOrThrow();
    const params = new URL(request.url).searchParams;
    const raw = params.get('period');
    const period = isPerfPeriod(raw) ? raw : 'ytd';
    if (params.get('detail') === 'events') {
      const owner = String(params.get('owner') ?? '').trim() || null;
      return NextResponse.json(await buildPerformanceEvents({ period, owner }), { headers: { 'Cache-Control': 'no-store' } });
    }
    const payload = await buildPerformanceReport({ period });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Performans karnesi oluşturulamadı.' }, { status: error?.status || 500 });
  }
}
