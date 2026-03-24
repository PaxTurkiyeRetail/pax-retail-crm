import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getKunyeStatus, mapKunyeDbToUi } from '@/lib/kunye';
import { isAdminLike } from '@/lib/roles';

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}

function macroPhaseName(phaseNo: number | null | undefined) {
  if (phaseNo == null) return 'Fazsız';
  if (phaseNo >= 1 && phaseNo <= 4) return 'Lead';
  if (phaseNo >= 5 && phaseNo <= 9) return 'Contact';
  if (phaseNo >= 10 && phaseNo <= 14) return 'Opportunity';
  if (phaseNo >= 15 && phaseNo <= 23) return 'Pilot';
  if (phaseNo >= 24 && phaseNo <= 25) return 'Rollout';
  return 'Fazsız';
}

function summarize(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
}

export async function GET(request: Request) {
  try {
    const me = await requireReportsAccessOrThrow();
    const admin = createSupabaseAdminClient();
    const url = new URL(request.url);
    const selectedSeller = String(url.searchParams.get('seller') ?? '').trim();
    const myName = String(me.full_name ?? '').trim();
    const adminLike = isAdminLike(me.role);

    const { data: customers, error: customerError } = await admin
      .from('vw_crm_musteriler')
      .select('musteri_id,musteri,sorumlu,aktif_faz_no,aktif_faz_adi,sektor,entegrasyon_tipi')
      .order('musteri', { ascending: true })
      .limit(5000);

    if (customerError) {
      return NextResponse.json({ message: customerError.message }, { status: 500 });
    }

    const allRows = (customers ?? []).map((row: any) => ({
      musteri_id: String(row.musteri_id ?? '').trim(),
      musteri: String(row.musteri ?? '').trim() || '-',
      sorumlu: String(row.sorumlu ?? '').trim() || '-',
      aktif_faz_no: row.aktif_faz_no == null ? null : Number(row.aktif_faz_no),
      aktif_faz_adi: String(row.aktif_faz_adi ?? '').trim() || null,
      sektor: String(row.sektor ?? '').trim() || '-',
      entegrasyon_tipi: String(row.entegrasyon_tipi ?? '').trim() || '-',
    }));

    const sellerOptions = uniqueSorted(allRows.map((row) => row.sorumlu));
    const effectiveSeller = adminLike ? (selectedSeller || (sellerOptions.includes(myName) ? myName : sellerOptions[0] ?? '')) : myName;
    const sellerRows = effectiveSeller ? allRows.filter((row) => row.sorumlu === effectiveSeller) : allRows;
    const ids = sellerRows.map((row) => row.musteri_id).filter(Boolean);

    const kunyeMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: kunyeler, error: kunyeError } = await admin
        .from('musteri_kunye')
        .select('musteri_id,magaza_sayisi,franchise_sayisi,toplam_pos_adedi,pos_modeli,erp,bankalar,pos_mulkiyet,pos_mulkiyet_bankalari,sabit_kasa_yazilimi,saha_hizmeti_firmasi')
        .in('musteri_id', ids);
      if (!kunyeError) {
        for (const row of kunyeler ?? []) {
          const key = String((row as any).musteri_id ?? '').trim();
          if (key) kunyeMap.set(key, row);
        }
      }
    }

    const enriched = sellerRows.map((row) => {
      const kunye = mapKunyeDbToUi(kunyeMap.get(row.musteri_id) ?? null);
      const kunyeStatus = getKunyeStatus({ ...kunye, firma_adi: row.musteri, has_kunye_record: Boolean(kunye) });
      return {
        ...row,
        macro_faz: macroPhaseName(row.aktif_faz_no),
        kunye_durumu: kunyeStatus.status,
        kunye_eksik_sayisi: kunyeStatus.missing,
      };
    });

    let recentActivities: any[] = [];
    let activeCustomerIdSet = new Set<string>();
    const activeCustomerIds = ids.slice(0, 1000);

    if (activeCustomerIds.length > 0) {
      // Son 90 gün içinde aktivite olan müşterileri bul (activeCustomers için)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: activeData } = await admin
        .from('pipeline_eventleri')
        .select('musteri_id')
        .in('musteri_id', activeCustomerIds)
        .gte('created_at', ninetyDaysAgo.toISOString());

      activeCustomerIdSet = new Set(
        (activeData ?? []).map((row: any) => String(row.musteri_id ?? '').trim()).filter(Boolean)
      );

      // Son aktiviteler listesi için ayrıca çek (UI tablosu için)
      const { data: activityData } = await admin
        .from('pipeline_eventleri')
        .select('id,musteri_id,faz_no,created_at,created_by,notlar,musteriler(musteri,sorumlu)')
        .in('musteri_id', activeCustomerIds)
        .order('created_at', { ascending: false })
        .limit(20);

      recentActivities = (activityData ?? []).map((row: any) => ({
        id: String(row.id ?? ''),
        tarih: String(row.created_at ?? ''),
        musteri: String(row?.musteriler?.musteri ?? '').trim() || '-',
        sorumlu: String(row?.musteriler?.sorumlu ?? '').trim() || '-',
        aktiviteyi_giren: String(row.created_by ?? '').trim() || '-',
        faz: row.faz_no == null ? 'Fazsız' : `FAZ ${row.faz_no}`,
        not: String(row.notlar ?? '').trim() || '-',
      }));
    }

    const total = enriched.length;
    const withPhase = enriched.filter((row) => row.aktif_faz_no != null).length;
    const withoutPhase = total - withPhase;
    // activeCustomers: son 90 gün içinde aktivite olan müşteri sayısı (doğru hesaplama)
    const activeCustomers = activeCustomerIdSet.size;
    // recentActivityGap: hiç yakın aktivitesi olmayan müşteri sayısı
    const recentActivityGap = ids.filter((id) => !activeCustomerIdSet.has(id)).length;

    const kpi = {
      total,
      kunyeTamam: enriched.filter((row) => row.kunye_durumu === 'Var').length,
      kunyeEksik: enriched.filter((row) => row.kunye_durumu === 'Eksik').length,
      kunyeYok: enriched.filter((row) => row.kunye_durumu === 'Yok').length,
      activeCustomers,
      withPhase,
      withoutPhase,
      phaseCoveragePct: total ? Math.round((withPhase / total) * 100) : 0,
      kunyeCompletionPct: total ? Math.round((enriched.filter((row) => row.kunye_durumu === 'Var').length / total) * 100) : 0,
      recentActivityGap,
    };

    return NextResponse.json({
      sellerOptions,
      selectedSeller: effectiveSeller,
      kpi,
      phaseSummary: summarize(enriched.map((row) => row.macro_faz)),
      detailPhaseSummary: summarize(enriched.map((row) => row.aktif_faz_no == null ? 'Fazsız' : `${row.aktif_faz_adi || `FAZ ${row.aktif_faz_no}`}`)),
      kunyeSummary: [
        { label: 'Tamam', value: kpi.kunyeTamam },
        { label: 'Eksik', value: kpi.kunyeEksik },
        { label: 'Yok', value: kpi.kunyeYok },
      ],
      noPhaseRows: enriched
        .filter((row) => row.aktif_faz_no == null)
        .slice(0, 20)
        .map((row) => ({ musteri: row.musteri, sorumlu: row.sorumlu, kunye: row.kunye_durumu, sektor: row.sektor })),
      noPhaseTotal: enriched.filter((row) => row.aktif_faz_no == null).length,
      recentActivities,
    });
  } catch (error: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: error?.status || 401 });
  }
}
