import { describe, expect, it } from 'vitest';
import { actualRetailAverage, actualRetailRevenue, allocateRetailScenario, businessType, projectRetail } from './retail-projection';
import type { RetailOpportunity } from './retail-operasyon';

const opp = (values: Partial<RetailOpportunity> = {}): RetailOpportunity => ({firm:'Test',model:'A80',qty:1,month:3,channel:'sale',prob:10,note:'',owner:'',...values});

describe('Retail reference scenario calculations',()=>{
  it('preserves separate sale, rental and bank quantities and money with explicit model priority',()=>{
    const rows=[opp({source:'retail_plan',businessModel:'sale',saleType:'rental',channel:'Banka',qty:1250,unitPrice:200}),opp({source:'retail_plan',businessModel:'rental',saleType:'sale',qty:4845,rentalMonthlyPrice:17}),opp({source:'retail_plan',businessModel:'bank',saleType:'sale',qty:500,unitPrice:99})];
    const p=projectRetail([],rows,100,true);
    expect(p.saleQty).toBe(1250);expect(p.leaseQty).toBe(4845);expect(p.bankQty).toBe(500);expect(p.planQty).toBe(6595);
    expect(p.saleUsd).toBe(250000);expect(p.leaseUsd).toBe(82365);expect(p.bankUsd).toBe(49500);
    expect(businessType(rows[0])).toBe('sale');expect(businessType(opp({channel:'Banka',saleType:'sale'}))).toBe('bank');
    expect(p.groups[0].planMonths[2]).toBe(6595);
  });
  it('keeps business models separate while rounding each month and reconciles firm allocations',()=>{
    const rows=[opp({businessModel:'sale'}),opp({businessModel:'rental',rentalMonthlyPrice:15}),opp({businessModel:'bank'}),opp({businessModel:'sale',month:4})];
    const p=projectRetail([],rows,50,false),allocated=allocateRetailScenario(rows,50);
    expect(p.saleQty).toBe(2);expect(p.leaseQty).toBe(1);expect(p.bankQty).toBe(1);expect(p.planQty).toBe(4);
    expect(p.groups[0].planMonths[2]).toBe(3);expect(p.groups[0].planMonths[3]).toBe(1);
    expect([...allocated.values()].reduce((a,b)=>a+b,0)).toBe(p.planQty);
  });
  it('allocates rounded monthly totals to firms so details reconcile with the matrix', () => {
    const rows = [opp(), opp(), opp({ month: 4, qty: 3 }), opp({ model: 'A35', qty: 5 })];
    for (const pct of [0, 33, 50, 100]) {
      const allocated = allocateRetailScenario(rows, pct);
      const p = projectRetail([], rows, pct, false);
      expect([...allocated.values()].reduce((a, n) => a + n, 0)).toBe(p.planQty);
      for (const group of p.groups) for (let i = 0; i < 12; i++) {
        const detail = rows.filter((r) => r.model === group.model && r.month === i + 1).reduce((n, r) => n + (allocated.get(r) ?? 0), 0);
        expect(detail).toBe(group.planMonths[i]);
      }
    }
  });
  it('includes accessory sales revenue but keeps recurring rentals separate',()=>{
    expect(actualRetailRevenue([{firm:'Test',model:'S210',month:1,qty:2,usd:100,saleType:'sale'},{firm:'Test',model:'A80',month:1,qty:2,usd:30,saleType:'rental'}])).toBe(100);
  });
  it('groups by native model, month and business type before rounding, ignoring probability',()=>{
    const p=projectRetail([], [opp(),opp(),opp({saleType:'rental'}),opp({saleType:'rental'})],50,true);
    expect(p.saleQty).toBe(1);expect(p.leaseQty).toBe(1);expect(p.groups[0].planMonths).toEqual([0,0,2,...Array(9).fill(0)]);
  });
  it('rounds next year by model/month rather than individual forecast row',()=>{
    const p=projectRetail([], [opp(),opp(),opp({month:4})],50,false);
    expect(p.groups[0].planMonths[2]).toBe(1);expect(p.groups[0].planMonths[3]).toBe(1);expect(p.planQty).toBe(2);
  });
  it('excludes accessories and opted-out forecasts, and never invents rental prices',()=>{
    const p=projectRetail([{firm:'Test',model:'S210',month:1,qty:5,usd:50,saleType:'sale'}],[opp({model:'S210'}),opp({includeInRetailPlan:false}),opp({saleType:'rental'})],100,true);
    expect(p.actualQty).toBe(0);expect(p.planQty).toBe(1);expect(p.leaseUsd).toBeNull();
  });
  it('uses live actual sale averages and explicit forecast rental rates',()=>{
    const sale={firm:'Test',model:'A80',month:1,qty:2,usdQty:2,usd:300,saleType:'sale' as const};
    const p=projectRetail([sale],[opp({qty:10}),opp({qty:4,saleType:'rental',rentalMonthlyPrice:12})],50,true);
    expect(p.saleUsd).toBe(750);expect(p.leaseUsd).toBe(24);expect(p.actualQty).toBe(2);
  });
  it('uses only USD quantities for averages and refuses unknown legacy currency quantities',()=>{
    const sale={firm:'Test',model:'A80',month:1,qty:20,usdQty:2,usd:300,saleType:'sale' as const};
    expect(actualRetailAverage([sale])).toBe(150);
    expect(actualRetailAverage([{...sale,usdQty:undefined}])).toBeNull();
    expect(projectRetail([sale],[opp({unitPrice:175})],100,true).saleUsd).toBe(175);
  });
  it('keeps December actuals and forecast additive so matrix, cards and reconciliation agree',()=>{
    const sale={firm:'Test',model:'A80',month:12,qty:5,usdQty:5,usd:500,saleType:'sale' as const};
    const p=projectRetail([sale],[opp({qty:4,month:12})],50,true);
    expect(p.groups[0].actualMonths[11]+p.groups[0].planMonths[11]).toBe(p.actualQty+p.planQty);
    expect(p.actualQty+p.planQty).toBe(7);
  });
  it('reports an unavailable sale estimate when any planned model has no live price',()=>{
    const p=projectRetail([], [opp({unitPrice:200}),opp({model:'A35'})],100,true);
    expect(p.groups.find(g=>g.model==='A80')?.saleUsd).toBe(200);
    expect(p.saleUsd).toBeNull();
    expect(projectRetail([], [opp()],0,true).saleUsd).toBe(0);
  });
});
