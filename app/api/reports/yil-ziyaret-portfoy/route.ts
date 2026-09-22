import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { buildYilZiyaretPortfoyRaporu } from '@/lib/reports/yil-ziyaret-portfoy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Yıl Ziyaret & Portföy Sağlığı Raporu — tüm satışçıların yıl ziyaret oranı ve portföy sağlığı tek listede.
export async function GET() {
  try {
    await requireReportsAccessOrThrow();
    const payload = await buildYilZiyaretPortfoyRaporu();
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Rapor oluşturulamadı.' },
      { status: error?.status || 500 },
    );
  }
}
