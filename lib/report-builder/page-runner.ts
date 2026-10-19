import 'server-only';
import { canAccessDataset, resolveRowScope, type ReportUser } from '@/lib/report-builder/access';
import { getDataset } from '@/lib/report-builder/datasets';
import { executeReport } from '@/lib/report-builder/executor';
import { applyPageFilters, isDataWidget, resolveDepartment, type PageDefinition } from '@/lib/report-builder/page-types';
import type { WidgetData } from '@/lib/report-builder/pdf';
import type { ReportDefinition } from '@/lib/report-builder/types';

const CONCURRENCY = 4;

function prepare(query: ReportDefinition, page: PageDefinition, values: Record<string, unknown>, ignore: boolean): ReportDefinition {
  if (ignore) return query;
  const ds = getDataset(query.dataset);
  const filtered = applyPageFilters(query, page.filters, values, (f) => !!ds && Object.prototype.hasOwnProperty.call(ds.dimensions, f));
  return withDepartment(filtered, page, values);
}

/** Sayfa departmanını uygular; dataset'te departman boyutu yoksa dokunmaz. */
export function withDepartment(query: ReportDefinition, page: PageDefinition, values: Record<string, unknown>): ReportDefinition {
  const ds = getDataset(query.dataset);
  if (!ds || !Object.prototype.hasOwnProperty.call(ds.dimensions, 'department')) return query;
  const department = resolveDepartment(page.department, query.department, values.department);
  return department === 'all' ? { ...query, department: undefined } : { ...query, department };
}

/**
 * Sayfadaki tüm veri widget'larını kullanıcının yetkisiyle çalıştırır. Bir widget'ın hatası
 * sayfayı düşürmez (widget içinde gösterilir). Dataset yetkisi yoksa widget "yetki yok" döner.
 */
export async function runPage(user: ReportUser, page: PageDefinition, values: Record<string, unknown> = {}, onlyIds?: string[]): Promise<Record<string, WidgetData>> {
  const scope = resolveRowScope(user);
  if (!scope) throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  const out: Record<string, WidgetData> = {};
  const jobs = page.widgets.filter(isDataWidget).filter((w) => !onlyIds || onlyIds.includes(w.id));

  const runOne = async (q: ReportDefinition) => {
    const ds = getDataset(q.dataset);
    if (!ds || !canAccessDataset(user, ds)) throw Object.assign(new Error('Bu veri kaynağına yetkiniz yok'), { status: 403 });
    return executeReport(q, scope);
  };

  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const w = jobs[i++];
      try {
        const result = await runOne(prepare(w.query, page, values, w.ignorePageFilters));
        const forecast = w.forecastQuery ? await runOne(prepare(w.forecastQuery, page, values, w.ignorePageFilters)) : undefined;
        out[w.id] = { result, forecast };
      } catch (error) {
        const status = (error as { status?: number }).status;
        out[w.id] = { error: status && status < 500 ? (error as Error).message : 'Sorgu çalıştırılamadı' };
        if (!status || status >= 500) console.error('[report-builder] widget', w.id, error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return out;
}
