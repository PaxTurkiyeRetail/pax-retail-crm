import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import { getKunyeStatus } from '@/lib/kunye';

function unique(values: Array<string | null | undefined>) {
  return new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean)).size;
}

function toSummary(values: string[]) {
  const map = new Map<string, number>();
  values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
}

export async function GET(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') ?? '').trim();
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const sector = String(url.searchParams.get('sector') ?? '').trim();
    const integration = String(url.searchParams.get('integration') ?? '').trim();
    const kunyeStatus = String(url.searchParams.get('kunye_status') ?? '').trim();
    const fazNoRaw = String(url.searchParams.get('faz_no') ?? '').trim();
    const fazNo = fazNoRaw ? Number(fazNoRaw) : NaN;

    const supabase = await createSupabaseServerClient();
    let qy = supabase.from('vw_crm_musteriler').select('musteri_id,sektor,sorumlu,entegrasyon_tipi,aktif_faz_no,musteri');
    if (owner) qy = qy.eq('sorumlu', owner);
    if (sector) qy = qy.eq('sektor', sector);
    if (integration) qy = qy.eq('entegrasyon_tipi', integration);
    if (Number.isFinite(fazNo)) qy = qy.eq('aktif_faz_no', fazNo);
    if (q) {
      const escaped = q.replace(/[,%]/g, ' ').trim();
      qy = qy.or([`musteri.ilike.%${escaped}%`,`sektor.ilike.%${escaped}%`,`sorumlu.ilike.%${escaped}%`].join(','));
    }

    const { data, error } = await qy.limit(5000);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const baseRows = data ?? [];
    const admin = createSupabaseAdminClient();
    const { data: kunyeler } = await admin
      .from('musteri_kunye')
      .select('musteri_id,kasapos_firmasi,magaza_sayisi,toplam_pos_adedi,pos_modeli,erp,bankalar,pos_mulkiyet,pos_mulkiyet_bankalari');

    const kuyeMap = new Map((kunyeler ?? []).map((row: any) => [row.musteri_id, row]));
    const enriched = baseRows.map((row: any) => ({ ...row, ...(kuyeMap.get(row.musteri_id) ?? null), kunye_durumu: getKunyeStatus(kuyeMap.get(row.musteri_id) ?? null).status }))
      .filter((row: any) => (kunyeStatus ? row.kunye_durumu === kunyeStatus : true));

    return NextResponse.json({
      total: enriched.length,
      sectors: unique(enriched.map((row: any) => row.sektor)),
      kasaFirmasi: unique(enriched.map((row: any) => row.kasapos_firmasi)),
      accounts: unique(enriched.map((row: any) => row.sorumlu)),
      entegrasyonYapisi: unique(enriched.map((row: any) => row.entegrasyon_tipi)),
      kunyeVar: enriched.filter((row: any) => row.kunye_durumu === 'Var').length,
      kunyeEksik: enriched.filter((row: any) => row.kunye_durumu === 'Eksik').length,
      kunyeYok: enriched.filter((row: any) => row.kunye_durumu === 'Yok').length,
      byPhase: toSummary(enriched.map((row: any) => row.aktif_faz_no != null ? `FAZ ${row.aktif_faz_no}` : 'Fazsız')),
      byOwner: toSummary(enriched.map((row: any) => row.sorumlu)),
      bySector: toSummary(enriched.map((row: any) => row.sektor || '-')),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: e?.status || 401 });
  }
}
