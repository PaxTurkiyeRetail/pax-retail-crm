import { NextResponse } from 'next/server';
import { createPgServerClient } from '@/lib/pg/server';
import { createPgAdminClient } from '@/lib/pg/admin';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { getKunyeStatus, mapKunyeDbToUi, normalizeKunyeStatusFilter } from '@/lib/kunye';
import { appendLastStayedPhase } from '@/lib/crm-phase-history';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function phaseSearchText(phaseNo: number | null | undefined, phaseName: string | null | undefined) {
  if (phaseNo != null && phaseNo >= 1 && phaseNo <= 4) return `Fırsat İlk Temas ${phaseName ?? ''} Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 5 && phaseNo <= 9) return `Analiz + Sunumlar ${phaseName ?? ''} Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 10 && phaseNo <= 14) return `Business ${phaseName ?? ''} Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 15 && phaseNo <= 23) return `Operasyon ${phaseName ?? ''} Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 24 && phaseNo <= 25) return `Yayılım ${phaseName ?? ''} Faz ${phaseNo}`;
  return `${phaseName ?? ''} Yazılım`;
}

function escapeIlike(value: string) {
  return String(value ?? '').replace(/[\%_]/g, ' ').trim();
}

function applyDbFilters(query: any, params: {
  owner: string;
  sector: string;
  integration: string;
  fazNo: number;
  q: string;
  lite: boolean;
}) {
  const { owner, sector, integration, fazNo, q } = params;

  if (owner) query = query.ilike('sorumlu', escapeIlike(owner));
  if (sector) query = query.ilike('sektor', escapeIlike(sector));
  // entegrasyon_tipi enum oldugu icin DB tarafinda ilike kullanilmaz; JS tarafinda filtrelenir.
  if (Number.isFinite(fazNo)) query = query.eq('aktif_faz_no', fazNo);

  // Hiz: ana arama artik once DB tarafinda daraltilir.
  // Sonucta yine UI tarafinda normalize kontrol uygulanir; fakat artik tum
  // musteri havuzunu cekmek yerine Postgres sayfalama/count calisir.
  if (q) {
    const needle = escapeIlike(q);
    if (needle) {
      const like = `%${needle}%`;
      query = query.or([
        `musteri.ilike.${like}`,
        `sektor.ilike.${like}`,
        `sorumlu.ilike.${like}`,
        `aktif_faz_adi.ilike.${like}`,
      ].join(','));
    }
  }

  return query;
}

async function fetchAllRows(pgClient: any, params: {
  owner: string;
  sector: string;
  integration: string;
  fazNo: number;
  q: string;
  lite: boolean;
}) {
  const batchSize = 1000;
  let from = 0;
  const allRows: any[] = [];

  while (true) {
    let query = pgClient
      .from('vw_crm_musteriler')
      .select('*')
      .order('musteri', { ascending: true })
      .range(from, from + batchSize - 1);

    query = applyDbFilters(query, params);

    const { data, error } = await query;
    if (error) throw error;

    const chunk = data ?? [];
    allRows.push(...chunk);

    if (chunk.length < batchSize) break;
    from += batchSize;
  }

  return allRows;
}


