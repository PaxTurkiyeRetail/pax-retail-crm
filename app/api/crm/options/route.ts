import { NextResponse } from 'next/server';
import { createPgServerClient } from '@/lib/pg/server';
import { createPgAdminClient } from '@/lib/pg/admin';
import { requireCrmAccessOrThrow, userHasPermission } from '@/lib/authz';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';
import { getCrmMasterDataOptions, getSystemParameterValue } from '@/lib/system-parameters';

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
    const admin = createPgAdminClient();
    const canReadAny = userHasPermission(me, 'customer.read.any');
    const visibleCustomerResult = canReadAny
      ? { data: null as any[] | null, error: null as any }
      : await admin.from('musteriler').select('id').eq('owner_user_id', me.id).limit(10000);
    if (visibleCustomerResult.error) return NextResponse.json({ message: visibleCustomerResult.error.message }, { status: 500 });
    const visibleCustomerIds = canReadAny ? null : (visibleCustomerResult.data ?? []).map((row: any) => String(row.id ?? '')).filter(Boolean);
    let query = pgClient
      .from('vw_crm_musteriler')
      .select('musteri_id,sektor,sorumlu,entegrasyon_tipi,aktif_faz_no')
      .order('musteri_id', { ascending: true })
      .limit(3000);
    if (visibleCustomerIds) query = query.in('musteri_id', visibleCustomerIds.length ? visibleCustomerIds : ['__none__']);

    const [{ data, error }, masterData, defaultPageSizeRaw] = await Promise.all([
      query,
      getCrmMasterDataOptions(),
      getSystemParameterValue('system_page_size', '25'),
    ]);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const rows = (data ?? []).filter((row: any) => !isReportOnlyCustomer(row));
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
      ownerOptions: uniqueOwnerSorted(rows.map((row: any) => row.sorumlu)),
      sectorOptions: uniqueSorted(rows.map((row: any) => row.sektor)),
      integrationOptions: uniqueSorted(rows.map((row: any) => row.entegrasyon_tipi)),
      kasaOptions,
      phaseOptions: uniqueSorted(rows.map((row: any) => row.aktif_faz_no != null ? `FAZ ${row.aktif_faz_no}` : '')),
      sectorCatalogOptions: masterData.crm_sector ?? [],
      integrationCatalogOptions: masterData.crm_integration_type ?? [],
      salesProbabilityOptions: masterData.crm_sales_probability ?? [],
      customerTypeOptions: masterData.crm_customer_type ?? [],
      pipelinePolicyOptions: masterData.crm_pipeline_policy ?? [],
      defaultPageSize: Math.min(100, Math.max(10, Number(defaultPageSizeRaw) || 25)),
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
