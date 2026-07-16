import { NextResponse } from 'next/server';
import { createPgAdminClient } from '@/lib/pg/admin';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { listPartnerPhaseOptions } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    await requireAllowedUserOrThrow();
    const url = new URL(req.url);
    const type = String(url.searchParams.get('type') ?? '').trim();
    if (type === 'business-partner') {
      const rows = await listPartnerPhaseOptions();
      return NextResponse.json({ fazlar: rows ?? [] });
    }

    const pgClient = createPgAdminClient();
    const { data, error } = await pgClient
      .from('faz_tanimlari')
      .select('faz_no, asama_adi')
      .order('faz_no', { ascending: true });

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ fazlar: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
