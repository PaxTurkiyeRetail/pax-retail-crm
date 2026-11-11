export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getUserDepartments, requirePermissionOrThrow, userHasPermission } from '@/lib/authz';
import { resolveDepartmentFilter } from '@/lib/departments';
import { parseFilters } from '@/lib/filters/schema';
import { resolvePeriod } from '@/lib/filters/period';
import { listSales, salesSummary } from '@/lib/quotes/sales-service';
import { resolveOwner } from '@/lib/reports/owner-filter';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import { getParameterOptionsByGroups } from '@/lib/system-parameters';
import { SALES_PAGE_SIZE, salesFilterConfig } from '@/lib/quotes/sales-filters';

// Satışlar ekranının verisi. Kendi teklifini görme yetkisi olanlar yalnız kendi
// satışlarını görür (quote.read.any yoksa satıcı kendisine sabitlenir).
// Özet (adet/ciro/cihaz) listeyle aynı filtreyi kullanır; liste sayfalıdır (?page=).
export async function GET(request: Request) {
  try {
    const me = await requirePermissionOrThrow('quote.read');
    const url = new URL(request.url);
    const canSeeAll = userHasPermission(me, 'quote.read.any');
    const ownName = String(me.full_name ?? me.email ?? '').trim();
    const allowedDepartments = await getUserDepartments(me);

    const ownerOptions = canSeeAll ? await loadOwnerOptions({ departments: allowedDepartments }) : [];
    const config = salesFilterConfig(ownerOptions, { withOwner: canSeeAll });
    const filters = parseFilters(url.searchParams, config, { allowedDepartments });
    const period = resolvePeriod({ period: filters.period, from: filters.from, to: filters.to }, new Date(), 'this_year');
    const owner = canSeeAll ? resolveOwner(filters.owner, ownerOptions) : { id: String(me.id), name: ownName };

    const filter = {
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? null,
      status: filters.status ?? null,
      q: filters.q ?? null,
      departments: resolveDepartmentFilter(filters.department, allowedDepartments),
      from: period.from,
      to: period.to,
    };
    const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
    const [rows, summary] = await Promise.all([
      listSales(filter, { limit: SALES_PAGE_SIZE, offset: (page - 1) * SALES_PAGE_SIZE }),
      salesSummary(filter),
    ]);
    // Satış kanalı listesi Forecast ile aynı parametre grubundan (027) — ikinci liste üretilmez.
    const parameterOptions = await getParameterOptionsByGroups(['forecast_sales_channel']);
    const channels = (parameterOptions.forecast_sales_channel ?? []).map((item) => ({ value: String(item.value), label: String(item.label) }));

    return NextResponse.json(
      {
        rows, summary, ownerOptions, canSeeAll, channels, allowedDepartments,
        periodLabel: period.label, page, pageSize: SALES_PAGE_SIZE, total: summary.total,
        canEdit: userHasPermission(me, 'quote.update.own') || userHasPermission(me, 'quote.update.any'),
        // Teklifsiz satış kaydı açma (027): account_manager kendi müşterisine, admin kısıtsız.
        canCreate: userHasPermission(me, 'sale.create'),
        canOverridePrice: userHasPermission(me, 'quote.price.override'),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
