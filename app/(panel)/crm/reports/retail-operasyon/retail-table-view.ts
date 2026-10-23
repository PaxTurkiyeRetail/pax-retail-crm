export type RetailTableColumn<T> = {
  key: string;
  value: (row: T) => string | number | null;
  filterValue?: (row: T) => string;
  num?: boolean;
  searchable?: boolean;
};
export type RetailTableSort = { key: string; dir: 1 | -1 } | null;
export const retailSearchText = (value: unknown) => String(value ?? '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').trim();

function numericMatch(value: string | number | null, filter: string) {
  if (value == null || typeof value !== 'number') return false;
  const expression = filter.trim().replace(/,/g, '.');
  const range = /^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)$/.exec(expression);
  if (range) return value >= Number(range[1]) && value <= Number(range[2]);
  const match = /^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/.exec(expression);
  if (!match) return false;
  const n = Number(match[2]);
  switch (match[1]) {
    case '>=': return value >= n;
    case '<=': return value <= n;
    case '>': return value > n;
    case '<': return value < n;
    default: return value === n;
  }
}

export function retailTableView<T>(rows: T[], columns: RetailTableColumn<T>[], query: string, filters: Record<string, string>, sort: RetailTableSort): T[] {
  const term = retailSearchText(query);
  const searchable = columns.filter(col => col.searchable !== false);
  const visible = rows.filter(row => (!term || searchable.some(col => retailSearchText(col.filterValue?.(row) ?? col.value(row)).includes(term)))
    && columns.every(col => {
      const filter = filters[col.key]?.trim();
      if (!filter) return true;
      return col.num && !col.filterValue ? numericMatch(col.value(row), filter) : retailSearchText(col.filterValue?.(row) ?? col.value(row)).includes(retailSearchText(filter));
    }));
  const column = columns.find(col => col.key === sort?.key);
  if (!sort || !column) return visible;
  return visible.sort((a, b) => {
    const x = column.value(a), y = column.value(b);
    // Missing values stay last in either direction.
    if (x == null || y == null) return x == null ? y == null ? 0 : 1 : -1;
    return sort.dir * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr', { numeric: true }));
  });
}
