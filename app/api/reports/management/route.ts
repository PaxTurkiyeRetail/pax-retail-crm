import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getKunyeStatus, mapKunyeDbToUi } from '@/lib/kunye';
import { activityLabelFromRow, isDisplayableActivityRow, presentDurum } from '@/lib/activities/presentation';
import { getSlaState } from '@/lib/sla';
import { fetchAllByCustomerIds, fetchAllRows } from '@/lib/reporting';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type BaseRow = {
  musteri_id: string | null;
  musteri: string | null;
  sektor: string | null;
  entegrasyon_tipi: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  sorumlu: string | null;
  son_not: string | null;
  bekleyen_taraf: string | null;
};

function summarize(rows: any[], key: string, limit = 5) {
  return Object.entries(rows.reduce<Record<string, number>>((acc, row) => {
    const label = String(row?.[key] ?? '-').trim() || '-';
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, value]) => ({ label, value }));
}

export async function GET() {
  try {
    await requireReportsAccessOrThrow();
    const admin = createPgAdminClient();

    const data = await fetchAllRows<BaseRow>((from, to) => {
      return admin
        .from('vw_crm_musteriler')
        .select('musteri_id,musteri,sektor,entegrasyon_tipi,aktif_faz_no,aktif_faz_adi,sorumlu,son_not,bekleyen_taraf')
        .order('musteri', { ascending: true })
        .range(from, to);
    });

    const baseRows = ((data ?? []) as BaseRow[]).filter((row: any) => !isReportOnlyCustomer(row));
    const ids = baseRows.map((r) => r.musteri_id).filter(Boolean) as string[];
    const kunyeMap = new Map<string, any>();
    const latestActivityMap = new Map<string, any>();

    if (ids.length) {
      const [kunyeler, activities] = await Promise.all([
        fetchAllByCustomerIds<any>(
          admin,
          'v_musteri_kunye_status',
          '*',
          ids,
        ),
        fetchAllByCustomerIds<any>(
          admin,
          'pipeline_eventleri',
          'musteri_id,durum,aksiyon,owner,partner_owner,created_at,hedef_tarihi,notlar',
          ids,
          (query) => query.order('created_at', { ascending: false }),
        ),
      ]);

      (kunyeler ?? []).forEach((row: any) => kunyeMap.set(row.musteri_id, row));
      for (const row of activities ?? []) {
        if (!row?.musteri_id || latestActivityMap.has(row.musteri_id)) continue;
        if (!isDisplayableActivityRow(row)) continue;
        latestActivityMap.set(row.musteri_id, {
          ...row,
          activity_label: activityLabelFromRow(row),
          activity_status: presentDurum(row.durum),
        });
      }
    }

    const rows = baseRows.map((r) => {
      const aktifFazNo = r.aktif_faz_no ?? null;
      const mevcutFaz = aktifFazNo != null ? `FAZ ${aktifFazNo}` : '-';
      const bekleyenTaraf = ((r.bekleyen_taraf ?? '').trim()) || '-';
      const rawKunye = r.musteri_id ? (kunyeMap.get(r.musteri_id) ?? null) : null;
      const kunye = mapKunyeDbToUi(rawKunye);
      const kunyeDurum = getKunyeStatus({ ...kunye, ...(rawKunye ?? {}), firma_adi: r.musteri, has_kunye_record: Boolean(kunye) }).status;
      const latestActivity = r.musteri_id ? latestActivityMap.get(r.musteri_id) ?? null : null;
      const slaState = getSlaState(latestActivity?.hedef_tarihi ?? null, latestActivity?.activity_status ?? null);
      return {
        musteri: (r.musteri ?? '').trim() || '-',
        sektor: (r.sektor ?? '').trim() || '-',
        entegrasyon_tipi: (r.entegrasyon_tipi ?? '').trim() || '-',
        mevcut_faz: mevcutFaz,
        son_aksiyon: latestActivity?.activity_label || (r.aktif_faz_adi ?? '').trim() || '-',
        sorumlu: (r.sorumlu ?? '').trim() || '-',
        satis_olasiligi_durumu: '-',
        sonraki_adim: ((r.son_not ?? '').trim()) || '-',
        bekleyen_taraf: bekleyenTaraf,
        kunye_durumu: kunyeDurum,
        sla_state: slaState,
      };
    });

    const totals = {
      toplam_musteri: rows.length,
      hamwe_kunye_var: rows.filter((r) => r.kunye_durumu === 'Var').length,
      hamwe_kunye_eksik: rows.filter((r) => r.kunye_durumu === 'Eksik').length,
      hamwe_kunye_yok: rows.filter((r) => r.kunye_durumu === 'Yok').length,
      sla_geciken: rows.filter((r) => r.sla_state === 'overdue').length,
      sla_bugun: rows.filter((r) => r.sla_state === 'today').length,
      sla_planli: rows.filter((r) => r.sla_state === 'upcoming').length,
      sla_tarihsiz: rows.filter((r) => r.sla_state === 'unscheduled').length,
    };

    return NextResponse.json({
      rows,
      totals,
      highlights: {
        owners: summarize(rows, 'sorumlu'),
        waiting: summarize(rows, 'bekleyen_taraf'),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
