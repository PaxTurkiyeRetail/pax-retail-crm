import type { FilterOp, ReportDefinitionInput, ReportFilter } from './types';

const listOps: FilterOp[] = ['in', 'not_in', 'between'];
const noValueOps: FilterOp[] = ['is_null', 'not_null'];

/** Repairs the old UI's scalar list values without dropping a filter. */
export function normalizeFilter(filter: ReportFilter): ReportFilter {
  if (noValueOps.includes(filter.op)) return { ...filter, value: undefined };
  if (listOps.includes(filter.op)) {
    const value = Array.isArray(filter.value) ? filter.value : filter.value === undefined ? []
      : typeof filter.value === 'string' ? filter.value.split(',').map((part) => part.trim()).filter(Boolean) : [filter.value];
    return { ...filter, value };
  }
  return { ...filter, value: Array.isArray(filter.value) ? filter.value[0] ?? '' : filter.value };
}

export function changeFilterOperator(filter: ReportFilter, op: FilterOp): ReportFilter {
  return normalizeFilter({ ...filter, op });
}

export function normalizeDefinitionFilters<T extends ReportDefinitionInput>(definition: T): T {
  return { ...definition, filters: definition.filters?.map(normalizeFilter) };
}

export function filterInputIssue(filter: ReportFilter): string | null {
  if (noValueOps.includes(filter.op)) return null;
  const value = filter.value;
  if (filter.op === 'between') {
    if (!Array.isArray(value) || value.length !== 2 || value.some((part) => part === '')) return 'Aralık için başlangıç ve bitiş değerlerini girin.';
    if (typeof value[0] === 'string' && typeof value[1] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value[0]) && /^\d{4}-\d{2}-\d{2}$/.test(value[1]) && value[0] > value[1]) return 'Bitiş tarihi başlangıçtan önce olamaz.';
  } else if (listOps.includes(filter.op) && (!Array.isArray(value) || !value.length || value.some((part) => part === ''))) return 'Listeye en az bir değer girin.';
  else if (value === undefined || value === '') return 'Filtre değerini girin.';
  return null;
}

export function definitionFilterIssue(definition: ReportDefinitionInput): string | null {
  for (const filter of definition.filters ?? []) {
    const issue = filterInputIssue(filter);
    if (issue) return issue;
  }
  return null;
}