async function fetchReportOnlyCustomerRows(admin: any, params: {
  owner: string;
  sector: string;
  integration: string;
  fazNo: number;
  kasaFirmasi: string;
  kunyeStatus: string;
}) {
  // Rapor müşterileri müşteri listesinde görünsün; fakat künye durumu,
  // kasa ve faz filtrelerinde yer almasın. Çünkü bu kayıtlar künye/faz
  // müşterisi değil, sadece teknik aktivite + yönetim sunumu kapsamındadır.
  if (Number.isFinite(params.fazNo) || params.kasaFirmasi || params.kunyeStatus) return [];

  let query = admin
    .from('musteriler')
    .select('id,musteri,sektor,entegrasyon_tipi,satis_olasiligi,sorumlu')
    .or('sektor.ilike.İŞ ORTAĞI,sektor.ilike.IS ORTAGI')
    .order('musteri', { ascending: true });

  if (params.owner) query = query.ilike('sorumlu', escapeIlike(params.owner));
  if (params.sector) query = query.ilike('sektor', escapeIlike(params.sector));
  const integrationNeedle = normalizeSearchText(params.integration);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => isReportOnlyCustomer(row))
    .filter((row: any) => !integrationNeedle || normalizeSearchText(row.entegrasyon_tipi).includes(integrationNeedle))
    .map((row: any) => ({
    musteri_id: row.id,
    id: row.id,
    musteri: row.musteri,
    sektor: row.sektor ?? null,
    entegrasyon_tipi: row.entegrasyon_tipi ?? null,
    satis_olasiligi: row.satis_olasiligi ?? null,
    sorumlu: row.sorumlu ?? null,
    aktif_faz_no: null,
    aktif_faz_adi: null,
    report_only: true,
  }));
}

