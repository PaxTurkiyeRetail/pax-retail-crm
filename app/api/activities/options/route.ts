import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { presentDurum } from '@/app/api/activities/_helpers';

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}

export async function GET() {
  try {
    await requireAllowedUserOrThrow();
    const admin = createSupabaseAdminClient();

    const [{ data: events }, { data: customers }, { data: users }] = await Promise.all([
      admin
        .from('pipeline_eventleri')
        .select('faz_no,durum,partner_owner,owner,created_by')
        .order('created_at', { ascending: false })
        .limit(1500),
      admin
        .from('musteriler')
        .select('sorumlu')
        .limit(1500),
      admin
        .from('allowed_users')
        .select('full_name,is_active')
        .eq('is_active', true)
        .limit(200),
    ]);

    return NextResponse.json({
      phaseOptions: uniqueSorted((events ?? []).map((row: any) => row.faz_no != null ? String(row.faz_no) : '')),
      statusOptions: uniqueSorted((events ?? []).map((row: any) => presentDurum(row.durum))),
      partnerOptions: uniqueSorted((events ?? []).map((row: any) => row.partner_owner)),
      ownerOptions: uniqueSorted([
        ...(events ?? []).flatMap((row: any) => [row.owner, row.created_by]),
        ...(users ?? []).map((row: any) => row.full_name),
      ]),
      responsibleOptions: uniqueSorted((customers ?? []).map((row: any) => row.sorumlu)),
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
