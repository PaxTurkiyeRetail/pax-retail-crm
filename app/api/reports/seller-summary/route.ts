import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getKunyeStatus, mapKunyeDbToUi } from '@/lib/kunye';
import { fetchAllByCustomerIds, fetchAllRows } from '@/lib/reporting';
import { reportOnlyCustomerKind } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}


function sellerReportOwner(row: { musteri?: unknown; sorumlu?: unknown; sektor?: unknown }) {
  if (reportOnlyCustomerKind(row) === 'business-partner') return 'İş Ortakları';
  return String(row.sorumlu ?? '').trim() || '-';
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
    await requireReportsAccessOrThrow();
    const admin = createPgAdminClient();
    const url = new URL(request.url);
    const selectedSeller = String(url.searchParams.get('seller') ?? '').trim();

    const customers = await fetchAllRows<any>((from, to) => {
      return admin
        .from('vw_crm_musteriler')
        .select('musteri_id,musteri,sorumlu,aktif_faz_no,aktif_faz_adi,sektor,entegrasyon_tipi')
        .order('musteri', { ascending: true })
        .range(from, to);
    });

    const allRows = (customers ?? []).map((row: any) => {
      const musteri = String(row.musteri ?? '').trim() || '-';
      const sektor = String(row.sektor ?? '').trim() || '-';
      const rawSorumlu = String(row.sorumlu ?? '').trim();
      const sorumlu = sellerReportOwner({ musteri, sorumlu: rawSorumlu, sektor });
      return {
        musteri_id: String(row.musteri_id ?? '').trim(),
        musteri,
        sorumlu,
        aktif_faz_no: row.aktif_faz_no == null ? null : Number(row.aktif_faz_no),
        aktif_faz_adi: String(row.aktif_faz_adi ?? '').trim() || null,
        sektor,
        entegrasyon_tipi: String(row.entegrasyon_tipi ?? '').trim() || '-',
        kayit_tipi: reportOnlyCustomerKind({ musteri, sorumlu: rawSorumlu, sektor }) === 'business-partner' ? 'İş Ortağı' : 'Müşteri',
      };
    });

    const sellerOptions = ['Tüm Satıcılar', ...uniqueSorted(allRows.map((row) => row.sorumlu))];
    const effectiveSeller = selectedSeller && selectedSeller !== 'Tüm Satıcılar' ? selectedSeller : '';
    const sellerRows = effectiveSeller ? allRows.filter((row) => row.sorumlu === effectiveSeller) : allRows;
    const ids = sellerRows.map((row) => row.musteri_id).filter(Boolean);

    const kunyeMap = new Map<string, any>();
    if (ids.length > 0) {
      const kunyeler = await fetchAllByCustomerIds<any>(
        admin,
        'v_musteri_kunye_status',
        '*',
        ids,
      );
      for (const row of kunyeler) {
        const key = String((row as any).musteri_id ?? '').trim();
        if (key) kunyeMap.set(key, row);
      }
    }

    const enriched = sellerRows.map((row) => {
      const rawKunye = kunyeMap.get(row.musteri_id) ?? null;
      const kunye = mapKunyeDbToUi(rawKunye);
      const kunyeStatus = getKunyeStatus({ ...kunye, ...(rawKunye ?? {}), firma_adi: row.musteri, has_kunye_record: Boolean(kunye) });
      return {
        ...row,
        macro_faz: macroPhaseName(row.aktif_faz_no),
        kunye_durumu: kunyeStatus.status,
        kunye_eksik_sayisi: kunyeStatus.missing,
      };
    });

    let recentActivities: any[] = [];
    let activeCustomerIdSet = new Set<string>();

    if (ids.length > 0) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const activeData = await fetchAllByCustomerIds<any>(
        admin,
        'pipeline_eventleri',
        'musteri_id,created_at',
        ids,
        (query) => query.gte('created_at', ninetyDaysAgo.toISOString()).order('created_at', { ascending: false }),
      );
      activeCustomerIdSet = new Set(
        activeData.map((row: any) => String(row.musteri_id ?? '').trim()).filter(Boolean),
      );

      const activityData = await fetchAllByCustomerIds<any>(
        admin,
        'pipeline_eventleri',
        'id,musteri_id,faz_no,created_at,created_by,notlar,musteriler(musteri,sorumlu)',
        ids,
        (query) => query.order('created_at', { ascending: false }),
      );

      recentActivities = activityData
        .sort((a: any, b: any) => new Date(String(b.created_at ?? '')).getTime() - new Date(String(a.created_at ?? '')).getTime())
        .slice(0, 20)
        .map((row: any) => ({
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
    const activeCustomers = activeCustomerIdSet.size;
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
      coverageNote: 'Müşteri, İş Ortakları ve sorumlusu bulunan tüm portföy kayıtları dahildir.',
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
        .map((row) => ({ musteri: row.musteri, sorumlu: row.sorumlu, kunye: row.kunye_durumu, sektor: row.sektor })),
      noPhaseTotal: enriched.filter((row) => row.aktif_faz_no == null).length,
      recentActivities,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yetkisiz' }, { status: error?.status || 401 });
  }
}
