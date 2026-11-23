import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { buildSozlesmeFaturalama } from '@/lib/reports/sozlesme-faturalama';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Sözleşme / Faturalama raporu (054): faturalama tarihi = fatura başlangıcı, yoksa satış tarihi.
export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const url = new URL(request.url);
    const year = Number(url.searchParams.get('year') ?? '') || undefined;
    const payload = await buildSozlesmeFaturalama({ year });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Sözleşme / faturalama raporu oluşturulamadı.' },
      { status: error?.status || 500 },
    );
  }
}
