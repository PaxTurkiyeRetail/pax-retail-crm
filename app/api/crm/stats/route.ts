import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import { getKunyeStatus, mapKunyeDbToUi, normalizeKunyeStatusFilter } from '@/lib/kunye';

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
    const kunyeStatus = normalizeKunyeStatusFilter(url.searchParams.get('kunye_status'));
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
      .select('musteri_id,kasa_pos_firmasi,magaza_sayisi,franchise_sayisi,toplam_pos_adedi,pos_modeli,erp,bankalar,pos_mulkiyet,pos_mulkiyet_bankalari');

    const kuyeMap = new Map((kunyeler ?? []).map((row: any) => [row.musteri_id, row]));
    const enriched = baseRows.map((row: any) => {
      const kunye = mapKunyeDbToUi(kuyeMap.get(row.musteri_id) ?? null);
      const status = getKunyeStatus({ ...kunye, firma_adi: row.musteri, has_kunye_record: Boolean(kunye) });
      return {
        ...row,
        ...(kunye ?? null),
        kunye_durumu: status.status,
        kunye_eksik_sayisi: status.missing,
        kunye_missing_fields: status.missingFields,
      };
    }).filter((row: any) => (kunyeStatus ? row.kunye_durumu === kunyeStatus : true));

    const missingBreakdown = {
      firma_adi: enriched.filter((row: any) => row.kunye_durumu === 'Eksik' && row.kunye_missing_fields?.includes('firma_adi')).length,
      magaza_veya_franchise: enriched.filter((row: any) => row.kunye_durumu === 'Eksik' && row.kunye_missing_fields?.includes('magaza_veya_franchise')).length,
      pos_modeli: enriched.filter((row: any) => row.kunye_durumu === 'Eksik' && row.kunye_missing_fields?.includes('pos_modeli')).length,
      toplam_pos_adedi: enriched.filter((row: any) => row.kunye_durumu === 'Eksik' && row.kunye_missing_fields?.includes('toplam_pos_adedi')).length,
    };

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
      missingBreakdown,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: e?.status || 401 });
  }
}
