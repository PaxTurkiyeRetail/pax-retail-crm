import { canAccessDataset, resolveRowScope, type ReportUser } from './access';
import { compileReport } from './compiler';
import { getDataset } from './datasets';
import { istanbulToday } from './dates';
import { ReportDefinitionError, type ReportDefinition, type ReportFilter, type TimeGrain } from './types';

export function grainRange(value: unknown, grain: TimeGrain) {
  const iso = String(value).slice(0, 10);
  const d = new Date(`${iso}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== iso) throw new ReportDefinitionError('Geçersiz kırılım tarihi');
  if (grain === 'week') d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  if (grain === 'month') d.setUTCDate(1);
  if (grain === 'quarter') { d.setUTCDate(1); d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3); }
  if (grain === 'year') { d.setUTCDate(1); d.setUTCMonth(0); }
  const from = d.toISOString().slice(0, 10);
  if (grain === 'day') d.setUTCDate(d.getUTCDate() + 1);
  if (grain === 'week') d.setUTCDate(d.getUTCDate() + 7);
  if (grain === 'month') d.setUTCMonth(d.getUTCMonth() + 1);
  if (grain === 'quarter') d.setUTCMonth(d.getUTCMonth() + 3);
  if (grain === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return { from, to: d.toISOString().slice(0, 10) };
}

/** Rebuild the selected group safely; validate aggregate filters before expanding detail grain. */
export function prepareDrilldown(definition: ReportDefinition, row: Record<string, unknown>, user: ReportUser, today = istanbulToday()) {
  const dataset = getDataset(definition.dataset);
  const scope = resolveRowScope(user);
  if (!dataset || !scope || !canAccessDataset(user, dataset)) throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  const original = compileReport(definition, { scope, today });
  const filters: ReportFilter[] = [...definition.filters];
  for (const column of original.columns.filter(c => c.role === 'dimension')) {
    if (!Object.prototype.hasOwnProperty.call(row, column.key)) throw new ReportDefinitionError('Kırılım değeri eksik');
    const value = row[column.key];
    const field = column.sourceField!;
    if (value === null) filters.push({ field, op: 'is_null' });
    else if (column.type === 'date') {
      const range = grainRange(value, column.grain ?? 'day');
      filters.push({ field, op: 'between', value: [range.from, range.to] });
    } else {
      if (!['string', 'number', 'boolean'].includes(typeof value)) throw new ReportDefinitionError('Geçersiz kırılım değeri');
      filters.push({ field, op: 'eq', value: value as string | number | boolean });
    }
  }
  const dimensions = ['customer_id', 'customer', 'product_code', 'product', 'model', 'owner', 'sale_id', 'quote_id', 'quote_no', dataset.defaultDateField]
    .filter(field => Object.prototype.hasOwnProperty.call(dataset.dimensions, field))
    .map(field => ({ field, ...(dataset.dimensions[field].type === 'date' ? { grain: dataset.dimensions[field].grains?.includes('day') ? 'day' as const : dataset.dimensions[field].grains?.[0] } : {}) }));
  const hasMeasureFilters = definition.filters.some(filter => Object.prototype.hasOwnProperty.call(dataset.measures, filter.field));
  const validationDefinition: ReportDefinition | undefined = hasMeasureFilters ? { ...definition, filters, compare: 'none', sort: [], limit: 1 } : undefined;
  const rowFilters = filters.filter(filter => Object.prototype.hasOwnProperty.call(dataset.dimensions, filter.field));
  const detail: ReportDefinition = { ...definition, dimensions, filters: rowFilters, compare: 'none', sort: [], limit: 500, visualization: { type: 'table' } };
  // Validate the complete generated query before execution; row scope is inseparable from it.
  compileReport(detail, { scope, today });
  return { definition: detail, validationDefinition, scope };
}



