import { NextResponse } from 'next/server';
import { getUserDepartments, requireActivityReadOrThrow, userHasPermission } from '@/lib/authz';
import { resolveDepartmentFilter } from '@/lib/departments';
import { parsePhaseRange } from '@/lib/filters/sql';
import { fetchAllRows } from '@/lib/reporting';
import { createPgAdminClient } from '@/lib/pg/admin';
import { DURUM_CANONICAL, activityLabelFromRow, isDisplayableActivityRow, normalizeDurum, presentDurum } from '@/lib/activities/presentation';
import { getSlaPresentation, matchesSlaFilter } from '@/lib/sla';
import { reportOnlyCustomerKind } from '@/lib/report-only-customers';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getTurkeyToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function escapeIlike(value: string) {
  return String(value ?? '').replace(/[\%_]/g, ' ').trim();
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export async function GET(req: Request) {
  try {
    const me = await requireActivityReadOrThrow();
    const myName = (me.full_name ?? '').trim();
    if (!myName) return NextResponse.json({ message: 'Kullanıcı adı/soyadı boş.' }, { status: 400 });

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const owner = (url.searchParams.get('owner') ?? '').trim();
    // Satıcı: kullanıcı id (created_by_user_id); owner (ad) ile birlikte gelirse OR'lanır.
    const ownerIdRaw = (url.searchParams.get('owner_id') ?? '').trim();
    const ownerId = /^[A-Za-z0-9_-]{1,64}$/.test(ownerIdRaw) ? ownerIdRaw : '';
    const responsible = (url.searchParams.get('responsible') ?? '').trim();
    const sla = (url.searchParams.get('sla') ?? '').trim();
    const fazNoRaw = (url.searchParams.get('faz_no') ?? '').trim();
    // faz_no: '7' tek faz ya da '1-4' aralık.
    const fazRange = parsePhaseRange(fazNoRaw);
    const durum = normalizeDurum(url.searchParams.get('durum')) ?? '';
    const partner = (url.searchParams.get('partner_owner') ?? '').trim();
    const fromDate = (url.searchParams.get('from') ?? '').trim();
    const toDate = (url.searchParams.get('to') ?? '').trim();
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const analyticsMode = (url.searchParams.get('analytics') ?? '').trim() === '1';
    // analytics=1: KPI'lar filtrelenmiş kümenin tamamından (sayfalama/1000 sınırı yok).
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), 20), analyticsMode ? 1000 : 100);
    const blockedFilter = (url.searchParams.get('blocked') ?? '').trim();

    const serverToday = getTurkeyToday();

    const admin = createPgAdminClient();

    // Departman: müşterinin iş kolu (musteriler.is_kolu), kullanıcının departman kapsamıyla.
    let departmentCustomerIds: string[] | null = null;
    const deptFilter = resolveDepartmentFilter(url.searchParams.get('department'), await getUserDepartments(me));
    if (deptFilter) {
      const { data: deptRows, error: deptError } = await admin.from('musteriler').select('id').in('is_kolu', deptFilter).limit(20000);
      if (deptError) return NextResponse.json({ message: deptError.message }, { status: 500 });
      // Kullanıcının sorumlu olduğu firmalar iş kolundan bağımsız kapsamda: kendi müşterisine girdiği aktiviteyi görmeli.
      const ownNeedles = [myName, me.email, String(me.email ?? '').split('@')[0]].map((v) => escapeIlike(String(v ?? ''))).filter((v) => v && !/[,()]/.test(v));
      const { data: ownRows, error: ownError } = ownNeedles.length
        ? await admin.from('musteriler').select('id').or(ownNeedles.map((v) => `sorumlu.ilike.${v}`).join(',')).limit(5000)
        : { data: [] as any[], error: null };
      if (ownError) return NextResponse.json({ message: ownError.message }, { status: 500 });
      const ids = Array.from(new Set([...(deptRows ?? []), ...(ownRows ?? [])].map((row: any) => String(row.id ?? '').trim()).filter(Boolean)));
      if (!ids.length) return NextResponse.json({ rows: [], total: 0, page, pageSize, serverToday });
      departmentCustomerIds = ids;
    }
    const scopedCustomerIds = departmentCustomerIds;

    let matchedCustomerIds: string[] | null = null;
    if (q || responsible) {
      let customerQuery = admin.from('musteriler').select('id').limit(1000);
      if (responsible) customerQuery = customerQuery.ilike('sorumlu', escapeIlike(responsible));
      if (q) {
        const needle = escapeIlike(q);
        if (needle) {
          const like = `%${needle}%`;
          customerQuery = customerQuery.or([
            `musteri.ilike.${like}`,
            `sorumlu.ilike.${like}`,
            `sektor.ilike.${like}`,
          ].join(','));
        }
      }
      const { data: matchedCustomers, error: customerSearchError } = await customerQuery;
      if (customerSearchError) return NextResponse.json({ message: customerSearchError.message }, { status: 500 });
      matchedCustomerIds = Array.from(new Set((matchedCustomers ?? []).map((row: any) => String(row.id ?? '').trim()).filter(Boolean)));
      if (responsible && matchedCustomerIds.length === 0) {
        return NextResponse.json({ rows: [], total: 0, page, pageSize, serverToday });
      }
    }

    const needsClientFiltering = Boolean(sla);
    const baseSelect = analyticsMode
      ? 'id,musteri_id,faz_no,durum,aksiyon,owner,partner_owner,created_at,hedef_tarihi,created_by,is_blocked,activity_scope,activity_context,musteriler(musteri,sektor,sorumlu,customer_type)'
      : 'id,musteri_id,faz_no,iteration_no,event_type,durum,aksiyon,owner,partner_owner,notlar,created_at,hedef_tarihi,created_by,is_blocked,blocked_note,blocked_at,blocked_by,activity_scope,activity_context,musteriler(musteri,sektor,entegrasyon_tipi,satis_olasiligi,sorumlu,customer_type)';

    const buildQuery = (withCount: boolean) => {
      let query = admin
        .from('pipeline_eventleri')
        .select(baseSelect, { count: withCount ? 'exact' : undefined })
        .order('created_at', { ascending: false });

      if (!userHasPermission(me, 'activity.read.any')) {
        query = query.or(`created_by_user_id.eq.${me.id},created_by_email.ilike.${escapeIlike(me.email)}`);
      }

      if (fazRange) {
        query = fazRange.min === fazRange.max
          ? query.eq('faz_no', fazRange.min)
          : query.gte('faz_no', fazRange.min).lte('faz_no', fazRange.max);
      }
      if (scopedCustomerIds) query = query.in('musteri_id', scopedCustomerIds);
      if (partner) query = query.eq('partner_owner', partner);
      if (durum) query = query.eq('durum', durum);
      query = query.activityDateRange(fromDate, toDate);
      if (blockedFilter === 'blocked') query = query.eq('is_blocked', true);
      if (blockedFilter === 'unblocked') query = query.or('is_blocked.is.null,is_blocked.eq.false');

      if (ownerId || owner) {
        const ownerNeedle = escapeIlike(owner);
        const ownerParts = [
          ownerId ? `created_by_user_id.eq.${ownerId}` : '',
          // id seçiliyse ad yalnız hesabı bağlanmamış eski kayıtlar için (created_by).
          ownerNeedle && !/[,()]/.test(ownerNeedle) ? `created_by.ilike.${ownerNeedle}` : '',
          ownerNeedle && !ownerId && !/[,()]/.test(ownerNeedle) ? `owner.ilike.${ownerNeedle}` : '',
        ].filter(Boolean);
        if (ownerParts.length) query = query.or(ownerParts.join(','));
      }

      if (responsible && matchedCustomerIds) {
        query = query.in('musteri_id', matchedCustomerIds);
      }

      if (q) {
        const needle = escapeIlike(q);
        if (needle) {
          const like = `%${needle}%`;
          const activityOrParts = [
            `aksiyon.ilike.${like}`,
            `notlar.ilike.${like}`,
            `owner.ilike.${like}`,
            `created_by.ilike.${like}`,
            `partner_owner.ilike.${like}`,
          ];
          const canonicalDurumForSearch = normalizeDurum(needle);
          if (canonicalDurumForSearch && Object.values(DURUM_CANONICAL).includes(canonicalDurumForSearch)) {
            activityOrParts.push(`durum.eq.${canonicalDurumForSearch}`);
          }
          if (matchedCustomerIds?.length) {
            for (const chunk of chunkArray(matchedCustomerIds, 80)) {
              activityOrParts.push(`musteri_id.in.(${chunk.join(',')})`);
            }
          }
          query = query.or(activityOrParts.join(','));
        }
      }
      return query;
    };

    let data: any[] | null = null;
    let count: number | null = null;
    if (analyticsMode) {
      // Tüm filtrelenmiş küme (1000'lik partiler) — KPI'lar ilk sayfadan değil.
      data = await fetchAllRows<any>((from, to) => buildQuery(false).range(from, to));
    } else if (needsClientFiltering) {
      const result = await buildQuery(false).limit(5000);
      if (result.error) return NextResponse.json({ message: result.error.message }, { status: 500 });
      data = result.data ?? [];
    } else {
      const from = (page - 1) * pageSize;
      const result = await buildQuery(true).range(from, from + pageSize - 1);
      if (result.error) return NextResponse.json({ message: result.error.message }, { status: 500 });
      data = result.data ?? [];
      count = result.count ?? null;
    }

    const phaseNos = Array.from(new Set((data ?? []).map((row: any) => Number(row?.faz_no)).filter((value: number) => Number.isFinite(value))));
    const [customerPhaseResult, partnerPhaseResult] = await Promise.all([
      phaseNos.length
        ? admin.from('faz_tanimlari').select('faz_no,asama_adi,owner').in('faz_no', phaseNos)
        : Promise.resolve({ data: [] as any[] }),
      phaseNos.length
        ? admin.from('is_ortagi_faz_tanimlari').select('faz_no,asama_adi,owner,is_active').in('faz_no', phaseNos)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const customerPhaseMap = new Map((customerPhaseResult.data ?? []).map((phase: any) => [Number(phase.faz_no), phase]));
    const partnerPhaseMap = new Map((partnerPhaseResult.data ?? []).map((phase: any) => [Number(phase.faz_no), phase]));

    let rows = (data ?? [])
      .filter((row: any) => isDisplayableActivityRow(row))
      .map((row: any) => {
        const dueDate = row.hedef_tarihi ?? null;
        const activityStatus = presentDurum(row.durum);
        const customer = row?.musteriler ?? null;
        const isBusinessPartner = row.activity_context === 'business_partner' || (!row.activity_context && reportOnlyCustomerKind(customer) === 'business-partner');
        const phase: any = row.faz_no != null
          ? (isBusinessPartner ? partnerPhaseMap.get(Number(row.faz_no)) : customerPhaseMap.get(Number(row.faz_no)))
          : null;
        const phaseOwner = String(phase?.owner ?? row.owner ?? '').trim() || null;
        const waitingOwner = String(row.partner_owner ?? phaseOwner ?? '').trim() || null;
        const createdBy = String(row.created_by ?? '').trim() || null;
        return {
          ...row,
          is_business_partner: isBusinessPartner,
          due_date: dueDate,
          phase_title: String(phase?.asama_adi ?? '').trim() || null,
          phase_owner: phaseOwner,
          activity_label: activityLabelFromRow(row),
          activity_status: activityStatus,
          created_by_display: createdBy,
          owner: createdBy ?? row.owner ?? null,
          partner_owner: waitingOwner,
          is_blocked: Boolean(row.is_blocked),
          blocked_note: row.blocked_note ?? null,
          blocked_at: row.blocked_at ?? null,
          blocked_by: row.blocked_by ?? null,
          next_activity_label: null,
          next_activity_due_date: null,
          sla_presentation: getSlaPresentation(dueDate, activityStatus, serverToday),
        };
      });

    rows = rows.filter((row: any) => matchesSlaFilter(sla, row.due_date, row.activity_status));

    if (analyticsMode) return NextResponse.json({ rows, total: rows.length, page: 1, pageSize: rows.length, serverToday });

    const total = needsClientFiltering ? rows.length : Number(count ?? rows.length);
    const from = (page - 1) * pageSize;
    const paged = needsClientFiltering ? rows.slice(from, from + pageSize) : rows;

    return NextResponse.json({ rows: paged, total, page, pageSize, serverToday });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
