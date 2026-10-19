import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { canAccessDataset, resolveRowScope, type ReportUser } from './access';
import { getDataset } from './datasets';
import { getPage } from './pages-repo';
import { runPage } from './page-runner';
import { isDataWidget, parsePageDefinition } from './page-types';

export function snapshotDigest(value:unknown):string {const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,ordered(x)])):v;return createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex');}
const deny=()=>Object.assign(new Error('Bu dönem fotoğrafına erişiminiz yok'),{status:403});
export async function listSnapshots(user:ReportUser,pageId:string) {
  const saved=await getPage(user,pageId);
  if(!saved)throw Object.assign(new Error('Rapor bulunamadı'),{status:404});
  const {rows}=await db.query(`select id::text,title,page_version,created_at::text,digest from public.report_page_snapshots where page_id=$1 and owner_user_id=$2 order by created_at desc limit 40`,[pageId,user.id]);
  return rows;
}
export async function captureSnapshot(user:ReportUser,pageId:string,title:string,values:Record<string,unknown>) {
  const saved=await getPage(user,pageId);
  if(!saved)throw Object.assign(new Error('Rapor bulunamadı'),{status:404});
  const scope=resolveRowScope(user);
  if(!scope)throw deny();
  const page=parsePageDefinition(saved.page);
  if(!page.widgets.some(isDataWidget))throw Object.assign(new Error('Veri bölümü olmayan raporun dönem fotoğrafı alınamaz'),{status:400});
  const results=await runPage(user,page,values);
  if(page.widgets.filter(isDataWidget).some(w=>results[w.id]?.error||!results[w.id]?.result||results[w.id]?.result?.truncated||results[w.id]?.forecast?.truncated||(w.forecastQuery&&!results[w.id]?.forecast)))throw Object.assign(new Error('Bazı bölümler eksik, hatalı veya satır sınırında. Fotoğraf alınmadı; filtreleri daraltın ya da satır sınırını artırın.'),{status:400});
  const payload=JSON.stringify({page,values,results});
  if(Buffer.byteLength(payload)>8*1024*1024)throw Object.assign(new Error('Fotoğraf boyutu çok büyük; satırları veya bölümleri azaltın'),{status:400});
  const digest=snapshotDigest({page,values,results});
  const {rows}=await db.query(`insert into public.report_page_snapshots(page_id,owner_user_id,title,page_version,page,filter_values,results,captured_scope,digest) values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9) returning id::text,title,page_version,created_at::text,digest`,[pageId,user.id,title,saved.version,JSON.stringify(page),JSON.stringify(values),JSON.stringify(results),JSON.stringify(scope),digest]);
  return rows[0];
}
export async function readSnapshot(user:ReportUser,id:string) {
  const {rows}=await db.query(`select id::text,page_id::text,owner_user_id,title,page_version,page,filter_values,results,captured_scope,digest,created_at::text from public.report_page_snapshots where id=$1 and owner_user_id=$2`,[id,user.id]);
  const record=rows[0];
  if(!record)throw Object.assign(new Error('Dönem fotoğrafı bulunamadı'),{status:404});
  // Captured data stays private, even if the live report is later shared.
  const scope=resolveRowScope(user);
  if(!scope||(record.captured_scope?.kind==='all'&&scope.kind!=='all'))throw deny();
  const page=parsePageDefinition(record.page);
  for(const w of page.widgets.filter(isDataWidget))for(const q of [w.query,w.forecastQuery].filter(Boolean)) {
    const source=getDataset(q!.dataset);
    if(!source||!canAccessDataset(user,source))throw deny();
  }
  if(snapshotDigest({page:record.page,values:record.filter_values,results:record.results})!==record.digest)throw Object.assign(new Error('Fotoğraf bütünlüğü doğrulanamadı'),{status:409});
  return {...record,page};
}
