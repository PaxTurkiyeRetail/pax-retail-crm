import { activityLabelFromRow, isDisplayableActivityRow, presentDurum } from '@/app/api/activities/_helpers';
import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  try {
    const me = await requireAllowedUserOrThrow();
    const myName = (me.full_name ?? '').trim();
    const url = new URL(req.url);
    const musteri_id = (url.searchParams.get('musteri_id') ?? '').trim();
    if (!musteri_id) return NextResponse.json({ message: 'musteri_id gerekli' }, { status: 400 });

    const admin = createSupabaseAdminClient();
    let q = admin
      .from('pipeline_eventleri')
      .select('id,musteri_id,faz_no,iteration_no,event_type,durum,aksiyon,owner,partner_owner,notlar,created_at,hedef_tarihi,created_by')
      .eq('musteri_id', musteri_id)
      .order('created_at', { ascending: false })
      .limit(80);


    const { data, error } = await q;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const rows = (data ?? []).filter((row: any) => isDisplayableActivityRow(row)).map((row: any) => ({
      ...row,
      hedef_tarihi: row.hedef_tarihi ?? null,
      notlar: row.notlar ?? null,
      aksiyon: activityLabelFromRow(row),
      durum: presentDurum(row.durum),
      owner: row.created_by ?? row.owner ?? null,
    }));

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
