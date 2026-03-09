import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';

export async function GET() {
  try {
    const me = await requireAllowedUserOrThrow();
    const supabase = (await createSupabaseServerClient());

    // Fetch minimal fields for aggregations from view
    let q = supabase.from('vw_crm_musteriler').select('aktif_faz_adi, risk, sorumlu');
    if (me.role !== 'admin') q = q.eq('sorumlu', me.email);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];
    const byFaz: Record<string, number> = {};
    const byRisk: Record<string, number> = {};

    for (const r of rows as any[]) {
      const faz = r.aktif_faz_adi ?? 'Bilinmiyor';
      const risk = r.risk ?? 'Bilinmiyor';
      byFaz[faz] = (byFaz[faz] ?? 0) + 1;
      byRisk[risk] = (byRisk[risk] ?? 0) + 1;
    }

    return NextResponse.json({ byFaz, byRisk, total: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: e?.status || 401 });
  }
}
