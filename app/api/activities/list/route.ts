import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { activityLabelFromRow, isDisplayableActivityRow, presentDurum } from '@/app/api/activities/_helpers';
import { matchesSlaFilter } from '@/lib/sla';

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
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
    const durum = (url.searchParams.get('durum') ?? '').trim();
    const partner = (url.searchParams.get('partner_owner') ?? '').trim();
    const fromDate = (url.searchParams.get('from') ?? '').trim();
    const toDate = (url.searchParams.get('to') ?? '').trim();
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), 20), 100);
    const hasHeavyFiltering = Boolean(q || owner || responsible || partner || durum || sla || fromDate || toDate || Number.isFinite(fazNo));
    const fetchLimit = hasHeavyFiltering ? Math.max(page * pageSize * 5, 400) : pageSize;

    const admin = createSupabaseAdminClient();
    let query = admin
      .from('pipeline_eventleri')
      .select('id,musteri_id,faz_no,iteration_no,event_type,durum,aksiyon,owner,partner_owner,notlar,created_at,hedef_tarihi,created_by,musteriler(musteri,sektor,entegrasyon_tipi,satis_olasiligi,sorumlu)')
      .order('created_at', { ascending: false })
      .limit(fetchLimit);

    if (Number.isFinite(fazNo)) query = query.eq('faz_no', fazNo);
    if (partner) query = query.eq('partner_owner', partner);
    if (durum) query = query.eq('durum', durum);
    if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00`);
    if (toDate) query = query.lte('created_at', `${toDate}T23:59:59`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    let rows = (data ?? [])
      .filter((row: any) => isDisplayableActivityRow(row))
      .map((row: any) => ({
        ...row,
        due_date: row.hedef_tarihi ?? null,
        activity_label: activityLabelFromRow(row),
        activity_status: presentDurum(row.durum),
        owner: row.created_by ?? row.owner ?? null,
      }));

    if (owner) {
      const normalizedOwner = owner.toLocaleLowerCase('tr');
      rows = rows.filter((row: any) => {
        const createdBy = String(row.created_by ?? '').toLocaleLowerCase('tr');
        const rowOwner = String(row.owner ?? '').toLocaleLowerCase('tr');
        return createdBy === normalizedOwner || rowOwner === normalizedOwner;
      });
    }

    if (responsible) {
      const normalizedResponsible = responsible.toLocaleLowerCase('tr');
      rows = rows.filter((row: any) => String(row?.musteriler?.sorumlu ?? '').toLocaleLowerCase('tr') === normalizedResponsible);
    }

    if (q) {
      const needle = q.toLocaleLowerCase('tr');
      rows = rows.filter((row: any) => {
        const customerName = String(row?.musteriler?.musteri ?? '').toLocaleLowerCase('tr');
        return customerName.includes(needle)
          || String(row?.activity_label ?? '').toLocaleLowerCase('tr').includes(needle)
          || String(row?.notlar ?? '').toLocaleLowerCase('tr').includes(needle)
          || String(row?.owner ?? '').toLocaleLowerCase('tr').includes(needle)
          || String(row?.activity_status ?? '').toLocaleLowerCase('tr').includes(needle)
          || String(row?.musteriler?.sorumlu ?? '').toLocaleLowerCase('tr').includes(needle);
      });
    }

    rows = rows.filter((row: any) => matchesSlaFilter(sla, row.due_date, row.activity_status));

    const total = rows.length;
    const from = (page - 1) * pageSize;
    const paged = rows.slice(from, from + pageSize);

    return NextResponse.json({ rows: paged, total, page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
