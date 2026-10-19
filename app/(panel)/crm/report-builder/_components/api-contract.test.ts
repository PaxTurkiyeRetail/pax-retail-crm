import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiFailure } from './api';
import { validReportListPayload } from './api-contract';
const catalog={key:'activities',label:'Aktiviteler',dimensions:[{key:'channel',label:'Aktivite tipi',type:'string',options:['Online Toplantı','Teknik Online']}],measures:[{key:'activity_count',label:'Aktivite adedi'}]};
afterEach(()=>vi.unstubAllGlobals());
function success(payload:unknown){vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>payload}));}
describe('report list API success contracts',()=>{
  it.each([null,{}, {datasets:null,scope:'all'},{datasets:[{...catalog,dimensions:undefined}],scope:'all'},{datasets:[{...catalog,measures:{}}],scope:'all'},{datasets:[{...catalog,dimensions:[{key:'channel',label:'Tip',type:'string',options:{}}]}],scope:'all'},{datasets:[{...catalog,measures:[{key:'activity_count'}]}],scope:'all'}])('rejects malformed 2xx catalogs before state setters can receive them',async payload=>{
    success(payload);await expect(api.datasets()).rejects.toBeInstanceOf(ApiFailure);await expect(api.datasets()).rejects.toThrow('yanıtı eksik veya geçersiz');
  });
  it('preserves valid payload objects and empty authorized lists exactly',async()=>{
    const valid={datasets:[catalog],scope:'own',extra:'preserved'};success(valid);expect(await api.datasets()).toBe(valid);
    for(const [method,payload] of [[api.datasets,{datasets:[],scope:null}],[api.pages,{pages:[],templates:[],canDesign:false,canManageLetterheads:false}],[api.letterheads,{letterheads:[],canManage:false}],[api.definitions,{definitions:[],userId:'owner'}],[api.pages,{pages:[{id:'p',title:'Aylık rapor',extra:'kept'}],templates:[{key:'monthly',label:'Aylık şablon'}],canDesign:true,canManageLetterheads:true}],[api.letterheads,{letterheads:[{id:'l',name:'Kurumsal antet',extra:'kept'}],canManage:true}],[api.definitions,{definitions:[{id:'d',title:'Aktivite raporu',extra:'kept'}],userId:'owner'}]] as const){success(payload);expect(await method()).toBe(payload);}
  });
  it.each([['letterheads',api.letterheads,{canManage:true}],['pages',api.pages,{pages:{},templates:[],canDesign:true,canManageLetterheads:false}],['definitions',api.definitions,{definitions:undefined,userId:'owner'}]] as const)('rejects a malformed %s array in an actual API call',async(_name,method,payload)=>{success(payload);await expect(method()).rejects.toBeInstanceOf(ApiFailure);});
  it('rejects invalid JSON as a meaningful API failure',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>{throw new SyntaxError('bad json');}}));await expect(api.datasets()).rejects.toThrow('Rapor yanıtı okunamadı');});
  it('pure validation does not mutate or fill missing response properties',()=>{
    const payload={datasets:[catalog]};expect(validReportListPayload('datasets',payload)).toBe(false);expect('scope'in payload).toBe(false);
  });
});
