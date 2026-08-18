import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { getSystemParameterValue } from '@/lib/system-parameters';
import { normalizePageSize, PAGE_SIZE_OPTIONS } from '@/lib/ui-pagination';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await requireAllowedUserOrThrow();
    const configured = await getSystemParameterValue('system_page_size', '25');
    return NextResponse.json({
      defaultPageSize: normalizePageSize(configured),
      pageSizeOptions: PAGE_SIZE_OPTIONS,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.status === 403 ? 'Yetkisiz' : 'Oturum gerekli' }, { status: error?.status || 401 });
  }
}
