import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { getKunyeOptions } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await requireCrmAccessOrThrow();
    const options = await getKunyeOptions();
    return NextResponse.json({ options });
  } catch (error: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: error?.status || 401 });
  }
}
