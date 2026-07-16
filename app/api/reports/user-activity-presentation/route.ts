import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { buildUserActivityPresentation } from '@/lib/user-activity-presentation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireAdminOrThrow();
    const url = new URL(request.url);
    const payload = await buildUserActivityPresentation({
      from: String(url.searchParams.get('from') ?? '').trim(),
      to: String(url.searchParams.get('to') ?? '').trim(),
      userId: String(url.searchParams.get('user_id') ?? '').trim(),
    });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Rapor oluşturulamadı.' }, { status: error?.status || 500 });
  }
}
