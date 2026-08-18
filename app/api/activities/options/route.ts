import { NextResponse } from 'next/server';
import { requireActivityReadOrThrow, userHasPermission } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { presentDurum } from '@/lib/activities/presentation';
import { BUSINESS_PARTNER_RESPONSIBLE } from '@/lib/report-only-customers';
import { getParameterOptionsByGroups } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}

export async function GET() {
  try {
    const me = await requireActivityReadOrThrow();
    const admin = createPgAdminClient();

    const canReadAny = userHasPermission(me, 'activity.read.any');
    let eventQuery = admin
      .from('pipeline_eventleri')
      .select('faz_no,durum,partner_owner,owner,created_by')
      .order('created_at', { ascending: false })
      .limit(1500);
    let customerQuery = admin
      .from('musteriler')
      .select('sorumlu,sektor')
      .limit(1500);
    if (!canReadAny) {
      eventQuery = eventQuery.eq('created_by_user_id', me.id);
      customerQuery = customerQuery.eq('owner_user_id', me.id);
    }

    const [{ data: events }, { data: customers }, { data: users }, parameterOptions] = await Promise.all([
      eventQuery,
      customerQuery,
      canReadAny ? admin
        .from('allowed_users')
        .select('full_name,is_active')
        .eq('is_active', true)
        .limit(200) : Promise.resolve({ data: [] as any[] }),
      getParameterOptionsByGroups(['activity_waiting_party']),
    ]);

    return NextResponse.json({
      phaseOptions: uniqueSorted((events ?? []).map((row: any) => row.faz_no != null ? String(row.faz_no) : '')),
      statusOptions: uniqueSorted((events ?? []).map((row: any) => presentDurum(row.durum))),
      partnerOptions: uniqueSorted((events ?? []).map((row: any) => row.partner_owner)),
      ownerOptions: uniqueSorted([
        ...(events ?? []).flatMap((row: any) => [row.owner, row.created_by]),
        ...(users ?? []).map((row: any) => row.full_name),
      ]),
      responsibleOptions: uniqueSorted([...(customers ?? []).map((row: any) => row.sorumlu), BUSINESS_PARTNER_RESPONSIBLE]),
      waitingSideOptions: parameterOptions.activity_waiting_party ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
