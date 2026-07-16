import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { DURUM_CANONICAL, activityLabelFromRow, isDisplayableActivityRow, normalizeDurum, presentDurum } from '@/app/api/activities/_helpers';
import { getSlaPresentation, matchesSlaFilter } from '@/lib/sla';
import { reportOnlyCustomerKind, isBusinessPartnerSector } from '@/lib/report-only-customers';
import { ensureBusinessPartnerPhaseTable } from '@/lib/system-parameters';


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
    const me = await requireAllowedUserOrThrow();
    const myName = (me.full_name ?? '').trim();
    if (!myName) return NextResponse.json({ message: 'Kullanıcı adı/soyadı boş.' }, { status: 400 });

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const owner = (url.searchParams.get('owner') ?? '').trim();
    const responsible = (url.searchParams.get('responsible') ?? '').trim();
    const sla = (url.searchParams.get('sla') ?? '').trim();
    const fazNoRaw = (url.searchParams.get('faz_no') ?? '').trim();
    const fazNo = fazNoRaw ? Number(fazNoRaw) : NaN;
    const durum = normalizeDurum(url.searchParams.get('durum')) ?? '';
    const partner = (url.searchParams.get('partner_owner') ?? '').trim();
    const fromDate = (url.searchParams.get('from') ?? '').trim();
    const toDate = (url.searchParams.get('to') ?? '').trim();
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const analyticsMode = (url.searchParams.get('analytics') ?? '').trim() === '1';
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), 20), analyticsMode ? 1000 : 100);
    const blockedFilter = (url.searchParams.get('blocked') ?? '').trim();

    const serverToday = getTurkeyToday();

    const admin = createPgAdminClient();

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
      ? 'id,musteri_id,faz_no,durum,aksiyon,owner,partner_owner,created_at,hedef_tarihi,created_by,is_blocked,musteriler(musteri,sektor,sorumlu)'
      : 'id,musteri_id,faz_no,iteration_no,event_type,durum,aksiyon,owner,partner_owner,notlar,created_at,hedef_tarihi,created_by,is_blocked,blocked_note,blocked_at,blocked_by,musteriler(musteri,sektor,entegrasyon_tipi,satis_olasiligi,sorumlu)';

    let query = admin
      .from('pipeline_eventleri')
      .select(baseSelect, { count: needsClientFiltering ? undefined : 'exact' })
      .order('created_at', { ascending: false });

    if (Number.isFinite(fazNo)) query = query.eq('faz_no', fazNo);
    if (partner) query = query.eq('partner_owner', partner);
    if (durum) query = query.eq('durum', durum);
    if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00`);
    if (toDate) query = query.lte('created_at', `${toDate}T23:59:59`);
    if (blockedFilter === 'blocked') query = query.eq('is_blocked', true);
    if (blockedFilter === 'unblocked') query = query.or('is_blocked.is.null,is_blocked.eq.false');

    if (owner) {
      const ownerNeedle = escapeIlike(owner);
      query = query.or(`created_by.ilike.${ownerNeedle},owner.ilike.${ownerNeedle}`);
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

    if (!needsClientFiltering) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    } else {
      query = query.limit(analyticsMode ? 1000 : 5000);
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const phaseNos = Array.from(new Set((data ?? []).map((row: any) => Number(row?.faz_no)).filter((value: number) => Number.isFinite(value))));
    const [customerPhaseResult, partnerPhaseResult] = await Promise.all([
      phaseNos.length
        ? admin.from('faz_tanimlari').select('faz_no,asama_adi,owner').in('faz_no', phaseNos)
        : Promise.resolve({ data: [] as any[] }),
      phaseNos.length
        ? ensureBusinessPartnerPhaseTable()
            .then(() => admin.from('is_ortagi_faz_tanimlari').select('faz_no,asama_adi,owner,is_active').in('faz_no', phaseNos))
            .catch(() => ({ data: [] as any[] }))
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
        const isBusinessPartner = reportOnlyCustomerKind(customer) === 'business-partner' || isBusinessPartnerSector(customer?.sektor);
        const phase = row.faz_no != null
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

    const total = needsClientFiltering ? rows.length : Number(count ?? rows.length);
    const from = (page - 1) * pageSize;
    const paged = needsClientFiltering ? rows.slice(from, from + pageSize) : rows;

    return NextResponse.json({ rows: paged, total, page, pageSize, serverToday });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
