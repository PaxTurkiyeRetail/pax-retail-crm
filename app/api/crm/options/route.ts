import { NextResponse } from 'next/server';
import { createPgServerClient } from '@/lib/pg/server';
import { createPgAdminClient } from '@/lib/pg/admin';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { HAVUZ_ACCOUNT_NAME } from '@/lib/crm';
import { BUSINESS_PARTNER_RESPONSIBLE, BUSINESS_PARTNER_SECTOR, isReportOnlyCustomer } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}

function normalizeOwnerOption(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  const key = raw.toLocaleLowerCase('tr-TR');
  return raw;
}

function uniqueOwnerSorted(values: Array<string | null | undefined>) {
  const map = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeOwnerOption(value);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase('tr-TR');
    if (!map.has(key)) map.set(key, normalized);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'tr'));
}

export async function GET() {
  try {
    const me = await requireCrmAccessOrThrow();
    const pgClient = await createPgServerClient();
    const query = pgClient
      .from('vw_crm_musteriler')
      .select('musteri_id,sektor,sorumlu,entegrasyon_tipi,aktif_faz_no')
      .order('musteri_id', { ascending: true })
      .limit(3000);

    const { data, error } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const rows = (data ?? []).filter((row: any) => !isReportOnlyCustomer(row));

    const admin = createPgAdminClient();
    const { data: reportOnlyRows } = await admin
      .from('musteriler')
      .select('sorumlu,sektor,entegrasyon_tipi')
      .or('sektor.ilike.İŞ ORTAĞI,sektor.ilike.IS ORTAGI')
      .limit(2000);
    const visibleReportOnlyRows = (reportOnlyRows ?? []).filter((row: any) => isReportOnlyCustomer(row));
    const ids = rows.map((row: any) => row.musteri_id).filter(Boolean);

    let kasaOptions: string[] = [];
    if (ids.length > 0) {
      const { data: kunyeler } = await admin
        .from('v_musteri_kunye_status')
        .select('musteri_id,kasapos_firmasi')
        .in('musteri_id', ids);

      kasaOptions = uniqueSorted((kunyeler ?? []).map((row: any) => row.kasapos_firmasi));
    }

    return NextResponse.json({
      ownerOptions: uniqueOwnerSorted([...rows.map((row: any) => row.sorumlu), ...visibleReportOnlyRows.map((row: any) => row.sorumlu), BUSINESS_PARTNER_RESPONSIBLE, HAVUZ_ACCOUNT_NAME]),
      sectorOptions: uniqueSorted([...rows.map((row: any) => row.sektor), ...visibleReportOnlyRows.map((row: any) => row.sektor), BUSINESS_PARTNER_SECTOR]),
      integrationOptions: uniqueSorted([...rows.map((row: any) => row.entegrasyon_tipi), ...visibleReportOnlyRows.map((row: any) => row.entegrasyon_tipi)]),
      kasaOptions,
      phaseOptions: uniqueSorted(rows.map((row: any) => row.aktif_faz_no != null ? `FAZ ${row.aktif_faz_no}` : '')),
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
