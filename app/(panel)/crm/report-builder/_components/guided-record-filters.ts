import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import type { FilterOp, ReportFilter } from '@/lib/report-builder/types';
import { RENTAL_OPS_STATUSES } from '@/lib/sales/rental-ops';
export type GuidedFilterDraft={id:string;field:string;op:FilterOp;value:string;value2:string;selected:string[]};
type Dimension=DatasetCatalogEntry['dimensions'][number];
export const FILTER_LABEL:Record<FilterOp,string>={eq:'Eşittir',neq:'Eşit değildir',in:'Seçilenlerden biri',not_in:'Seçilenler dışında',contains:'İçerir',starts_with:'İle başlar',gt:'Büyüktür / sonradır',gte:'Büyük veya eşittir / bu tarihten itibaren',lt:'Küçüktür / öncedir',lte:'Küçük veya eşittir / bu tarihe kadar',between:'İki değer arasında',is_null:'Boş',not_null:'Dolu'};
const OPTIONS:Record<string,string>={...Object.fromEntries(RENTAL_OPS_STATUSES.map(s=>[s.value,s.label])),quote:'Tekliften',direct:'Doğrudan',sale:'Satış',rental:'Kiralama',mixed:'Satış ve kiralama',phase_required:'Faz zorunlu',phase_optional:'Faz isteğe bağlı',catalog:'Katalog',manual:'Elle girilen',device:'Cihaz',peripheral:'Çevre birimi',bundle:'Paket',service:'Hizmet',license:'Lisans',customer:'Müşteri',business_partner:'İş ortağı',account:'Account',technical:'Teknik',true:'Evet',false:'Hayır'};
export const filterOptionLabel=(value:string)=>OPTIONS[value]??value;
export function filterOperators(dim:Dimension):FilterOp[]{return dim.options?.length?['in','not_in','is_null','not_null']:dim.type==='string'?['contains','eq','neq','starts_with','is_null','not_null']:dim.type==='boolean'?['eq','neq','is_null','not_null']:['eq','neq','gt','gte','lt','lte','between','is_null','not_null'];}
export function emptyFilter(field='',dimension?:Dimension):GuidedFilterDraft{return {id:crypto.randomUUID(),field,op:dimension?filterOperators(dimension)[0]:'contains',value:dimension?.type==='boolean'?'true':'',value2:'',selected:[]};}
function scalar(value:string,dim:Dimension):string|number|boolean|null {
  if(!value.trim())return null;
  if(dim.type==='number')return Number.isFinite(Number(value))?Number(value):null;
  if(dim.type==='boolean')return value==='true'?true:value==='false'?false:null;
  if(dim.type==='date'){const date=new Date(value+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null;}
  return value.trim().length<=500?value.trim():null;
}
export function buildGuidedFilters(drafts:GuidedFilterDraft[],dataset:DatasetCatalogEntry):{filters:ReportFilter[];error:string|null} {
  const filters:ReportFilter[]=[];
  if(drafts.length>20)return {filters,error:'En fazla 20 kayıt filtresi ekleyebilirsiniz.'};
  for(const draft of drafts){
    const dim=dataset.dimensions.find(d=>d.key===draft.field);
    const fail=(message:string)=>({filters,error:message});
    if(!dim)return fail('Her filtre için bir alan seçin.');
    if(!filterOperators(dim).includes(draft.op))return fail(`${dim.label}: geçerli bir koşul seçin.`);
    if(['is_null','not_null'].includes(draft.op)){filters.push({field:dim.key,op:draft.op});continue;}
    if(draft.op==='in'||draft.op==='not_in'){
      if(!draft.selected.length||draft.selected.length>200)return fail(`${dim.label}: 1–200 değer seçin.`);
      if(draft.selected.some(v=>!dim.options?.includes(v)))return fail(`${dim.label}: katalogdan değer seçin.`);
      const values=draft.selected.map(v=>scalar(v,dim));
      if(values.some(v=>v===null))return fail(`${dim.label}: geçerli değerler seçin.`);
      filters.push({field:dim.key,op:draft.op,value:values as (string|number|boolean)[]});continue;
    }
    const value=scalar(draft.value,dim);
    if(value===null)return fail(`${dim.label}: geçerli bir değer girin.`);
    if(draft.op==='between'){
      const end=scalar(draft.value2,dim);
      if(end===null||typeof end!==typeof value||value>end)return fail(`${dim.label}: küçükten büyüğe iki geçerli değer girin.`);
      filters.push({field:dim.key,op:draft.op,value:[value,end]});
    }else filters.push({field:dim.key,op:draft.op,value});
  }
  return {filters,error:null};
}
export function describeGuidedFilters(filters:ReportFilter[],dataset?:DatasetCatalogEntry):string[]{return filters.map(filter=>{
  const label=dataset?.dimensions.find(d=>d.key===filter.field)?.label??'Seçili alan';
  const values=(Array.isArray(filter.value)?filter.value:[filter.value]).filter(v=>v!==undefined).map(v=>filterOptionLabel(String(v)));
  return `${label}: ${FILTER_LABEL[filter.op]}${values.length?' '+values.join(filter.op==='between'?' – ':', '):''}`;
});}
