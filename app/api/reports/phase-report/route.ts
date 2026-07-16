import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getKunyeStatus, mapKunyeDbToUi } from '@/lib/kunye';
import { fetchAllByCustomerIds, fetchAllRows } from '@/lib/reporting';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type MacroGroup = 'Fazsız' | 'Fırsat' | 'İlk Temas' | 'Business' | 'Operasyon' | 'Yayılım';

const MACRO_ORDER: MacroGroup[] = ['Fırsat', 'İlk Temas', 'Business', 'Operasyon', 'Yayılım', 'Fazsız'];

function macroGroup(phaseNo: number | null | undefined): MacroGroup {
  if (phaseNo == null) return 'Fazsız';
  if (phaseNo >= 1 && phaseNo <= 4) return 'Fırsat';
  if (phaseNo >= 5 && phaseNo <= 9) return 'İlk Temas';
  if (phaseNo >= 10 && phaseNo <= 14) return 'Business';
  if (phaseNo >= 15 && phaseNo <= 23) return 'Operasyon';
  if (phaseNo >= 24 && phaseNo <= 25) return 'Yayılım';
  return 'Fazsız';
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'tr')
  );
}

export type PhaseRow = {
  musteri_id: string;
  musteri: string;
  sorumlu: string;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  macro_group: MacroGroup;
  sektor: string;
  entegrasyon_tipi: string;
  kunye_durumu: 'Var' | 'Eksik' | 'Yok';
};

export type PhaseReportPayload = {
  sellerOptions: string[];
  selectedSeller: string;
  rows: PhaseRow[];
  groupSummary: Array<{ group: MacroGroup; total: number; withPhase: number; withoutPhase: number }>;
  phaseBreakdown: Array<{ group: MacroGroup; faz_no: number | null; faz_adi: string | null; count: number }>;
  totals: { total: number; withPhase: number; withoutPhase: number; phaseCoveragePct: number };
};

export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const admin = createPgAdminClient();
    const url = new URL(request.url);

    const selectedSeller = String(url.searchParams.get('seller') ?? '').trim();
    const filterGroup = String(url.searchParams.get('group') ?? '').trim() as MacroGroup | '';

    const customers = await fetchAllRows<any>((from, to) => {
      return admin
        .from('vw_crm_musteriler')
        .select('musteri_id,musteri,sorumlu,aktif_faz_no,aktif_faz_adi,sektor,entegrasyon_tipi')
        .order('musteri', { ascending: true })
        .range(from, to);
    });

    const allRows = (customers ?? []).filter((row: any) => !isReportOnlyCustomer(row)).map((row: any) => ({
      musteri_id: String(row.musteri_id ?? '').trim(),
      musteri: String(row.musteri ?? '').trim() || '-',
      sorumlu: String(row.sorumlu ?? '').trim() || '-',
      aktif_faz_no: row.aktif_faz_no == null ? null : Number(row.aktif_faz_no),
      aktif_faz_adi: String(row.aktif_faz_adi ?? '').trim() || null,
      sektor: String(row.sektor ?? '').trim() || '-',
      entegrasyon_tipi: String(row.entegrasyon_tipi ?? '').trim() || '-',
    }));

    const sellerOptions = ['Tüm Satıcılar', ...uniqueSorted(allRows.map((r) => r.sorumlu))];
    const effectiveSeller = selectedSeller && selectedSeller !== 'Tüm Satıcılar' ? selectedSeller : '';

    let filtered = effectiveSeller ? allRows.filter((r) => r.sorumlu === effectiveSeller) : allRows;

    const ids = filtered.map((r) => r.musteri_id).filter(Boolean);
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

    let enriched: PhaseRow[] = filtered.map((row) => {
      const rawKunye = kunyeMap.get(row.musteri_id) ?? null;
      const kunye = mapKunyeDbToUi(rawKunye);
      const kunyeStatus = getKunyeStatus({ ...kunye, ...(rawKunye ?? {}), firma_adi: row.musteri, has_kunye_record: Boolean(kunye) });
      return {
        ...row,
        macro_group: macroGroup(row.aktif_faz_no),
        kunye_durumu: kunyeStatus.status as 'Var' | 'Eksik' | 'Yok',
      };
    });

    if (filterGroup && MACRO_ORDER.includes(filterGroup as MacroGroup)) {
      enriched = enriched.filter((r) => r.macro_group === filterGroup);
    }

    const groupSummary = MACRO_ORDER.map((group) => {
      const groupRows = enriched.filter((r) => r.macro_group === group);
      return {
        group,
        total: groupRows.length,
        withPhase: groupRows.filter((r) => r.aktif_faz_no != null).length,
        withoutPhase: groupRows.filter((r) => r.aktif_faz_no == null).length,
      };
    });

    const phaseBreakdownMap = new Map<string, number>();
    for (const row of enriched) {
      const key = `${row.macro_group}||${row.aktif_faz_no ?? 'null'}||${row.aktif_faz_adi ?? ''}`;
      phaseBreakdownMap.set(key, (phaseBreakdownMap.get(key) ?? 0) + 1);
    }
    const phaseBreakdown = Array.from(phaseBreakdownMap.entries())
      .map(([key, count]) => {
        const [group, faz_no_str, faz_adi] = key.split('||');
        return {
          group: group as MacroGroup,
          faz_no: faz_no_str === 'null' ? null : Number(faz_no_str),
          faz_adi: faz_adi || null,
          count,
        };
      })
      .sort((a, b) => {
        const gi = MACRO_ORDER.indexOf(a.group) - MACRO_ORDER.indexOf(b.group);
        if (gi !== 0) return gi;
        if (a.faz_no == null) return 1;
        if (b.faz_no == null) return -1;
        return a.faz_no - b.faz_no;
      });

    const total = enriched.length;
    const withPhase = enriched.filter((r) => r.aktif_faz_no != null).length;

    return NextResponse.json({
      sellerOptions,
      selectedSeller: effectiveSeller,
      rows: enriched,
      groupSummary,
      phaseBreakdown,
      totals: {
        total,
        withPhase,
        withoutPhase: total - withPhase,
        phaseCoveragePct: total ? Math.round((withPhase / total) * 100) : 0,
      },
    } satisfies PhaseReportPayload);
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Yetkisiz' }, { status: err?.status || 401 });
  }
}
