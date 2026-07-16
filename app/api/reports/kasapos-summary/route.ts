import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getKunyeStatus, mapKunyeDbToUi } from '@/lib/kunye';
import { fetchAllByCustomerIds, fetchAllRows } from '@/lib/reporting';
import { getCustomerPhaseMeta } from '@/lib/customer-phase';
import { appendLastStayedPhase } from '@/lib/crm-phase-history';
import { formatMoney, isMissingRelationError } from '@/lib/quotes/service';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type BaseCustomerRow = {
  musteri_id: string | null;
  musteri: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  sorumlu: string | null;
  sektor: string | null;
};

type QuoteItemRow = {
  id: string;
  product_name_snapshot: string | null;
  product_code_snapshot: string | null;
  product_type: string | null;
  category: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  is_recurring: boolean | null;
};

type QuoteSummary = {
  id: string;
  quote_no: string;
  status: string;
  probability: number;
  total_device_count: number;
  total_amount: number;
  formatted_total_amount: string;
  valid_until: string | null;
  follow_up_date: string | null;
  owner_name: string;
  opportunity_title: string;
  items: Array<QuoteItemRow & { formatted_unit_price: string; formatted_total_price: string }>;
};

type ReportRow = {
  musteri_id: string;
  firma_adi: string;
  kasapos_firmasi: string;
  faz_no: number | null;
  faz_adi: string | null;
  faz_display: string;
  faz_durumu: string;
  faz_grubu: string;
  sabit_bilgisayar_markasi: string;
  pos_modeli: string;
  pos_markasi: string;
  magaza_sayisi: string;
  toplam_pos_adedi: string;
  toplam_pos_adedi_numeric: number | null;
  has_quote: boolean;
  quote_count: number;
  latest_quote: QuoteSummary | null;
};

function normalizeText(value: unknown, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}

