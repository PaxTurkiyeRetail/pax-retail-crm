import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { canSeeAllForecasts, normalizeText } from '@/lib/forecast';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';
import { isMissingForecastBlockerRelation, matchesBlockerSearch, periodLabel } from '@/lib/forecast-blockers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function activeRisk(status: string) {
  return status === 'open' || status === 'in_progress' || status === 'overdue';
}

export async function GET(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') ?? '').trim();
    const status = String(url.searchParams.get('status') ?? '').trim();
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const category = String(url.searchParams.get('category') ?? '').trim();
    const page = positiveInt(url.searchParams.get('page'), 1);
    const pageSize = Math.min(positiveInt(url.searchParams.get('pageSize'), 20), 500);
    const canSeeAll = canSeeAllForecasts(me.role);
    const ownerName = String(me.full_name ?? '').trim();

    if (!canSeeAll && !ownerName) {
      return NextResponse.json({ rows: [], total: 0, page, pageSize, scope: 'own', message: 'Kullanıcı ad soyad bilgisi bulunamadı.' });
    }

    const params: any[] = [];
    const clauses = ['is_active = true'];
    if (!canSeeAll) {
      params.push(ownerName);
      clauses.push(`lower(trim(coalesce(sorumlu, ''))) = lower(trim($${params.length}))`);
    }

    let rows: any[];
    try {
      const result = await db.query(
        `
          select
            forecast_id::text,
            customer_id::text,
            musteri,
            sektor,
            sorumlu,
            entegrasyon_tipi,
            product_id,
            product_code_snapshot,
            product_name_snapshot,
            quantity,
            forecast_year,
            forecast_month,
            forecast_period_label,
            owner_name,
            owner_email,
            blocker_id::text,
            has_blocker,
            blocker_category,
            blocker_description,
            resolution_owner_type,
            resolution_owner_name,
            resolution_due_date::text,
            impact_type,
            shift_year,
            shift_month,
            shifted_quantity,
            shift_period_label,
            workflow_status,
            manager_note,
            reviewed_at::text,
            reviewed_by_email,
            reviewed_by_name,
            submitted_at::text,
            submitted_by_email,
            submitted_by_name,
            updated_at::text,
            updated_by_email,
            updated_by_name,
            resolved_at::text,
            effective_status
          from public.v_crm_forecast_blocker_impact
          where ${clauses.join(' and ')}
          order by
            case effective_status when 'overdue' then 1 when 'pending' then 2 when 'open' then 3 when 'in_progress' then 4 when 'no_blocker' then 5 else 6 end,
            resolution_due_date asc nulls last,
            forecast_year asc,
            forecast_month asc,
            musteri asc
        `,
        params,
      );
      rows = result.rows;
    } catch (error) {
      if (isMissingForecastBlockerRelation(error)) {
        return NextResponse.json({ rows: [], total: 0, page, pageSize, scope: canSeeAll ? 'all' : 'own', onboardingNeeded: true, message: 'forecast_blocker_impact_not_setup' });
      }
      throw error;
    }

    rows = rows.filter((row) => !isReportOnlyCustomer(row));

    const allVisibleRows = [...rows];
    const ownerOptions = Array.from(new Set(allVisibleRows.map((row) => String(row.sorumlu ?? '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'tr'));

    if (q) rows = rows.filter((row) => matchesBlockerSearch(row, q));
    if (status === 'active') rows = rows.filter((row) => activeRisk(row.effective_status));
    else if (status) rows = rows.filter((row) => row.effective_status === status);
    if (owner && canSeeAll) rows = rows.filter((row) => normalizeText(row.sorumlu) === normalizeText(owner));
    if (category) rows = rows.filter((row) => row.blocker_category === category);

    const filteredRows = [...rows];
    const total = rows.length;
    const offset = (page - 1) * pageSize;
    rows = rows.slice(offset, offset + pageSize);

    const summary = allVisibleRows.reduce((acc, row) => {
      acc.activeProjects += 1;
      if (row.effective_status === 'pending') acc.pending += 1;
      else acc.answered += 1;
      if (row.effective_status === 'no_blocker') acc.noBlocker += 1;
      if (row.effective_status === 'resolved') acc.resolved += 1;
      if (row.effective_status === 'overdue') acc.overdue += 1;
      if (activeRisk(row.effective_status)) acc.open += 1;
      if (activeRisk(row.effective_status) && row.impact_type === 'month_shift') acc.riskQuantity += Number(row.shifted_quantity ?? 0);
      return acc;
    }, { activeProjects: 0, answered: 0, pending: 0, open: 0, overdue: 0, noBlocker: 0, resolved: 0, riskQuantity: 0, completionRate: 0 });
    summary.completionRate = summary.activeProjects ? Math.round((summary.answered / summary.activeProjects) * 100) : 0;

    const completionMap = new Map<string, any>();
    for (const row of allVisibleRows) {
      const key = String(row.sorumlu ?? 'Atanmamış').trim() || 'Atanmamış';
      const current = completionMap.get(key) ?? { owner: key, activeProjects: 0, answered: 0, pending: 0, open: 0, overdue: 0, completionRate: 0 };
      current.activeProjects += 1;
      if (row.effective_status === 'pending') current.pending += 1;
      else current.answered += 1;
      if (activeRisk(row.effective_status)) current.open += 1;
      if (row.effective_status === 'overdue') current.overdue += 1;
      completionMap.set(key, current);
    }
    const completionByOwner = Array.from(completionMap.values()).map((item) => ({
      ...item,
      completionRate: item.activeProjects ? Math.round((item.answered / item.activeProjects) * 100) : 0,
    })).sort((a, b) => a.completionRate - b.completionRate || a.owner.localeCompare(b.owner, 'tr'));

    const budgetMap = new Map<string, any>();
    const ensurePeriod = (year: number, month: number) => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const current = budgetMap.get(key) ?? { key, year, month, periodLabel: periodLabel(year, month), currentForecast: 0, outgoing: 0, incoming: 0, projected: 0 };
      budgetMap.set(key, current);
      return current;
    };
    for (const row of allVisibleRows) {
      ensurePeriod(Number(row.forecast_year), Number(row.forecast_month)).currentForecast += Number(row.quantity ?? 0);
      if (activeRisk(row.effective_status) && row.impact_type === 'month_shift' && row.shift_year && row.shift_month) {
        const shifted = Number(row.shifted_quantity ?? 0);
        ensurePeriod(Number(row.forecast_year), Number(row.forecast_month)).outgoing += shifted;
        ensurePeriod(Number(row.shift_year), Number(row.shift_month)).incoming += shifted;
      }
    }
    const budgetImpact = Array.from(budgetMap.values())
      .map((item) => ({ ...item, projected: item.currentForecast - item.outgoing + item.incoming }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      scope: canSeeAll ? 'all' : 'own',
      ownerName: canSeeAll ? 'Tüm Accountlar' : ownerName,
      summary,
      completionByOwner,
      budgetImpact,
      ownerOptions,
      filteredCount: filteredRows.length,
      onboardingNeeded: false,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Engel ve Etki listesi alınamadı.' }, { status: error?.status || 500 });
  }
}
