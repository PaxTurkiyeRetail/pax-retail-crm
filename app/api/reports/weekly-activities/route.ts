import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { activityLabelFromRow, normalizeDurum, presentDurum } from '@/app/api/activities/_helpers';
import { normalizeChannel, isSalesChannel, isTechnicalChannel } from '@/lib/activity-channels';
import { fetchAllRows, formatIstanbulDayKey, inclusiveDayCount } from '@/lib/reporting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}

export async function GET(req: Request) {
  try {
    await requireReportsAccessOrThrow();
    const url = new URL(req.url);
    const from = String(url.searchParams.get('from') ?? '').trim() || toDateInput(startOfWeek(new Date()));
    const to = String(url.searchParams.get('to') ?? '').trim() || toDateInput(endOfWeek(new Date()));
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const responsible = String(url.searchParams.get('responsible') ?? '').trim();
    const customer = String(url.searchParams.get('customer') ?? '').trim();
    const channel = String(url.searchParams.get('channel') ?? '').trim();
    const phase = String(url.searchParams.get('phase') ?? '').trim();
    const waiting = String(url.searchParams.get('waiting') ?? '').trim();
    const status = normalizeDurum(url.searchParams.get('status')) ?? '';
    const daySpan = inclusiveDayCount(from, to);

    const admin = createPgAdminClient();
    let data = await fetchAllRows<any>((rangeFrom, rangeTo) => {
      let query = admin
        .from('pipeline_eventleri')
        .select('id,musteri_id,faz_no,durum,aksiyon,owner,partner_owner,notlar,created_at,created_by,musteriler(musteri,sorumlu,sektor,entegrasyon_tipi)')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .order('created_at', { ascending: false })
        .range(rangeFrom, rangeTo);

      if (phase) query = query.eq('faz_no', Number(phase));
      if (waiting) query = query.eq('partner_owner', waiting);
      if (status) query = query.eq('durum', status);
      return query;
    });

    let rows = (data ?? [])
      .filter((row: any) => {
        const rawAction = String(row?.aksiyon ?? '').trim();
        const normalizedStatus = normalizeDurum(row?.durum);
        return rawAction.startsWith('AKTIVITE:');
      })
      .map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        created_by: String(row.created_by ?? row.owner ?? '').trim() || '-',
        responsible: String(row?.musteriler?.sorumlu ?? '').trim() || '-',
        customer: String(row?.musteriler?.musteri ?? '').trim() || '-',
        sector: String(row?.musteriler?.sektor ?? '').trim() || '-',
        integration: String(row?.musteriler?.entegrasyon_tipi ?? '').trim() || '-',
        phase: row.faz_no != null ? `FAZ ${row.faz_no}` : '-',
        phase_no: row.faz_no ?? null,
        waiting: String(row.partner_owner ?? '').trim() || '-',
        status: presentDurum(row.durum) ?? '-',
        channel: normalizeChannel(activityLabelFromRow(row)),
        notes: String(row.notlar ?? '').trim(),
      }));

    if (owner) rows = rows.filter((row) => row.created_by === owner);
    if (responsible) rows = rows.filter((row) => row.responsible === responsible);
    if (customer) rows = rows.filter((row) => row.customer === customer);
    if (channel) rows = rows.filter((row) => row.channel === channel);

    const byPersonMap = new Map<string, any>();
    const byCustomerMap = new Map<string, any>();
    const byDayMap = new Map<string, any>();

    for (const row of rows) {
      const dayKey = formatIstanbulDayKey(row.created_at);
      if (!byPersonMap.has(row.created_by)) {
        byPersonMap.set(row.created_by, { kisi: row.created_by, total: 0, phone: 0, face: 0, online: 0, technicalVisit: 0, technicalOnline: 0, pom: 0, email: 0, other: 0, sales: 0, technical: 0, customers: new Set<string>(), lastActivity: row.created_at, busiestCustomer: new Map<string, number>() });
      }
      if (!byCustomerMap.has(row.customer)) {
        byCustomerMap.set(row.customer, { customer: row.customer, responsible: row.responsible, total: 0, phone: 0, face: 0, online: 0, technicalVisit: 0, technicalOnline: 0, pom: 0, email: 0, other: 0, lastActivity: row.created_at, lastOwner: row.created_by, lastChannel: row.channel, phase: row.phase, waiting: row.waiting, notes: row.notes });
      }
      if (!byDayMap.has(dayKey)) {
        byDayMap.set(dayKey, { day: dayKey, total: 0, phone: 0, face: 0, online: 0, technicalVisit: 0, technicalOnline: 0, pom: 0, email: 0, other: 0, activePeople: new Set<string>(), customers: new Set<string>() });
      }
      const person = byPersonMap.get(row.created_by);
      const customerAgg = byCustomerMap.get(row.customer);
      const day = byDayMap.get(dayKey);

      person.total += 1;
      person.lastActivity = person.lastActivity > row.created_at ? person.lastActivity : row.created_at;
      customerAgg.total += 1;
      customerAgg.lastActivity = customerAgg.lastActivity > row.created_at ? customerAgg.lastActivity : row.created_at;
      day.total += 1;
      person.customers.add(row.customer);
      day.activePeople.add(row.created_by);
      day.customers.add(row.customer);
      person.busiestCustomer.set(row.customer, (person.busiestCustomer.get(row.customer) ?? 0) + 1);

      if (row.channel === 'Telefon') { person.phone += 1; customerAgg.phone += 1; day.phone += 1; }
      if (row.channel === 'Yerinde Ziyaret') { person.face += 1; customerAgg.face += 1; day.face += 1; }
      if (row.channel === 'Online Toplantı') { person.online += 1; customerAgg.online += 1; day.online += 1; }
      if (row.channel === 'Teknik Ziyaret') { person.technicalVisit += 1; customerAgg.technicalVisit += 1; day.technicalVisit += 1; }
      if (row.channel === 'Teknik Online') { person.technicalOnline += 1; customerAgg.technicalOnline += 1; day.technicalOnline += 1; }
      if (row.channel === 'POM') { person.pom += 1; customerAgg.pom += 1; day.pom += 1; }
      if (row.channel === 'E-posta') { person.email += 1; customerAgg.email += 1; day.email += 1; }
      if (row.channel === 'Diğer') { person.other += 1; customerAgg.other += 1; day.other += 1; }
      if (isSalesChannel(row.channel)) person.sales += 1;
      if (isTechnicalChannel(row.channel)) person.technical += 1;
    }

    const byPerson = Array.from(byPersonMap.values()).map((row: any) => ({
      kisi: row.kisi,
      total: row.total,
      phone: row.phone,
      face: row.face,
      online: row.online,
      technicalVisit: row.technicalVisit,
      technicalOnline: row.technicalOnline,
      pom: row.pom,
      email: row.email,
      other: row.other,
      sales: row.sales,
      technical: row.technical,
      customerCount: row.customers.size,
      lastActivity: row.lastActivity,
      busiestCustomer: (Array.from(row.busiestCustomer.entries()) as [string, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-',
      dailyAverage: Number((row.total / daySpan).toFixed(1)),
    })).sort((a, b) => b.total - a.total);

    const byCustomer = Array.from(byCustomerMap.values()).sort((a: any, b: any) => b.total - a.total);
    const byDay = Array.from(byDayMap.values()).map((row: any) => ({
      day: row.day,
      total: row.total,
      phone: row.phone,
      face: row.face,
      online: row.online,
      technicalVisit: row.technicalVisit,
      technicalOnline: row.technicalOnline,
      pom: row.pom,
      email: row.email,
      other: row.other,
      activePeople: row.activePeople.size,
      customerCount: row.customers.size,
    }));

    const kpis = {
      totalActivities: rows.length,
      activePeople: new Set(rows.map((row) => row.created_by)).size,
      distinctCustomers: new Set(rows.map((row) => row.customer)).size,
      phone: rows.filter((row) => row.channel === 'Telefon').length,
      faceToFace: rows.filter((row) => row.channel === 'Yerinde Ziyaret').length,
      online: rows.filter((row) => row.channel === 'Online Toplantı').length,
      technicalVisit: rows.filter((row) => row.channel === 'Teknik Ziyaret').length,
      technicalOnline: rows.filter((row) => row.channel === 'Teknik Online').length,
      pom: rows.filter((row) => row.channel === 'POM').length,
      email: rows.filter((row) => row.channel === 'E-posta').length,
      other: rows.filter((row) => row.channel === 'Diğer').length,
      salesActivities: rows.filter((row) => isSalesChannel(row.channel)).length,
      technicalActivities: rows.filter((row) => isTechnicalChannel(row.channel)).length,
      topPerformer: byPerson[0]?.kisi ?? '-',
      topCustomer: byCustomer[0]?.customer ?? '-',
    };

    return NextResponse.json({
      filters: {
        from,
        to,
        ownerOptions: uniqueSorted(rows.map((row) => row.created_by)),
        responsibleOptions: uniqueSorted(rows.map((row) => row.responsible)),
        customerOptions: uniqueSorted(rows.map((row) => row.customer)),
        channelOptions: uniqueSorted(rows.map((row) => row.channel)),
        phaseOptions: uniqueSorted(rows.map((row) => row.phase)),
        waitingOptions: uniqueSorted(rows.map((row) => row.waiting)),
        statusOptions: uniqueSorted(rows.map((row) => row.status)),
      },
      kpis,
      byPerson,
      byCustomer,
      byDay,
      list: rows,
    });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
