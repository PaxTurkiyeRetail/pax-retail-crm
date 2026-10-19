import 'server-only';
import { db } from '@/lib/db';
import { normalizeRole, type Permission } from '@/lib/roles';
import { resolveRolePermissionsFromDb } from '@/lib/authz';
import { canUseReportBuilder, type ReportUser } from './access';
import { getPage, loadLetterheadAsset } from './pages-repo';
import { runPage } from './page-runner';
import { isDataWidget } from './page-types';
import { loadPdfFonts, renderPagePdf } from './pdf';
import { istanbulToday } from './dates';
import { sendMail, isMailConfigured } from '@/lib/mail';
import { matchesThreshold, backgroundRoles, type Automation, type AutomationInput } from './automation-types';

function forbidden() { return Object.assign(new Error('Yalnız kendi sayfanız için otomasyon kullanabilirsiniz'), {status:403}); }
export async function ownedPage(user: ReportUser, id: string) {
  const page = await getPage(user,id);
  if (!page || page.owner_user_id !== user.id) throw forbidden();
  return page;
}
export async function listAutomations(user: ReportUser, pageId: string) {
  const saved=await ownedPage(user,pageId);
  const [items,runs] = await Promise.all([
    db.query(`select * from public.report_page_automations where page_id=$1 and owner_user_id=$2 order by created_at desc`,[pageId,user.id]),
    db.query(`select r.id,r.automation_id,r.status,r.detail,r.created_at,r.result from public.report_page_automation_runs r join public.report_page_automations a on a.id=r.automation_id where a.page_id=$1 and a.owner_user_id=$2 order by r.created_at desc limit 30`,[pageId,user.id]),
  ]);
  const data=await runPage(user,saved.page);
  const metrics=Object.entries(data).flatMap(([widgetId,w])=>w.result?.rows.length===1 ? w.result.columns.filter(c=>c.type==='number'&&c.role!=='dimension').map(c=>({widgetId,column:c.key,label:`${saved.page.widgets.find(x=>x.id===widgetId)?.title??widgetId} · ${c.label}`})) : []);
  const history=runs.rows.map(row=>{
    const run=row;
    const ceiling:unknown=run.result?.permissionCeiling;
    // An old observation must not disclose a broader former scope after revocation.
    const canReadOld=Array.isArray(ceiling)&&ceiling.filter(p=>typeof p==='string').every(p=>(user.permissions as readonly string[]).includes(p));
    return {...run,result:canReadOld?run.result:{}};
  });
  return {items:items.rows,runs:history,mailConfigured:isMailConfigured(),metrics};
}
export async function saveAutomation(user: ReportUser, input: AutomationInput, id?: string) {
  const page=await ownedPage(user,input.pageId);
  if(input.alert) {
    const widget=page.page.widgets.find(w=>w.id===input.alert?.widgetId);
    if(!widget || !('query' in widget)) throw Object.assign(new Error('Veri bileşeni bulunamadı'),{status:400});
    // Verify the selected metric against a fresh result under the owner scope.
    const data=await runPage(user,page.page,{},[widget.id]);
    if(data[widget.id]?.result?.rows.length!==1 || !data[widget.id]?.result?.columns.some(c=>c.key===input.alert?.column && c.type==='number'&&c.role!=='dimension')) throw Object.assign(new Error('Tek satırlı sayısal metrik seçin'),{status:400});
  }
  const params=[input.pageId,user.id,input.name,input.kind,input.intervalHours,input.firstRunAt,input.format,input.active,JSON.stringify({alert:input.alert,permissionCeiling:[...user.permissions]})];
  const result=id ? await db.query(`update public.report_page_automations set name=$3,kind=$4,interval_hours=$5,next_run_at=$6,format=$7,is_active=$8,config=$9::jsonb,last_condition=false,updated_at=now() where page_id=$1 and owner_user_id=$2 and id=$10 returning *`,[...params,id]) : await db.query(`insert into public.report_page_automations(page_id,owner_user_id,name,kind,interval_hours,next_run_at,format,is_active,config) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) returning *`,params);
  if(!result.rows[0]) throw Object.assign(new Error('Plan bulunamadı'),{status:404});
  return result.rows[0];
}
export async function disableAutomation(user: ReportUser,id:string) {
  const result=await db.query(`update public.report_page_automations set is_active=false,updated_at=now() where id=$1 and owner_user_id=$2 returning id`,[id,user.id]);
  if(!result.rows.length) throw forbidden();
}

