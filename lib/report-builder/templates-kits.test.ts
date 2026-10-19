import { describe, expect, it } from 'vitest';
import { getPageTemplate } from './templates';
import { isDataWidget, parsePageDefinition } from './page-types';
import { compileReport } from './compiler';

describe('editable management report starter kits', () => {
  it('offers a full Retail workspace with five populated sections and period sales/rental analysis', () => {
    const page = getPageTemplate('retail_custom')!;
    const tabs = page.widgets.find((widget) => widget.type === 'tabs');
    expect(tabs?.type).toBe('tabs');
    if (tabs?.type !== 'tabs') throw new Error('Missing sections');
    expect(tabs.tabs.map(({ label }) => label)).toEqual(['Genel bakış', 'Satış ve modeller', 'Forecast', 'KasaPOS', 'Müşteri havuzu']);
    const data = page.widgets.filter(isDataWidget);
    expect(page.widgets.findIndex((widget) => widget.id === 'sections'))
      .toBeLessThan(page.widgets.findIndex((widget) => isDataWidget(widget) && widget.tab === 'overview'));
    for (const tab of tabs.tabs) expect(data.some((widget) => widget.tab === tab.key)).toBe(true);
    expect(data.every((widget) => widget.query.department === 'Retail')).toBe(true);
    expect(data.some((widget) => widget.type === 'bar' || widget.type === 'line')).toBe(false);
    const models = data.find(({ id }) => id === 'model_customer')!;
    expect(models.query.dimensions).toEqual(expect.arrayContaining([{ field: 'product_code' }, { field: 'customer' }]));
    expect(models.query.measures).toEqual(['quantity', 'total_usd']);
    const rental = data.find(({ id }) => id === 'sale_rental')!;
    expect(rental.query.dataset).toBe('sale_items');
    expect(rental.query.dimensions).toEqual([{ field: 'item_sale_type' }]);
    expect(rental.query.measures).toEqual(['quantity', 'total_usd', 'sale_count', 'customer_count']);
    expect(rental.query.dateRange).toEqual({ type: 'relative', preset: 'this_year' });
    const snapshots = data.filter(({ query }) => query.dataset === 'kasapos_snapshot');
    expect(snapshots).toHaveLength(2);
    expect(snapshots.every((widget) => widget.ignorePageFilters && !widget.query.dateRange && widget.tab === 'kasapos')).toBe(true);
  });

  it.each(['kasapos_monthly', 'retail_custom'])('%s compiles every section and creates independent drafts', (key) => {
    const page = getPageTemplate(key)!;
    expect(parsePageDefinition(page)).toEqual(page);
    for (const section of page.widgets.filter(isDataWidget)) {
      expect(() => compileReport(section.query, { scope: { kind: 'all' }, today: '2027-02-03' })).not.toThrow();
      expect(section.forecastQuery).toBeUndefined();
    }
    page.title = 'Changed';
    expect(getPageTemplate(key)!.title).not.toBe('Changed');
  });

  it('keeps customer/month billed quantities and USD revenue in separate single-measure pivots', () => {
    const page = getPageTemplate('kasapos_monthly')!;
    const pivots = page.widgets.filter(isDataWidget).filter((w) => w.type === 'pivot');
    expect(pivots.map((w) => w.query.measures)).toEqual([['quantity'], ['total_usd']]);
    for (const pivot of pivots) {
      expect(pivot.query.dimensions).toEqual([{ field: 'customer' }, { field: 'period_month', grain: 'month' }]);
      expect(pivot.query.filters).toContainEqual({ field: 'is_integration_device', op: 'eq', value: true });
      expect(pivot.query.dateRange).toEqual({ type: 'relative', preset: 'this_year' });
      const compiled = compileReport(pivot.query, { scope: { kind: 'all' }, today: '2027-02-03' });
      expect(compiled.params).toContain('2027-01-01');
    }
  });

  it('does not present device forecasts as KasaPOS service forecasts or filter the live CRM pool by report period', () => {
    const page = getPageTemplate('retail_custom')!;
    expect(page.department).toBe('Retail');
    const pool = page.widgets.filter(isDataWidget).find((w) => w.query.dataset === 'customers')!;
    expect(pool.ignorePageFilters).toBe(true);
    expect(pool.query.department).toBe('Retail');
    const compiled = compileReport(pool.query, { scope: { kind: 'all' }, today: '2027-02-03' });
    expect(compiled.params).toContain('Retail');
    expect(page.widgets.some((w) => 'forecastQuery' in w && w.forecastQuery)).toBe(false);
  });
});
