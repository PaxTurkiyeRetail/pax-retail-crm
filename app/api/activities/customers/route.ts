import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { appendLastStayedPhase } from '@/lib/crm-phase-history';
import { isBusinessPartnerSector, isPhaseOptionalCustomerByResponsible } from '@/lib/report-only-customers';
import { getPhaseOptionalResponsibles } from '@/lib/phase-optional-responsibles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ActivityCustomerRow = {
  musteri_id: string;
  musteri: string;
  sorumlu: string | null;
  sektor?: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  report_only?: boolean | null;
  is_business_partner?: boolean | null;
  son_kalinan_faz_no?: number | null;
  son_kalinan_faz_adi?: string | null;
  son_kalinan_faz_durumu?: string | null;
};

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[I]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sortCustomers(a: ActivityCustomerRow, b: ActivityCustomerRow) {
  return String(a.musteri ?? '').localeCompare(String(b.musteri ?? ''), 'tr');
}

export async function GET(req: Request) {
  try {
    await requireAllowedUserOrThrow();
    const admin = createPgAdminClient();
    const url = new URL(req.url);
    const qRaw = String(url.searchParams.get('q') ?? '').trim();
    const q = normalizeSearchText(qRaw);
    const selectedId = String(url.searchParams.get('id') ?? '').trim();
    const includeAll = url.searchParams.get('all') === '1';
    const phaseOptionalResponsibles = await getPhaseOptionalResponsibles();
    const requestedLimit = Number(url.searchParams.get('limit') ?? (includeAll ? 5000 : (qRaw ? 120 : 60)));
    const maxLimit = includeAll ? 5000 : 300;
    const limit = Math.min(Math.max(requestedLimit, 20), maxLimit);

    const applySearch = (query: any) => {
      if (!qRaw) return query;
      const safe = qRaw.replace(/[\%_]/g, ' ').trim();
      if (!safe) return query;
      const like = `%${safe}%`;
      return query.or([
        `musteri.ilike.${like}`,
        `sorumlu.ilike.${like}`,
        `sektor.ilike.${like}`,
      ].join(','));
    };

    let crmQuery = admin
      .from('vw_crm_musteriler')
      .select('musteri_id,musteri,sorumlu,sektor,aktif_faz_no,aktif_faz_adi')
      .order('musteri', { ascending: true })
      .limit(limit);
    crmQuery = applySearch(crmQuery);

    const phaseOptionalOrParts = phaseOptionalResponsibles
      .map((name) => String(name ?? '').trim())
      .filter(Boolean)
      .map((name) => `sorumlu.ilike.${name}`);

    let reportOnlyQuery = admin
      .from('musteriler')
      .select('id,musteri,sorumlu,sektor')
      .order('musteri', { ascending: true })
      .limit(Math.min(limit, 300));
    if (phaseOptionalOrParts.length) {
      reportOnlyQuery = reportOnlyQuery.or(phaseOptionalOrParts.join(','));
    } else if (!selectedId) {
      reportOnlyQuery = reportOnlyQuery.limit(0);
    }
    reportOnlyQuery = applySearch(reportOnlyQuery);

    const [{ data: crmRows, error: crmErr }, { data: reportOnlyRows, error: reportOnlyErr }, selectedResult] = await Promise.all([
      crmQuery,
      reportOnlyQuery,
      selectedId
        ? admin.from('musteriler').select('id,musteri,sorumlu,sektor').eq('id', selectedId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (crmErr) return NextResponse.json({ message: crmErr.message }, { status: 500 });
    if (reportOnlyErr) return NextResponse.json({ message: reportOnlyErr.message }, { status: 500 });

    const byId = new Map<string, ActivityCustomerRow>();

    (crmRows ?? []).forEach((row: any) => {
      const id = String(row.musteri_id ?? '').trim();
      if (!id) return;
      byId.set(id, {
        musteri_id: id,
        musteri: String(row.musteri ?? '').trim(),
        sorumlu: row.sorumlu ?? null,
        sektor: row.sektor ?? null,
        aktif_faz_no: row.aktif_faz_no != null ? Number(row.aktif_faz_no) : null,
        aktif_faz_adi: row.aktif_faz_adi ?? null,
        report_only: isPhaseOptionalCustomerByResponsible(row, phaseOptionalResponsibles),
        is_business_partner: isBusinessPartnerSector(row.sektor),
      });
    });

    const selectedRow = (selectedResult as any)?.data ?? null;
    const reportOnlySourceRows = selectedRow ? [...(reportOnlyRows ?? []), selectedRow] : (reportOnlyRows ?? []);

    reportOnlySourceRows
      .filter((row: any) => isPhaseOptionalCustomerByResponsible(row, phaseOptionalResponsibles) || String(row?.id ?? '') === selectedId)
      .forEach((row: any) => {
        const id = String(row.id ?? '').trim();
        if (!id) return;
        const existing = byId.get(id);
        const rowReportOnly = isPhaseOptionalCustomerByResponsible(row, phaseOptionalResponsibles);
        const rowBusinessPartner = isBusinessPartnerSector(row.sektor);

        // Secili normal musteri zaten CRM view'den geldiyse uzerine synthetic
        // report_only=true yazma. Bu eski bug Trendyol gibi normal musterileri
        // secince fazsiz/rapor kapsami gibi gosterebiliyordu.
        if (existing && !rowReportOnly && String(row?.id ?? '') === selectedId) {
          byId.set(id, {
            ...existing,
            musteri: String(existing.musteri || row.musteri || '').trim(),
            sorumlu: existing.sorumlu ?? row.sorumlu ?? null,
            sektor: existing.sektor ?? row.sektor ?? null,
            report_only: Boolean(existing.report_only) || rowReportOnly,
            is_business_partner: Boolean(existing.is_business_partner) || rowBusinessPartner,
          });
          return;
        }

        byId.set(id, {
          musteri_id: id,
          musteri: String(row.musteri ?? existing?.musteri ?? '').trim(),
          sorumlu: row.sorumlu ?? existing?.sorumlu ?? null,
          sektor: row.sektor ?? existing?.sektor ?? null,
          aktif_faz_no: existing?.aktif_faz_no ?? null,
          aktif_faz_adi: existing?.aktif_faz_adi ?? null,
          report_only: rowReportOnly,
          is_business_partner: rowBusinessPartner,
          son_kalinan_faz_no: existing?.son_kalinan_faz_no ?? null,
          son_kalinan_faz_adi: existing?.son_kalinan_faz_adi ?? null,
          son_kalinan_faz_durumu: existing?.son_kalinan_faz_durumu ?? null,
        });
      });

    let rows = Array.from(byId.values());

    if (q) {
      rows = rows.filter((row) => [row.musteri, row.sorumlu, row.sektor].some((value) => normalizeSearchText(value).includes(q)));
    }

    const enriched = await appendLastStayedPhase(rows.sort(sortCustomers));

    return NextResponse.json({ rows: enriched });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
