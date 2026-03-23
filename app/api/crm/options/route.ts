import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import { HAVUZ_ACCOUNT_NAME } from '@/lib/crm';

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}

export async function GET() {
  try {
    const me = await requireCrmAccessOrThrow();
    const supabase = await createSupabaseServerClient();
    const myName = (me.full_name ?? '').trim();

    let query = supabase
      .from('vw_crm_musteriler')
      .select('musteri_id,sektor,sorumlu,entegrasyon_tipi,aktif_faz_no')
      .order('musteri_id', { ascending: true })
      .limit(3000);

    if (!isAdminLike(me.role)) query = query.eq('sorumlu', myName);

    const { data, error } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const rows = data ?? [];
    const ids = rows.map((row: any) => row.musteri_id).filter(Boolean);

    let kasaOptions: string[] = [];
    if (ids.length > 0) {
      const admin = createSupabaseAdminClient();
      const { data: kunyeler } = await admin
        .from('musteri_kunye')
        .select('musteri_id,sabit_kasa_yazilimi')
        .in('musteri_id', ids);

      kasaOptions = uniqueSorted((kunyeler ?? []).map((row: any) => row.sabit_kasa_yazilimi));
    }

    return NextResponse.json({
      ownerOptions: uniqueSorted([...rows.map((row: any) => row.sorumlu), HAVUZ_ACCOUNT_NAME]),
      sectorOptions: uniqueSorted(rows.map((row: any) => row.sektor)),
      integrationOptions: uniqueSorted(rows.map((row: any) => row.entegrasyon_tipi)),
      kasaOptions,
      phaseOptions: uniqueSorted(rows.map((row: any) => row.aktif_faz_no != null ? `FAZ ${row.aktif_faz_no}` : '')),
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
