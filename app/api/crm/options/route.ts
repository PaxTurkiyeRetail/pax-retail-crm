import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { HAVUZ_ACCOUNT_NAME } from '@/lib/crm';

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}

export async function GET() {
  try {
    await requireCrmAccessOrThrow();
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from('vw_crm_musteriler')
      .select('sektor,sorumlu,entegrasyon_tipi,aktif_faz_no')
      .order('musteri_id', { ascending: true })
      .limit(3000);


    const { data, error } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const rows = data ?? [];
    return NextResponse.json({
      ownerOptions: uniqueSorted([...rows.map((row: any) => row.sorumlu), HAVUZ_ACCOUNT_NAME]),
      sectorOptions: uniqueSorted(rows.map((row: any) => row.sektor)),
      integrationOptions: uniqueSorted(rows.map((row: any) => row.entegrasyon_tipi)),
      phaseOptions: uniqueSorted(rows.map((row: any) => row.aktif_faz_no != null ? `FAZ ${row.aktif_faz_no}` : '')),
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