/** Re-read current account/RBAC on every invocation. No stored permission or session impersonation. */
async function currentOwner(id:string,ceiling:string[]):Promise<ReportUser> {
  const {rows}=await db.query(`select u.id::text,u.email,u.full_name,u.role,
    (exists(select 1 from public.auth_identities ai where ai.user_id=u.id and ai.provider='active_directory') or exists(select 1 from public.user_sessions h where h.user_id=u.id and h.auth_source='active_directory')) as has_ad_history,
    (select s.effective_roles from public.user_sessions s where s.user_id=u.id and s.auth_source='active_directory' and s.expires_at>now() order by s.expires_at desc limit 1) as active_ad_roles
    from public.allowed_users u where u.id::text=$1 and u.is_active=true`,[id]);
  const row=rows[0];
  if(!row) throw forbidden();
  const roles=backgroundRoles(row.role,Boolean(row.has_ad_history),row.active_ad_roles).map(normalizeRole).filter((r):r is NonNullable<typeof r>=>!!r);
  const permissions=[...new Set((await Promise.all(roles.map(resolveRolePermissionsFromDb))).flat())].filter(p=>ceiling.includes(p)) as Permission[];
  const user={...row,permissions};
  if(!canUseReportBuilder(user)) throw forbidden();
  return user;
}
function csvCell(value:unknown) {
  const text=String(value??'');
  // Spreadsheet formula injection protection applies to every textual cell.
  return '"'+(/^[=+\-@\t\r]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"';
}
export async function executeAutomation(id:string, options:{previewUser?:ReportUser}={}) {
  // A dedicated session advisory lock covers rendering + delivery. Concurrent workers/tests skip.
  const lock=await db.connect();
  let runId:string|undefined;
  try {
    const locked=await lock.query('select pg_try_advisory_lock(hashtextextended($1,0)) as locked',['report-automation:'+id]);
    if(!locked.rows[0]?.locked) return {status:'busy',detail:'Plan çalışıyor'};
    const {rows}=await lock.query(`select * from public.report_page_automations where id=$1`,[id]);
    const a=rows[0] as Automation|undefined;
    if(!a) throw Object.assign(new Error('Plan bulunamadı'),{status:404});
    if(options.previewUser && a.owner_user_id!==options.previewUser.id) throw forbidden();
    if(!options.previewUser && (!a.is_active || new Date(a.next_run_at).getTime()>Date.now())) return {status:'not_due'};
    // Claim before external effects; never retry a possibly delivered period after a process crash.
    const period=options.previewUser ? 'preview:'+crypto.randomUUID() : new Date(a.next_run_at).toISOString();
    const inserted=await lock.query(`insert into public.report_page_automation_runs(automation_id,period,status) values($1,$2,'running') on conflict(automation_id,period) do nothing returning id`,[id,period]);
    runId=inserted.rows[0]?.id;
    if(!runId) return {status:'already_claimed'};
    if(!options.previewUser) await lock.query(`update public.report_page_automations set next_run_at=now()+interval_hours*interval '1 hour',updated_at=now() where id=$1`,[id]);
    const user=await currentOwner(a.owner_user_id,a.config.permissionCeiling??[]);
    const saved=await ownedPage(user,a.page_id);
    const data=await runPage(user,saved.page);
    const missing=saved.page.widgets.filter(isDataWidget).some(w=>!data[w.id]?.result || data[w.id].error || data[w.id].result?.truncated || (w.forecastQuery && (!data[w.id].forecast || data[w.id].forecast?.truncated)));
    if(missing || Object.values(data).some(w=>w.error || w.result?.truncated)) throw new Error('Veri eksik veya yetki/sorgu hatası var; gönderim yapılmadı');
    let condition=false;
    let observed:number|null=null;
    if(a.kind==='alert') {
      const rule=a.config.alert;
      if(!rule) throw new Error('Alarm kuralı eksik');
      const result=data[rule.widgetId]?.result;
      if(!result?.columns.some(c=>c.key===rule.column&&c.type==='number'&&c.role!=='dimension') || result.rows.length!==1 || typeof result.rows[0][rule.column]!=='number') throw new Error('Alarm metriği tek satırlı sayısal sonuç olmalı');
      observed=result.rows[0][rule.column] as number;
      condition=matchesThreshold(observed,rule.op,rule.threshold);
    }
    const shouldNotify=a.kind==='delivery'||(condition&&!a.last_condition);
    let status=options.previewUser?'preview':!shouldNotify?'quiet':'in_app';
    let detail=options.previewUser?'Önizleme tamamlandı; e-posta gönderilmedi':!shouldNotify?'Eşik geçişi yok':'Sonuç uygulamada kaydedildi; mail yapılandırılmadı';
    if(!options.previewUser && shouldNotify && isMailConfigured()) {
      let bytes:Buffer;
      if(a.format==='pdf') {
        const [fonts,letterhead]=await Promise.all([loadPdfFonts(),saved.page.pdf.noLetterhead?Promise.resolve(null):loadLetterheadAsset(saved.page.pdf.letterheadId??saved.letterhead_id)]);
        bytes=Buffer.from(await renderPagePdf({page:saved.page,data,fonts,letterhead,date:istanbulToday()}));
      } else {
        const lines:string[]=[];
        for(const [widgetId,w] of Object.entries(data)) if(w.result) {
          lines.push(csvCell(widgetId),w.result.columns.map(c=>csvCell(c.label)).join(','),...w.result.rows.map(row=>w.result!.columns.map(c=>csvCell(row[c.key])).join(',')),'');
        }
        bytes=Buffer.from('\ufeff'+lines.join('\r\n'),'utf8');
      }
      const sent=await sendMail({to:[user.email],subject:a.name,html:'<p>Planlı CRM raporunuz ektedir. Ayrıntılar Rapor Merkezi otomasyon geçmişindedir.</p>',kind:'report',refId:runId,attachments:[{filename:'rapor.'+a.format,content:bytes.toString('base64')}]});
      status=sent.status; detail=sent.detail;
    }
    // A rejected/failed/skipped external attempt must not latch a new true condition.
    // It can be attempted again in the next scheduled period after configuration recovers.
    const nextCondition=['failed','rejected','skipped'].includes(status)?a.last_condition:condition;
    if(!options.previewUser) await lock.query(`update public.report_page_automations set last_condition=$2,last_status=$3 where id=$1`,[id,nextCondition,status]);
    // Store only alert observations and widget summary; full scoped data is regenerated for delivery.
    const result={observed,condition,widgetCount:Object.keys(data).length,permissionCeiling:[...user.permissions]};
    await lock.query(`update public.report_page_automation_runs set status=$2,detail=$3,result=$4::jsonb,finished_at=now() where id=$1`,[runId,status,detail,JSON.stringify(result)]);
    return {status,detail,result};
  } catch(error) {
    const detail=error instanceof Error && error.message.startsWith('AD oturumu')?error.message:'Çalıştırma başarısız; veri/yetki ve servis yapılandırmasını kontrol edin.';
    if(runId) await lock.query(`update public.report_page_automation_runs set status='failed',detail=$2,finished_at=now() where id=$1`,[runId,detail]);
    throw error;
  } finally {
    await lock.query('select pg_advisory_unlock(hashtextextended($1,0))',['report-automation:'+id]).catch(()=>undefined);
    lock.release();
  }
}
export async function runDueAutomations() {
  const {rows}=await db.query(`select id from public.report_page_automations where is_active=true and next_run_at<=now() order by next_run_at limit 20`);
  for(const row of rows) await executeAutomation(row.id).catch(error=>console.error('[report-automation]',row.id,error instanceof Error?error.message:'failed'));
}
