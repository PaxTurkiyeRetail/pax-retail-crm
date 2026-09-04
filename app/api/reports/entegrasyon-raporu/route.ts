import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { buildEntegrasyonRaporu } from '@/lib/reports/entegrasyon-raporu';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Entegrasyon Raporu — Entegrasyon Firması iş ortaklarının faz/son not durumu.
export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const url = new URL(request.url);
    const payload = await buildEntegrasyonRaporu({
      owner: String(url.searchParams.get('owner') ?? '').trim(),
    });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Entegrasyon raporu oluşturulamadı.' },
      { status: error?.status || 500 },
    );
  }
}
