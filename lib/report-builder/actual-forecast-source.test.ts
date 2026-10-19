import { describe, expect, it } from 'vitest';
import {compileReport} from './compiler';
import {DATASETS,datasetCatalog} from './datasets';
import {parseReportDefinition} from './types';
import {canAccessDataset} from './access';
const definition=()=>parseReportDefinition({dataset:'actual_forecast',measures:['actual_quantity','forecast_quantity','weighted_forecast_quantity','quantity_gap','actual_usd'],dimensions:[{field:'customer'},{field:'model'},{field:'owner'},{field:'month',grain:'month'}],dateRange:{type:'relative',preset:'this_year'}});
describe('safe customer/model actual and forecast links',()=>{
 it('keeps fact rows independent and isolates missing model codes',()=>{const c=compileReport(definition(),{scope:{kind:'all'},today:'2026-10-19'});expect(c.sql).toContain('union all');expect(c.sql).not.toMatch(/crm_sale_items[^]*join public.crm_forecasts/);expect(c.sql).toContain('Kod yok (satış)');expect(c.sql).toContain('Kod yok (Forecast)');expect(c.sql).toContain("<>\'rental\'");expect(c.columns.filter(x=>x.role==='dimension')).toHaveLength(4);expect(DATASETS.actual_forecast.measures.forecast_usd).toBeUndefined();});
 it('requires both source permissions in catalog and runtime',()=>{for(const permission of ['quote.read','forecast.read'] as const){expect(datasetCatalog(p=>p!==permission).some(d=>d.key==='actual_forecast')).toBe(false);expect(canAccessDataset({permissions:['report.read.all',permission]},DATASETS.actual_forecast)).toBe(false);}});
 it('binds own scope and valid department instead of joining on names',()=>{const c=compileReport({...definition(),department:'Retail'},{scope:{kind:'own',userId:'u1',email:'a@example.test',fullName:'A'},today:'2026-10-19'});expect(c.params).toContain('u1');expect(c.params).toContain('Retail');expect(c.sql).toContain('m.id=af.customer_id');expect(c.sql).not.toContain('a@example.test');});
 it('rejects daily/partial periods instead of giving misleading monthly totals',()=>{expect(()=>compileReport({...definition(),dateRange:{type:'relative',preset:'last_7_days'}},{scope:{kind:'all'},today:'2026-10-19'})).toThrow('tam ay');expect(()=>compileReport({...definition(),dimensions:[{field:'month',grain:'day'}]},{scope:{kind:'all'},today:'2026-10-19'})).toThrow();});
});
