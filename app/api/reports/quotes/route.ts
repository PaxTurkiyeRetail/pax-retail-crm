import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { fetchAllRows } from '@/lib/reporting';
import { addDaysToIsoDate, getTurkeyTodayIso } from '@/lib/quotes/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type QuoteRow = {
  id: string;
  customer_id: string | null;
  owner_name: string | null;
  quote_no: string | null;
  opportunity_title: string | null;
  status: 'draft' | 'sent' | 'closed' | string;
  closed_reason: string | null;
  probability: number | null;
  proposal_date: string | null;
  valid_until: string | null;
  follow_up_date: string | null;
  total_amount: number | null;
  total_device_count: number | null;
  created_at: string | null;
  closed_at: string | null;
};

type CustomerRow = {
  id: string;
  musteri: string | null;
  sektor: string | null;
};

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMonthKey(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function dayDiff(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(Math.round((endDate.getTime() - startDate.getTime()) / 86400000), 0);
}

function summarizeMap(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
}

export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const admin = createPgAdminClient();
    const url = new URL(request.url);

    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const status = String(url.searchParams.get('status') ?? '').trim().toLowerCase();
    const q = String(url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('tr');

    const [quotes, ownerSourceRows] = await Promise.all([
      fetchAllRows<QuoteRow>(async (from, to) => {
        let query = admin
          .from('quotes')
          .select('id,customer_id,owner_name,quote_no,opportunity_title,status,closed_reason,probability,proposal_date,valid_until,follow_up_date,total_amount,total_device_count,created_at,closed_at')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (owner) query = query.ilike('owner_name', owner.replace(/[\%_]/g, ' ').trim());
        if (status) query = query.ilike('status', status);
        return await query;
      }),
      fetchAllRows<Pick<QuoteRow, 'owner_name'>>(async (from, to) => {
        return await admin
          .from('quotes')
          .select('owner_name')
          .order('owner_name', { ascending: true })
          .range(from, to);
      }),
    ]);

    const ownerOptions = Array.from(new Set(ownerSourceRows.map((row) => String(row.owner_name ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));

    const customerIds = Array.from(new Set(quotes.map((row) => String(row.customer_id ?? '').trim()).filter(Boolean)));
    const customers = customerIds.length
      ? await fetchAllRows<CustomerRow>(async (from, to) => {
          return await admin
            .from('musteriler')
            .select('id,musteri,sektor')
            .in('id', customerIds)
            .range(from, to);
        })
      : [];
    const customerMap = new Map(customers.map((row) => [String(row.id), row]));

    let filtered = quotes.map((row) => ({
      ...row,
      customer: customerMap.get(String(row.customer_id ?? '').trim()) ?? null,
    }));

    if (q) {
      filtered = filtered.filter((row: any) => {
        const haystack = [
          row.quote_no,
          row.opportunity_title,
          row.owner_name,
          row.status,
          row.closed_reason,
          row.customer?.musteri,
          row.customer?.sektor,
        ]
          .join(' ')
          .toLocaleLowerCase('tr');
        return haystack.includes(q);
      });
    }

    const today = getTurkeyTodayIso();
    const soon = addDaysToIsoDate(today, 3);
    const inSevenDays = addDaysToIsoDate(today, 7);

    const totalQuotes = filtered.length;
    const activeQuotes = filtered.filter((row) => row.status === 'sent');
    const closedQuotes = filtered.filter((row) => row.status === 'closed');
    const wonQuotes = closedQuotes.filter((row) => row.closed_reason === 'won');
    const lostQuotes = closedQuotes.filter((row) => ['lost', 'expired', 'no_interest'].includes(String(row.closed_reason ?? '')));
    const draftQuotes = filtered.filter((row) => row.status === 'draft');
    const overdueFollowups = filtered.filter((row) => row.status !== 'closed' && row.follow_up_date && row.follow_up_date < today).length;
    const expiringSoon = filtered.filter((row) => row.status === 'sent' && row.valid_until && row.valid_until >= today && row.valid_until <= soon).length;
    const totalDevices = filtered.reduce((sum, row) => sum + toNumber(row.total_device_count), 0);
    const totalAmount = filtered.reduce((sum, row) => sum + toNumber(row.total_amount), 0);
    const weightedAmount = filtered.reduce((sum, row) => sum + (toNumber(row.total_amount) * toNumber(row.probability) / 100), 0);
    const wonRevenue = wonQuotes.reduce((sum, row) => sum + toNumber(row.total_amount), 0);
    const avgQuoteAmount = totalQuotes ? totalAmount / totalQuotes : 0;
    const avgWonAmount = wonQuotes.length ? wonRevenue / wonQuotes.length : 0;
    const winRate = closedQuotes.length ? (wonQuotes.length / closedQuotes.length) * 100 : 0;

    const cycleDays = wonQuotes.map((row) => dayDiff(row.proposal_date ?? row.created_at, row.closed_at)).filter((v): v is number => typeof v === 'number');
    const avgSalesCycleDays = cycleDays.length ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : 0;

    const statusSummary = [
      { label: 'Taslak', value: draftQuotes.length },
      { label: 'Aktif', value: activeQuotes.length },
      { label: 'Kazanılan', value: wonQuotes.length },
      { label: 'Kaybedilen', value: lostQuotes.length },
    ];

    const closeReasonMap = new Map<string, number>();
    for (const row of closedQuotes) {
      const label = row.closed_reason === 'won'
        ? 'Kazanıldı'
        : row.closed_reason === 'lost'
        ? 'Kaybedildi'
        : row.closed_reason === 'expired'
        ? 'Süresi Doldu'
        : row.closed_reason === 'no_interest'
        ? 'İlgi Yok'
        : 'Diğer';
      closeReasonMap.set(label, (closeReasonMap.get(label) ?? 0) + 1);
    }

    const ownerPerf = new Map<string, { total: number; active: number; won: number; lost: number; draft: number; totalAmount: number; weightedAmount: number }>();
    for (const row of filtered) {
      const key = String(row.owner_name ?? '-').trim() || '-';
      const item = ownerPerf.get(key) ?? { total: 0, active: 0, won: 0, lost: 0, draft: 0, totalAmount: 0, weightedAmount: 0 };
      item.total += 1;
      item.totalAmount += toNumber(row.total_amount);
      item.weightedAmount += toNumber(row.total_amount) * toNumber(row.probability) / 100;
      if (row.status === 'draft') item.draft += 1;
      if (row.status === 'sent') item.active += 1;
      if (row.status === 'closed' && row.closed_reason === 'won') item.won += 1;
      if (row.status === 'closed' && ['lost', 'expired', 'no_interest'].includes(String(row.closed_reason ?? ''))) item.lost += 1;
      ownerPerf.set(key, item);
    }

    const ownerPerformance = Array.from(ownerPerf.entries())
      .map(([ownerName, value]) => ({
        owner: ownerName,
        ...value,
        winRate: value.won + value.lost ? (value.won / (value.won + value.lost)) * 100 : 0,
      }))
      .sort((a, b) => b.weightedAmount - a.weightedAmount || b.total - a.total || a.owner.localeCompare(b.owner, 'tr'));

    const customerPerf = new Map<string, { customer: string; sector: string; total: number; won: number; revenue: number; devices: number }>();
    for (const row of filtered as any[]) {
      const name = String(row.customer?.musteri ?? '-').trim() || '-';
      const key = `${name}__${String(row.customer_id ?? '')}`;
      const item = customerPerf.get(key) ?? { customer: name, sector: String(row.customer?.sektor ?? '-').trim() || '-', total: 0, won: 0, revenue: 0, devices: 0 };
      item.total += 1;
      item.devices += toNumber(row.total_device_count);
      if (row.status === 'closed' && row.closed_reason === 'won') {
        item.won += 1;
        item.revenue += toNumber(row.total_amount);
      }
      customerPerf.set(key, item);
    }

    const topCustomers = Array.from(customerPerf.values())
      .sort((a, b) => b.revenue - a.revenue || b.total - a.total || a.customer.localeCompare(b.customer, 'tr'))
      .slice(0, 10);

    const monthlyMap = new Map<string, { month: string; total: number; active: number; won: number; lost: number; revenue: number; weighted: number }>();
    for (const row of filtered) {
      const month = normalizeMonthKey(row.proposal_date ?? row.created_at);
      if (!month) continue;
      const item = monthlyMap.get(month) ?? { month, total: 0, active: 0, won: 0, lost: 0, revenue: 0, weighted: 0 };
      item.total += 1;
      item.weighted += toNumber(row.total_amount) * toNumber(row.probability) / 100;
      if (row.status === 'sent') item.active += 1;
      if (row.status === 'closed' && row.closed_reason === 'won') {
        item.won += 1;
        item.revenue += toNumber(row.total_amount);
      }
      if (row.status === 'closed' && ['lost', 'expired', 'no_interest'].includes(String(row.closed_reason ?? ''))) item.lost += 1;
      monthlyMap.set(month, item);
    }

    const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

    const agingBuckets = [
      { label: 'Takip Gecikmiş', value: filtered.filter((row) => row.status !== 'closed' && row.follow_up_date && row.follow_up_date < today).length },
      { label: '0-3 Gün', value: filtered.filter((row) => row.status !== 'closed' && row.follow_up_date && row.follow_up_date >= today && row.follow_up_date <= soon).length },
      { label: '4-7 Gün', value: filtered.filter((row) => row.status !== 'closed' && row.follow_up_date && row.follow_up_date > soon && row.follow_up_date <= inSevenDays).length },
      { label: 'İleri Tarih', value: filtered.filter((row) => row.status !== 'closed' && row.follow_up_date && row.follow_up_date > inSevenDays).length },
      { label: 'Takipsiz', value: filtered.filter((row) => row.status !== 'closed' && !row.follow_up_date).length },
    ];

    const probabilityBands = [
      { label: '0-30', value: filtered.filter((row) => toNumber(row.probability) <= 30).length },
      { label: '31-60', value: filtered.filter((row) => toNumber(row.probability) > 30 && toNumber(row.probability) <= 60).length },
      { label: '61-90', value: filtered.filter((row) => toNumber(row.probability) > 60 && toNumber(row.probability) <= 90).length },
      { label: '91-100', value: filtered.filter((row) => toNumber(row.probability) > 90).length },
    ];

    return NextResponse.json({
      ownerOptions,
      filters: { owner, status, q },
      summary: {
        totalQuotes,
        activeQuotes: activeQuotes.length,
        closedQuotes: closedQuotes.length,
        wonQuotes: wonQuotes.length,
        lostQuotes: lostQuotes.length,
        draftQuotes: draftQuotes.length,
        overdueFollowups,
        expiringSoon,
        totalDevices,
        totalAmount,
        weightedAmount,
        wonRevenue,
        avgQuoteAmount,
        avgWonAmount,
        avgSalesCycleDays,
        winRate,
      },
      statusSummary,
      closeReasonSummary: summarizeMap(closeReasonMap),
      agingBuckets,
      probabilityBands,
      ownerPerformance,
      topCustomers,
      monthlyTrend,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yetkisiz' }, { status: error?.status || 401 });
  }
}
