import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { buildLiveBoard } from '@/lib/reports/live-board';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Sunucu (bu Node süreci) ne zaman ayağa kalktı: her pm2 reload'da değişir. İstemci bunu
// saklar; değişince "yeni sürüm var" uyarısı gösterir (TV modunda otomatik yenileme yapılamaz).
const SERVER_STARTED_AT = new Date().toISOString();

// Canlı Ekran (Satışçı Takip Raporu → "Canlı Ekran" sekmesi) — tek payload:
// takım özeti + kişi slaytları. İstemci 5 dakikada bir yeniden çağırır.
// Yetki: rapor merkezindeki diğer uçlarla aynı (report.read.all).
export async function GET() {
  try {
    await requireReportsAccessOrThrow();
    const payload = await buildLiveBoard();
    return NextResponse.json({ ...payload, server: { startedAt: SERVER_STARTED_AT } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Canlı ekran verisi oluşturulamadı.' },
      { status: error?.status || 500 },
    );
  }
}
