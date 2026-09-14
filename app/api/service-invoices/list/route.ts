export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requirePermissionOrThrow, userHasPermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/http/api-error';
import { istanbulDayKey } from '@/lib/reports/live-board-shared';
import { listServiceInvoices, serviceInvoiceSummary } from '@/lib/sales/service-invoices';
import { currentPeriod, normalizePeriodMonth } from '@/lib/sales/service-invoices-shared';

// Hizmet Faturaları sekmesinin verisi (032). Görünürlük Satışlar ile aynı kapı: quote.read;
// quote.read.any yoksa yalnız kendi adına yazılmış faturalar. Özet (yıl / ay toplamları, eksik
// firmalar) seçili aya göre hesaplanır; ay verilmemişse içinde bulunulan ay.
export async function GET(request: Request) {
  try {
    const me = await requirePermissionOrThrow('quote.read');
    const url = new URL(request.url);
    const canSeeAll = userHasPermission(me, 'quote.read.any');
    const ownName = String(me.full_name ?? me.email ?? '').trim();
    const requestedOwner = String(url.searchParams.get('owner') ?? '').trim();
    const owner = canSeeAll ? requestedOwner : ownName;
    const today = istanbulDayKey(new Date());
    const period = normalizePeriodMonth(url.searchParams.get('period')) ?? currentPeriod(today);
    const allMonths = url.searchParams.get('period') === 'all';
    const year = Number(url.searchParams.get('year')) || Number(period.slice(0, 4));

    const [rows, summary] = await Promise.all([
      listServiceInvoices({
        period: allMonths ? null : period,
        year: allMonths ? year : null,
        owner,
        status: String(url.searchParams.get('status') ?? '').trim(),
        q: String(url.searchParams.get('q') ?? '').trim(),
      }),
      serviceInvoiceSummary({ year, period }),
    ]);
    const owners = canSeeAll
      ? Array.from(new Set(rows.map((row) => row.owner_name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'))
      : [ownName];

    return NextResponse.json(
      {
        rows, summary, owners, canSeeAll, period, year,
        canEdit: userHasPermission(me, 'quote.update.own') || userHasPermission(me, 'quote.update.any'),
        canCreate: userHasPermission(me, 'sale.create'),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Hizmet faturaları yüklenemedi.');
  }
}