function mergeRowsByCustomerId(rows: any[]) {
  const map = new Map<string, any>();
  for (const row of rows) {
    const id = row?.musteri_id ?? row?.id;
    if (!id) continue;
    const current = map.get(id);
    // View satırı varsa onu koru; synthetic rapor satırı sadece eksikleri tamamlar.
    if (!current || current.report_only) map.set(id, row);
  }
  return Array.from(map.values()).sort((a, b) => String(a.musteri ?? '').localeCompare(String(b.musteri ?? ''), 'tr'));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lite = url.searchParams.get('lite') === '1';
    const includeAll = url.searchParams.get('all') === '1';
    const includeReportOnly = url.searchParams.get('include_report_only') === '1';
    const q = String(url.searchParams.get('q') ?? '').trim();
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const sector = String(url.searchParams.get('sector') ?? '').trim();
    const integration = String(url.searchParams.get('integration') ?? '').trim();
    const kasaFirmasi = String(url.searchParams.get('kasa_firmasi') ?? '').trim();
    const kunyeStatus = normalizeKunyeStatusFilter(url.searchParams.get('kunye_status'));
    const fazNoRaw = String(url.searchParams.get('faz_no') ?? '').trim();
    const fazNo = fazNoRaw ? Number(fazNoRaw) : NaN;
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const defaultPageSize = lite ? 2000 : 10;
    const maxPageSize = lite ? 10000 : 100;
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), defaultPageSize), maxPageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize;

    const pgClient = await createPgServerClient();
    await requireCrmAccessOrThrow();
    const admin = createPgAdminClient();

    const needsClientFiltering = Boolean(kasaFirmasi || kunyeStatus || integration);
    const shouldReturnAllLiteRows = (lite && includeAll) || needsClientFiltering;
    // include_report_only artik tek basina tum musterileri cekmeye zorlamaz.
    // Normal liste ekrani sayfa sayfa DB'den gelir; sadece arama/kunye/kasa gibi
    // uygulama katmani filtresi gereken durumlarda toplu cekim yapilir.

    let rows: any[] = [];
    let count: number | null = null;

    if (shouldReturnAllLiteRows) {
      rows = (await fetchAllRows(pgClient, { owner, sector, integration, fazNo, q, lite })).filter((row: any) => includeReportOnly || !isReportOnlyCustomer(row));
      if (includeReportOnly) {
        const reportOnlyRows = await fetchReportOnlyCustomerRows(admin, { owner, sector, integration, fazNo, kasaFirmasi, kunyeStatus });
        rows = mergeRowsByCustomerId([...rows, ...reportOnlyRows]);
      }
      count = rows.length;
    } else {
      let query = pgClient
        .from('vw_crm_musteriler')
        .select('*', { count: 'exact' })
        .order('musteri', { ascending: true })
        .range(from, to - 1);

      query = applyDbFilters(query, { owner, sector, integration, fazNo, q, lite });

      const result = await query;
      if (result.error) return NextResponse.json({ message: result.error.message }, { status: 500 });
      rows = (result.data ?? []).filter((row: any) => includeReportOnly || !isReportOnlyCustomer(row));
      if (includeReportOnly) {
        const reportOnlyRows = await fetchReportOnlyCustomerRows(admin, { owner, sector, integration, fazNo, kasaFirmasi, kunyeStatus });
        rows = mergeRowsByCustomerId([...rows, ...reportOnlyRows]);
      }
      count = Number(result.count ?? rows.length);
    }

    const ids = rows.map((row: any) => row.musteri_id).filter(Boolean);
    const kunyeMap = new Map<string, any>();

    if (ids.length > 0) {
      const { data: kunyeler, error: kunyeErr } = await admin
        .from('v_musteri_kunye_status')
        .select('*')
        .in('musteri_id', ids);

      if (!kunyeErr || !/relation .* does not exist/i.test(kunyeErr.message)) {
        (kunyeler ?? []).forEach((item: any) => kunyeMap.set(item.musteri_id, item));
      }
    }

    let enriched = rows.map((row: any) => {
      if (isReportOnlyCustomer(row)) {
        return {
          ...row,
          report_only: true,
          kasa_firmasi: null,
          kunye_missing_fields: [],
          kunye_durumu: 'Kapsam Dışı',
          kunye_eksik_sayisi: 0,
          kunye_completion_pct: null,
        };
      }

      const rawKunye = kunyeMap.get(row.musteri_id) ?? null;
      const kunye = mapKunyeDbToUi(rawKunye);
      const status = getKunyeStatus({ ...kunye, ...(rawKunye ?? {}), firma_adi: row.musteri, has_kunye_record: Boolean(kunye) });
      return {
        ...row,
        kasa_firmasi: kunye?.kasapos_firmasi ?? null,
        kunye_missing_fields: status.missingFields,
        kunye_durumu: status.status,
        kunye_eksik_sayisi: status.missing,
        kunye_completion_pct: status.completionPct ?? null,
      };
    });

    if (q) {
      const needle = normalizeSearchText(q);
      enriched = enriched.filter((row: any) => {
        return [
          row.musteri,
          row.sektor,
          row.sorumlu,
          row.aktif_faz_adi,
          row.entegrasyon_tipi,
          row.kasa_firmasi,
          row.kunye_durumu,
          phaseSearchText(row.aktif_faz_no, row.aktif_faz_adi),
        ].some((value) => normalizeSearchText(value).includes(needle));
      });
    }

    if (integration) {
      const integrationNeedle = normalizeSearchText(integration);
      enriched = enriched.filter((row: any) => normalizeSearchText(row.entegrasyon_tipi).includes(integrationNeedle));
    }

    if (kasaFirmasi) {
      const kasaNeedle = normalizeSearchText(kasaFirmasi);
      enriched = enriched.filter((row: any) => normalizeSearchText(row.kasa_firmasi).includes(kasaNeedle));
    }

    if (kunyeStatus) {
      const kunyeNeedle = normalizeSearchText(kunyeStatus);
      enriched = enriched.filter((row: any) => normalizeSearchText(row.kunye_durumu).includes(kunyeNeedle));
    }

    const filteredTotal = shouldReturnAllLiteRows ? enriched.length : Number(count ?? enriched.length);
    const shouldBypassPaginationForFullLite = lite && includeAll;
    const pagedRows = shouldBypassPaginationForFullLite
      ? enriched
      : (shouldReturnAllLiteRows ? enriched.slice(from, to) : enriched);
    const rowsWithLastStayedPhase = await appendLastStayedPhase(pagedRows);

    return NextResponse.json({ rows: rowsWithLastStayedPhase, total: filteredTotal || (count ?? 0), page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
