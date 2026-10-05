import { NextResponse } from 'next/server';
import { requirePerformanceAccessOrThrow } from '@/lib/authz';
import { isPerfPeriod } from '@/lib/reports/performance-card';
import { buildPerformanceReport, savePerformanceReview } from '@/lib/reports/performance-report';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PERFORMANS KARNESİ (05.10.2026) — yalnız report.performance.read (admin + super_admin).
// GET ?period=month|quarter|ytd (varsayılan ytd) · PUT { ownerKey, periodKey, strong, improve, focus }.
function fail(error: any, fallback: string) {
  return NextResponse.json({ message: error?.message || fallback }, { status: error?.status || 500 });
}

export async function GET(request: Request) {
  try {
    await requirePerformanceAccessOrThrow();
    const raw = new URL(request.url).searchParams.get('period');
    const period = isPerfPeriod(raw) ? raw : 'ytd';
    const payload = await buildPerformanceReport({ period, canEditReview: true });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return fail(error, 'Performans karnesi oluşturulamadı.');
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requirePerformanceAccessOrThrow();
    const body = await request.json().catch(() => null);
    const ownerKey = String(body?.ownerKey ?? '').trim();
    const periodKey = String(body?.periodKey ?? '').trim();
    if (!ownerKey || !/^(ytd-\d{4}|q[1-4]-\d{4}|m-\d{4}-\d{2})$/.test(periodKey)) {
      return NextResponse.json({ message: 'Geçersiz satıcı veya dönem.' }, { status: 400 });
    }
    const saved = await savePerformanceReview({
      ownerKey, periodKey,
      strong: String(body?.strong ?? ''), improve: String(body?.improve ?? ''), focus: String(body?.focus ?? ''),
      actor: user.full_name || user.email,
    });
    return NextResponse.json(saved);
  } catch (error: any) {
    return fail(error, 'Değerlendirme kaydedilemedi.');
  }
}
