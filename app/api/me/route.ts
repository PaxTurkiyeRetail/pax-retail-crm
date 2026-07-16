import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const me = await requireAllowedUserOrThrow();
    return NextResponse.json({ me });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
