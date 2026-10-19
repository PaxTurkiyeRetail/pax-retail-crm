export type ReportListKind='datasets'|'letterheads'|'pages'|'definitions';
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
const optionalText=(value:unknown)=>value==null||typeof value==='string';
const optionalStringArray=(value:unknown)=>value==null||(Array.isArray(value)&&value.every(v=>typeof v==='string'));
function catalogEntry(value:unknown):boolean {
  if(!record(value)||!text(value.key)||!text(value.label)||!Array.isArray(value.dimensions)||!Array.isArray(value.measures)||!value.measures.length)return false;
  if(!optionalText(value.description)||!optionalText(value.defaultDateField))return false;
  return value.dimensions.every(d=>record(d)&&text(d.key)&&text(d.label)&&['string','number','date','boolean'].includes(String(d.type))&&optionalText(d.group)&&optionalText(d.description)&&optionalStringArray(d.options)&&optionalStringArray(d.grains))
    &&value.measures.every(m=>record(m)&&text(m.key)&&text(m.label)&&optionalText(m.description));
}
/** Validate without normalizing: successful callers receive the original payload unchanged. */
export function validReportListPayload(kind:ReportListKind,payload:unknown):boolean {
  if(!record(payload))return false;
  const list=payload[kind];
  if(!Array.isArray(list))return false;
  if(kind==='datasets')return list.every(catalogEntry)&&(payload.scope===null||payload.scope==='all'||payload.scope==='own');
  if(kind==='letterheads')return list.every(row=>record(row)&&text(row.id)&&text(row.name))&&typeof payload.canManage==='boolean';
  if(kind==='definitions')return list.every(row=>record(row)&&text(row.id)&&text(row.title))&&text(payload.userId);
  return list.every(row=>record(row)&&text(row.id)&&text(row.title))&&Array.isArray(payload.templates)&&payload.templates.every(row=>record(row)&&text(row.key)&&text(row.label))&&typeof payload.canDesign==='boolean'&&typeof payload.canManageLetterheads==='boolean';
}
export const REPORT_LIST_LABEL:Record<ReportListKind,string>={datasets:'Rapor veri kaynakları',letterheads:'Rapor antetleri',pages:'Kayıtlı rapor sayfaları',definitions:'Kayıtlı raporlar'};
