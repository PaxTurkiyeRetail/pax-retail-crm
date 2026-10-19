import { describe, expect, it } from 'vitest';
import { datasetCatalog } from '@/lib/report-builder/datasets';
import { compileReport } from '@/lib/report-builder/compiler';
import { parseReportDefinition } from '@/lib/report-builder/types';
import { buildGuidedFilters, describeGuidedFilters, emptyFilter, filterOptionLabel } from './guided-record-filters';
const activities=datasetCatalog(()=>true).find(d=>d.key==='activities')!;
const fixture={...activities,dimensions:[...activities.dimensions,
  {key:'quantity',label:'Adet',type:'number' as const,group:null,grains:null,options:null,description:null},
  {key:'day',label:'Gün',type:'date' as const,group:null,grains:null,options:null,description:null},
  {key:'active',label:'Aktif mi?',type:'boolean' as const,group:null,grains:null,options:null,description:null},
]};
describe('guided record filters',()=>{
  it('supports all catalog activity channels and compiles selected online channels as bound parameters',()=>{
    const channel=activities.dimensions.find(d=>d.key==='channel')!;
    expect(channel.options).toContain('Online Toplantı');expect(channel.options).toContain('Teknik Online');
    const draft={...emptyFilter('channel',channel),selected:['Online Toplantı','Teknik Online']};
    const result=buildGuidedFilters([draft],activities);expect(result.error).toBeNull();
    const compiled=compileReport(parseReportDefinition({dataset:activities.key,measures:[activities.measures[0].key],filters:result.filters}),{scope:{kind:'all'},today:'2026-10-19'});
    expect(compiled.params.flat()).toContain('Online Toplantı');expect(compiled.params.flat()).toContain('Teknik Online');
  });
  it('rejects incomplete, invalid, reversed and too many filters without throwing',()=>{
    expect(buildGuidedFilters([emptyFilter()],fixture).error).toBeTruthy();
    expect(buildGuidedFilters([{...emptyFilter('quantity'),op:'between',value:'3',value2:''}],fixture).error).toBeTruthy();
    expect(buildGuidedFilters([{...emptyFilter('quantity'),op:'between',value:'3',value2:'2'}],fixture).error).toBeTruthy();
    expect(buildGuidedFilters([{...emptyFilter('day'),op:'eq',value:'2026-99-01'}],fixture).error).toBeTruthy();
    expect(buildGuidedFilters([{...emptyFilter('day'),op:'eq',value:'2026-02-30'}],fixture).error).toBeTruthy();
    expect(buildGuidedFilters(Array.from({length:21},()=>emptyFilter()),fixture).error).toContain('20');
  });
  it('uses typed values, null operators and human-readable summaries',()=>{
    const drafts=[{...emptyFilter('quantity'),op:'between' as const,value:'0',value2:'12.5'},
      {...emptyFilter('active'),op:'eq' as const,value:'false'},
      {...emptyFilter('day'),op:'between' as const,value:'2026-10-01',value2:'2026-10-19'},
      {...emptyFilter('channel'),op:'is_null' as const}];
    const result=buildGuidedFilters(drafts,fixture);expect(result.error).toBeNull();
    expect(result.filters.map(f=>f.value)).toEqual([[0,12.5],false,['2026-10-01','2026-10-19'],undefined]);
    expect(describeGuidedFilters(result.filters,fixture).join(' ')).toContain('Aktif mi?: Eşittir Hayır');
    expect(describeGuidedFilters(result.filters,fixture).join(' ')).not.toContain('is_null');
    expect(filterOptionLabel('business_partner')).toBe('İş ortağı');
  });
});
