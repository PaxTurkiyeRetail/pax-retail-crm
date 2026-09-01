import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { buildSellerFollowupReport } from '@/lib/reports/seller-followup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Satışçı Takip Raporu — sayfa 1 verisi (Takip Listesi + 3 KPI).
// Yetki: rapor merkezindeki diğer uçlarla aynı (report.read.all).
export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const url = new URL(request.url);
    const payload = await buildSellerFollowupReport({
      owner: String(url.searchParams.get('owner') ?? '').trim(),
    });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Takip raporu oluşturulamadı.' },
      { status: error?.status || 500 },
    );
  }
}
