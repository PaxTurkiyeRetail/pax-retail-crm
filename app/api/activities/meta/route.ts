import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  try {
    await requireAllowedUserOrThrow();
    const url = new URL(req.url);
    const musteriId = url.searchParams.get('musteri_id')?.trim() || '';
    const fazNoRaw = url.searchParams.get('faz_no')?.trim() || '';
    const fazNo = Number(fazNoRaw);

    if (!musteriId || !Number.isFinite(fazNo)) {
      return NextResponse.json({ message: 'musteri_id ve faz_no gerekli' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: phaseStatus } = await admin
      .from('pipeline_eventleri')
      .select('durum, owner, partner_owner, created_at')
      .eq('musteri_id', musteriId)
      .eq('faz_no', fazNo)
      .not('durum', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: pipeline } = await admin
      .from('musteri_pipeline')
      .select('aktif_faz_no, durum, owner, partner_owner')
      .eq('musteri_id', musteriId)
      .maybeSingle();

    return NextResponse.json({
      durum: phaseStatus?.durum ?? (pipeline?.aktif_faz_no === fazNo ? pipeline?.durum ?? null : null),
      owner: phaseStatus?.owner ?? (pipeline?.aktif_faz_no === fazNo ? pipeline?.owner ?? null : null),
      partner_owner: phaseStatus?.partner_owner ?? (pipeline?.aktif_faz_no === fazNo ? pipeline?.partner_owner ?? null : null),
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
