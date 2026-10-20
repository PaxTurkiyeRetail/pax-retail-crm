import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/http/api-error';
export const dynamic = 'force-dynamic';
export async function POST() {
  try {
    await requireReportsAccessOrThrow();
    return NextResponse.json({ message: 'Retail ekranı artık ana Forecast kayıtlarını kullanıyor. Sayfayı yenileyip Forecast üzerinden işlem yapın.' }, { status: 410 });
  } catch (error) { return apiErrorResponse(error, 'İşlem yapılamadı.'); }
}
