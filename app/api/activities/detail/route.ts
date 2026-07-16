import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { activityLabelFromRow, presentDurum } from '@/app/api/activities/_helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    await requireAllowedUserOrThrow();
    const url = new URL(req.url);
    const activity_id = (url.searchParams.get('activity_id') ?? '').trim();
    if (!activity_id) return NextResponse.json({ message: 'activity_id gerekli' }, { status: 400 });

    const admin = createPgAdminClient();
    const { data, error } = await admin
      .from('pipeline_eventleri')
      .select('id,musteri_id,faz_no,durum,aksiyon,partner_owner,notlar,hedef_tarihi,created_at,created_by,is_blocked,blocked_note,blocked_at,blocked_by,activity_scope,affects_phase')
      .eq('id', activity_id)
      .single();

    if (error || !data) return NextResponse.json({ message: error?.message || 'Aktivite bulunamadı' }, { status: 404 });

    return NextResponse.json({
      row: {
        ...data,
        activity_label: activityLabelFromRow(data),
        activity_status: presentDurum(data.durum),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
