import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { buildKasaposEntegrasyonRaporu } from '@/lib/reports/kasapos-entegrasyon';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// KasaPOS Entegrasyon Raporu — aylık adet/tutar, kullanım %, satış fırsatı (salt okunur).
// Aktif satış kasası girişi: Satışlar › Hizmet Faturaları formu (/api/service-invoices/create|update).
export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const url = new URL(request.url);
    const year = Number(url.searchParams.get('year') ?? '') || undefined;
    const payload = await buildKasaposEntegrasyonRaporu({ year });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'KasaPOS entegrasyon raporu oluşturulamadı.' },
      { status: error?.status || 500 },
    );
  }
}
