import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { activityLabelFromRow, isDisplayableActivityRow, presentDurum } from '@/app/api/activities/_helpers';

export async function GET(req: Request) {
  try {
    const me = await requireAllowedUserOrThrow();
    const myName = (me.full_name ?? '').trim();
    if (!myName) return NextResponse.json({ message: 'Kullanıcı adı/soyadı boş.' }, { status: 400 });

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const owner = (url.searchParams.get('owner') ?? '').trim();
    const fazNoRaw = (url.searchParams.get('faz_no') ?? '').trim();
    const fazNo = fazNoRaw ? Number(fazNoRaw) : NaN;
    const durum = (url.searchParams.get('durum') ?? '').trim();
    const partner = (url.searchParams.get('partner_owner') ?? '').trim();
    const from = (url.searchParams.get('from') ?? '').trim();
    const to = (url.searchParams.get('to') ?? '').trim();

    const admin = createSupabaseAdminClient();
    let query = admin
      .from('pipeline_eventleri')
      .select('id,musteri_id,faz_no,iteration_no,event_type,durum,aksiyon,owner,partner_owner,notlar,created_at,hedef_tarihi,created_by,musteriler(musteri,sektor,entegrasyon_tipi,risk,sorumlu)')
      .order('created_at', { ascending: false })
      .limit(1200);

    if (owner) query = query.eq('created_by', owner);
    if (Number.isFinite(fazNo)) query = query.eq('faz_no', fazNo);
    if (partner) query = query.eq('partner_owner', partner);
    if (durum) query = query.eq('durum', durum);
    if (from) query = query.gte('created_at', `${from}T00:00:00`);
    if (to) query = query.lte('created_at', `${to}T23:59:59`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    let rows = (data ?? []).filter((row: any) => isDisplayableActivityRow(row)).map((row: any) => ({
      ...row,
      due_date: row.hedef_tarihi ?? null,
      activity_label: activityLabelFromRow(row),
      activity_status: presentDurum(row.durum),
      owner: row.created_by ?? row.owner ?? null,
    }));

    if (q) {
      const needle = q.toLocaleLowerCase('tr');
      rows = rows.filter((row: any) => {
        const customerName = String(row?.musteriler?.musteri ?? '').toLocaleLowerCase('tr');
        return customerName.includes(needle)
          || String(row?.activity_label ?? '').toLocaleLowerCase('tr').includes(needle)
          || String(row?.notlar ?? '').toLocaleLowerCase('tr').includes(needle)
          || String(row?.owner ?? '').toLocaleLowerCase('tr').includes(needle)
          || String(row?.activity_status ?? '').toLocaleLowerCase('tr').includes(needle);
      });
    }

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