function parseNumericValue(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPhaseDisplay(phaseNo: number | null, phaseName: string | null) {
  if (phaseNo == null) return 'Faz girilmemiş';
  const cleanName = String(phaseName ?? '').trim();
  return cleanName ? `FAZ ${phaseNo} · ${cleanName}` : `FAZ ${phaseNo}`;
}

async function loadLatestQuotesByCustomer(admin: ReturnType<typeof createPgAdminClient>, customerIds: string[]) {
  const empty = new Map<string, { quoteCount: number; latestQuote: QuoteSummary | null }>();
  if (!customerIds.length) return empty;

  try {
    const { data: quotes, error } = await admin
      .from('quotes')
      .select('id,customer_id,quote_no,status,probability,total_device_count,total_amount,valid_until,follow_up_date,owner_name,opportunity_title,created_at,proposal_date')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const quoteRows = quotes ?? [];
    if (!quoteRows.length) return empty;

    const quoteIds = quoteRows.map((row: any) => String(row.id ?? '').trim()).filter(Boolean);
    const { data: items, error: itemsError } = await admin
      .from('quote_items')
      .select('id,quote_id,product_name_snapshot,product_code_snapshot,product_type,category,quantity,unit_price,total_price,is_recurring,line_no')
      .in('quote_id', quoteIds)
      .order('line_no', { ascending: true });

    if (itemsError) throw itemsError;

    const itemsByQuote = new Map<string, QuoteItemRow[]>();
    (items ?? []).forEach((item: any) => {
      const key = String(item.quote_id ?? '').trim();
      if (!key) return;
      const list = itemsByQuote.get(key) ?? [];
      list.push(item as QuoteItemRow);
      itemsByQuote.set(key, list);
    });

    const grouped = new Map<string, any[]>();
    for (const row of quoteRows) {
      const key = String((row as any).customer_id ?? '').trim();
      if (!key) continue;
      const list = grouped.get(key) ?? [];
      list.push(row);
      grouped.set(key, list);
    }

    for (const customerId of customerIds) {
      const rows = grouped.get(customerId) ?? [];
      const latest = rows[0] ?? null;
      empty.set(customerId, {
        quoteCount: rows.length,
        latestQuote: latest
          ? {
              id: String((latest as any).id ?? ''),
              quote_no: normalizeText((latest as any).quote_no),
              status: normalizeText((latest as any).status),
              probability: Number((latest as any).probability ?? 0) || 0,
              total_device_count: Number((latest as any).total_device_count ?? 0) || 0,
              total_amount: Number((latest as any).total_amount ?? 0) || 0,
              formatted_total_amount: formatMoney(Number((latest as any).total_amount ?? 0)),
              valid_until: String((latest as any).valid_until ?? '').trim() || null,
              follow_up_date: String((latest as any).follow_up_date ?? '').trim() || null,
              owner_name: normalizeText((latest as any).owner_name),
              opportunity_title: normalizeText((latest as any).opportunity_title, '-'),
              items: (itemsByQuote.get(String((latest as any).id ?? '').trim()) ?? []).map((item) => ({
                ...item,
                formatted_unit_price: formatMoney(Number(item.unit_price ?? 0)),
                formatted_total_price: formatMoney(Number(item.total_price ?? 0)),
              })),
            }
          : null,
      });
    }

    return empty;
  } catch (error) {
    if (isMissingRelationError(error)) return empty;
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const admin = createPgAdminClient();
    const url = new URL(request.url);

    const selectedKasapos = String(url.searchParams.get('kasapos') ?? '').trim();

    const customers = await fetchAllRows<BaseCustomerRow>((from, to) => {
      return admin
        .from('vw_crm_musteriler')
        .select('musteri_id,musteri,aktif_faz_no,aktif_faz_adi,sorumlu,sektor')
        .order('musteri', { ascending: true })
        .range(from, to);
    });

    const baseRowsRaw = (customers ?? [])
      .filter((row: any) => !isReportOnlyCustomer(row))
      .map((row) => ({
        musteri_id: String(row.musteri_id ?? '').trim(),
        musteri: normalizeText(row.musteri),
        aktif_faz_no: row.aktif_faz_no == null ? null : Number(row.aktif_faz_no),
        aktif_faz_adi: String(row.aktif_faz_adi ?? '').trim() || null,
        sorumlu: String((row as any).sorumlu ?? '').trim() || null,
        sektor: String((row as any).sektor ?? '').trim() || null,
      }))
      .filter((row): row is { musteri_id: string; musteri: string; aktif_faz_no: number | null; aktif_faz_adi: string | null; sorumlu: string | null; sektor: string | null } => Boolean(row.musteri_id));

    const baseRows = await appendLastStayedPhase(baseRowsRaw);

    const ids = baseRows.map((row) => row.musteri_id).filter(Boolean);
    const kunyeMap = new Map<string, any>();

    if (ids.length > 0) {
      let kunyeler: any[] = [];
      try {
        kunyeler = await fetchAllByCustomerIds<any>(admin, 'v_musteri_kunye_status', '*', ids);
      } catch (error) {
        if (!isMissingRelationError(error)) throw error;
        kunyeler = await fetchAllByCustomerIds<any>(admin, 'musteri_kunye', '*', ids);
      }

      for (const row of kunyeler) {
        const key = String((row as any).musteri_id ?? '').trim();
        if (key) kunyeMap.set(key, row);
      }
    }

    const quoteMeta = await loadLatestQuotesByCustomer(admin, ids);

    const allRows: ReportRow[] = baseRows
      .map((row) => {
        const rawKunye = kunyeMap.get(row.musteri_id) ?? null;
        const kunye = mapKunyeDbToUi(rawKunye);
        const kunyeStatus = getKunyeStatus({
          ...kunye,
          ...(rawKunye ?? {}),
          firma_adi: row.musteri,
          has_kunye_record: Boolean(kunye),
        });
        if (kunyeStatus.status !== 'Var') return null;

        const fazMeta = row.aktif_faz_no != null ? getCustomerPhaseMeta(row.aktif_faz_no) : null;
        const totalPosNumeric = parseNumericValue(kunye?.toplam_pos_adedi);
        const quoteInfo = quoteMeta.get(row.musteri_id) ?? { quoteCount: 0, latestQuote: null };

        return {
          musteri_id: row.musteri_id,
          firma_adi: normalizeText(kunye?.firma_adi, row.musteri),
          kasapos_firmasi: normalizeText(kunye?.kasapos_firmasi),
          faz_no: row.aktif_faz_no,
          faz_adi: row.aktif_faz_adi,
          faz_display: formatPhaseDisplay(row.aktif_faz_no, row.aktif_faz_adi),
          faz_durumu: normalizeText(row.son_kalinan_faz_durumu),
          faz_grubu: fazMeta?.groupLabel ?? '-',
          sabit_bilgisayar_markasi: normalizeText(kunye?.sabit_bilgisayar_markasi),
          pos_modeli: normalizeText(kunye?.pos_modeli),
          pos_markasi: normalizeText(kunye?.pos_markasi),
          magaza_sayisi: normalizeText(kunye?.magaza_sayisi),
          toplam_pos_adedi: normalizeText(kunye?.toplam_pos_adedi),
          toplam_pos_adedi_numeric: totalPosNumeric,
          has_quote: quoteInfo.quoteCount > 0,
          quote_count: quoteInfo.quoteCount,
          latest_quote: quoteInfo.latestQuote,
        } satisfies ReportRow;
      })
      .filter((row): row is ReportRow => Boolean(row));

    const kasaposOptions = ['Tüm Kasapos Firmaları', ...uniqueSorted(allRows.map((row) => row.kasapos_firmasi).filter((value) => value !== '-'))];
    const effectiveKasapos = selectedKasapos && selectedKasapos !== 'Tüm Kasapos Firmaları' ? selectedKasapos : '';
    const rows = effectiveKasapos ? allRows.filter((row) => row.kasapos_firmasi === effectiveKasapos) : allRows;

    const numericPosRows = rows.filter((row) => row.toplam_pos_adedi_numeric != null);
    const totalPos = numericPosRows.reduce((sum, row) => sum + (row.toplam_pos_adedi_numeric ?? 0), 0);

    return NextResponse.json({
      kasaposOptions,
      selectedKasapos: effectiveKasapos,
      rows,
      totals: {
        totalCompanies: rows.length,
        totalPos,
        numericPosCoverage: rows.length ? Math.round((numericPosRows.length / rows.length) * 100) : 0,
        uniqueKasaposCount: new Set(rows.map((row) => row.kasapos_firmasi).filter((value) => value !== '-')).size,
        withStoreCount: rows.filter((row) => row.magaza_sayisi !== '-').length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yetkisiz' }, { status: error?.status || 401 });
  }
}
