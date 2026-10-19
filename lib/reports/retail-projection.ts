import type { RetailOpportunity, RetailSaleLine } from './retail-operasyon';

export const retailModel = (model: string) => model.replace(/\*/g, '').trim().toUpperCase();
export const isTerminal = (model: string) => retailModel(model) !== 'S210';
export const scenarioRate = (pct: number) => Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0)) / 100;

/** Allocate rounded model/month totals to firms without adding rounding-only devices. */
export function allocateRetailScenario(rows: RetailOpportunity[], pct: number) {
  const rate = scenarioRate(pct);
  const groups = new Map<string, Array<{ row: RetailOpportunity; exact: number; count: number }>>();
  for (const row of rows) {
    const key = `${retailModel(row.model)}~${row.month}`;
    const group = groups.get(key) ?? [];
    const exact = row.qty * rate;
    group.push({ row, exact, count: Math.floor(exact) });
    groups.set(key, group);
  }
  const allocated = new Map<RetailOpportunity, number>();
  for (const group of groups.values()) {
    let remaining = Math.round(group.reduce((n, item) => n + item.exact, 0)) - group.reduce((n, item) => n + item.count, 0);
    group.sort((a, b) => (b.exact - b.count) - (a.exact - a.count));
    for (const item of group) allocated.set(item.row, item.count + (remaining-- > 0 ? 1 : 0));
  }
  return allocated;
}
/** Accessories contribute sales revenue; recurring rental lines do not. */
export const actualRetailRevenue = (sales: RetailSaleLine[]) => sales.filter(s=>s.saleType!=='rental').reduce((n,s)=>n+s.usd,0);
export function actualRetailAverage(sales: Array<RetailSaleLine & { usdQty?: number }>) {
  const direct = sales.filter(s=>s.saleType!=='rental');
  if (direct.some(s=>s.usdQty == null)) return null;
  const qty = direct.reduce((n,s)=>n+(s.usdQty??0),0);
  return qty > 0 ? actualRetailRevenue(direct) / qty : null;
}

/** Round after grouping, so splitting a forecast into rows cannot change its result. */
export function projectRetail(sales: RetailSaleLine[], opportunities: RetailOpportunity[], pct: number, current: boolean) {
  const rate = scenarioRate(pct);
  const included = opportunities.filter(o => o.includeInRetailPlan !== false && isTerminal(o.model) && o.qty > 0 && (current || Number.isInteger(o.month) && o.month >= 1 && o.month <= 12));
  const models = [...new Set([...(current ? sales.filter(s => isTerminal(s.model)).map(s => retailModel(s.model)) : []), ...included.map(o => retailModel(o.model))])].sort((a,b) => a.localeCompare(b, 'tr', { numeric: true }));
  const groups = models.map(model => {
    const actual = current ? sales.filter(s => retailModel(s.model) === model) : [];
    const opp = included.filter(o => retailModel(o.model) === model);
    const sale = opp.filter(o => o.saleType !== 'rental');
    const lease = opp.filter(o => o.saleType === 'rental');
    const qty = (rows: RetailOpportunity[]) => rows.reduce((n,o) => n + o.qty, 0);
    const saleQty = Math.round(qty(sale) * rate), leaseQty = Math.round(qty(lease) * rate);
    const actualSale = sales.filter(s => retailModel(s.model) === model && s.saleType !== 'rental');
    const actualPrice = actualRetailAverage(actualSale);
    const price = (rows: RetailOpportunity[], field: 'unitPrice' | 'rentalMonthlyPrice', fallback: number | null) => {
      if (!rows.length) return null;
      if (rows.some(o => o[field] == null && fallback == null)) return null;
      const total = qty(rows);
      return total ? rows.reduce((n,o) => n+o.qty*(o[field] ?? fallback ?? 0),0)/total : null;
    };
    const salePrice = price(sale,'unitPrice',actualPrice), leasePrice = price(lease,'rentalMonthlyPrice',null);
    const actualMonths = Array.from({length:12},(_,i) => actual.filter(s=>s.month===i+1).reduce((n,s)=>n+s.qty,0));
    const planMonths = Array.from({length:12},(_,i) => current ? (i===11 ? saleQty+leaseQty : 0) : Math.round(qty(opp.filter(o=>o.month===i+1))*rate));
    return {model, actualMonths, planMonths, saleQty, leaseQty, salePrice, leasePrice, saleUsd:saleQty===0?0:salePrice==null?null:saleQty*salePrice, leaseUsd:leaseQty===0?0:leasePrice==null?null:leaseQty*leasePrice};
  });
  const sum = (key: 'saleUsd'|'leaseUsd') => groups.some(g=>g[key]==null) ? null : groups.reduce((n,g)=>n+(g[key]??0),0);
  return {groups, included, saleQty:groups.reduce((n,g)=>n+g.saleQty,0), leaseQty:groups.reduce((n,g)=>n+g.leaseQty,0), saleUsd:sum('saleUsd'), leaseUsd:sum('leaseUsd'), actualQty:groups.reduce((n,g)=>n+g.actualMonths.reduce((a,b)=>a+b,0),0), planQty:groups.reduce((n,g)=>n+g.planMonths.reduce((a,b)=>a+b,0),0)};
}
