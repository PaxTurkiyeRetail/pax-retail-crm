import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { buildWeeklyTargets } from '@/lib/reports/weekly-targets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Dashboard "Hedef" kartı: haftalık hedef vs gerçekleşme, kişi bazlı.
export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const url = new URL(request.url);
    const payload = await buildWeeklyTargets({
      from: String(url.searchParams.get('from') ?? '').trim(),
      to: String(url.searchParams.get('to') ?? '').trim(),
      owner: String(url.searchParams.get('owner') ?? '').trim(),
    });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Hedef verisi alınamadı.' },
      { status: error?.status || 500 },
    );
  }
}
