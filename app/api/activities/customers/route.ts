import { NextResponse } from 'next/server';
import { requireActivityReadOrThrow, userHasPermission } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { appendLastStayedPhase } from '@/lib/crm-phase-history';

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
    const me = await requireActivityReadOrThrow();
    const admin = createPgAdminClient();
    const url = new URL(req.url);
    const qRaw = String(url.searchParams.get('q') ?? '').trim();
    const q = normalizeSearchText(qRaw);
    const selectedId = String(url.searchParams.get('id') ?? '').trim();
    const includeAll = url.searchParams.get('all') === '1';
    const canReadAny = userHasPermission(me, 'activity.read.any');
    const ownCustomerResult = canReadAny
      ? { data: null as any[] | null, error: null as any }
      : await admin.from('musteriler').select('id').eq('owner_user_id', me.id).limit(5000);
    if (ownCustomerResult.error) return NextResponse.json({ message: ownCustomerResult.error.message }, { status: 500 });
    const ownCustomerIds = canReadAny
      ? null
      : (ownCustomerResult.data ?? []).map((row: any) => String(row.id ?? '')).filter(Boolean);
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
    if (ownCustomerIds) crmQuery = crmQuery.in('musteri_id', ownCustomerIds.length ? ownCustomerIds : ['__none__']);
    crmQuery = applySearch(crmQuery);

    const [{ data: crmRows, error: crmErr }, selectedResult] = await Promise.all([
      crmQuery,
      selectedId
        ? (canReadAny
          ? admin.from('musteriler').select('id,musteri,sorumlu,sektor,customer_type,pipeline_policy').eq('id', selectedId).maybeSingle()
          : admin.from('musteriler').select('id,musteri,sorumlu,sektor,customer_type,pipeline_policy').eq('id', selectedId).eq('owner_user_id', me.id).maybeSingle())
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (crmErr) return NextResponse.json({ message: crmErr.message }, { status: 500 });

    const selectedRow = (selectedResult as any)?.data ?? null;
    const customerIds = Array.from(new Set([
      ...(crmRows ?? []).map((row: any) => String(row.musteri_id ?? '')).filter(Boolean),
      ...(selectedRow?.id ? [String(selectedRow.id)] : []),
    ]));
    const policyResult = customerIds.length
      ? await admin.from('musteriler').select('id,customer_type,pipeline_policy').in('id', customerIds)
      : { data: [] as any[], error: null as any };
    if (policyResult.error) return NextResponse.json({ message: policyResult.error.message }, { status: 500 });
    const policyById = new Map((policyResult.data ?? []).map((row: any) => [String(row.id), row]));

    const byId = new Map<string, ActivityCustomerRow>();

    (crmRows ?? []).forEach((row: any) => {
      const id = String(row.musteri_id ?? '').trim();
      if (!id) return;
      const policy = policyById.get(id) as any;
      byId.set(id, {
        musteri_id: id,
        musteri: String(row.musteri ?? '').trim(),
        sorumlu: row.sorumlu ?? null,
        sektor: row.sektor ?? null,
        aktif_faz_no: row.aktif_faz_no != null ? Number(row.aktif_faz_no) : null,
        aktif_faz_adi: row.aktif_faz_adi ?? null,
        report_only: String(policy?.pipeline_policy ?? 'phase_required') === 'phase_optional',
        is_business_partner: String(policy?.customer_type ?? 'standard') === 'business_partner',
      });
    });

    if (selectedRow) {
      [selectedRow].forEach((row: any) => {
        const id = String(row.id ?? '').trim();
        if (!id) return;
        const existing = byId.get(id);
        const rowPolicy = policyById.get(id) as any;
        const rowPhaseOptional = String(rowPolicy?.pipeline_policy ?? row.pipeline_policy ?? 'phase_required') === 'phase_optional';
        const rowBusinessPartner = String(rowPolicy?.customer_type ?? row.customer_type ?? 'standard') === 'business_partner';

        if (existing) {
          byId.set(id, {
            ...existing,
            musteri: String(existing.musteri || row.musteri || '').trim(),
            sorumlu: existing.sorumlu ?? row.sorumlu ?? null,
            sektor: existing.sektor ?? row.sektor ?? null,
            report_only: rowPhaseOptional,
            is_business_partner: Boolean(existing.is_business_partner) || rowBusinessPartner,
          });
          return;
        }

        byId.set(id, {
          musteri_id: id,
          musteri: String(row.musteri ?? '').trim(),
          sorumlu: row.sorumlu ?? null,
          sektor: row.sektor ?? null,
          aktif_faz_no: null,
          aktif_faz_adi: null,
          report_only: rowPhaseOptional,
          is_business_partner: rowBusinessPartner,
          son_kalinan_faz_no: null,
          son_kalinan_faz_adi: null,
          son_kalinan_faz_durumu: null,
        });
      });
    }

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
