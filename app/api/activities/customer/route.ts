import { activityLabelFromRow, presentDurum } from '@/lib/activities/presentation';
import { NextResponse } from 'next/server';
import { assertOwnedResourceAccess, requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const url = new URL(req.url);
    const musteri_id = (url.searchParams.get('musteri_id') ?? '').trim();
    if (!musteri_id) return NextResponse.json({ message: 'musteri_id gerekli' }, { status: 400 });

    const admin = createPgAdminClient();
    const { data: customer } = await admin.from('musteriler').select('owner_user_id,sorumlu').eq('id', musteri_id).maybeSingle();
    if (!customer) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });
    assertOwnedResourceAccess({ user: me, resource: customer, ownPermission: 'customer.read', anyPermission: 'customer.read.any' });
    const q = admin
      .from('pipeline_eventleri')
      .select('id,musteri_id,faz_no,iteration_no,event_type,durum,aksiyon,owner,partner_owner,notlar,created_at,hedef_tarihi,created_by')
      .eq('musteri_id', musteri_id)
      .order('created_at', { ascending: false })
      .limit(80);


    const { data, error } = await q;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const rows = (data ?? []).map((row: any) => ({
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
