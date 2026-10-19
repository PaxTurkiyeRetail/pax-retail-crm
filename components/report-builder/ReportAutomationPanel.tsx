'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Automation, AutomationInput } from '@/lib/report-builder/automation-types';

type Run={id:string;automation_id:string;status:string;detail:string;created_at:string;result:{observed?:number|null;condition?:boolean}};
type Data={items:Automation[];runs:Run[];mailConfigured:boolean;metrics:{widgetId:string;column:string;label:string}[]};
const initial:Data={items:[],runs:[],metrics:[],mailConfigured:false};
export function ReportAutomationPanel({pageId,onStatus}:{pageId:string;onStatus?:(message:string)=>void}) {
  const [data,setData]=useState<Data>(initial);
  const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const requestInFlight=useRef(false);
  const [name,setName]=useState('Planlı rapor'); const [kind,setKind]=useState<'delivery'|'alert'>('delivery');
  const [hours,setHours]=useState(24); const [format,setFormat]=useState<'pdf'|'csv'>('pdf');
  const [metric,setMetric]=useState(''); const [op,setOp]=useState<'gt'|'gte'|'lt'|'lte'>('gt');const [threshold,setThreshold]=useState(0);
  const [editing,setEditing]=useState<string|null>(null);
  const [firstRun,setFirstRun]=useState('');
  const reload=useCallback(async()=>{
    const res=await fetch(`/api/report-builder/automations?pageId=${encodeURIComponent(pageId)}`,{cache:'no-store'});
    const json=await res.json();
    if(!res.ok) throw new Error(json.error?.message??'Planlar yüklenemedi');
    setData(json.data);
  },[pageId]);
  useEffect(()=>{setData(initial);setEditing(null);void reload().catch(e=>setError(e.message));},[reload]);
  async function action(url:string,method:string,body?:unknown) {
    if(requestInFlight.current)return false;
    requestInFlight.current=true;
    setBusy(true);setError('');
    try {
      const res=await fetch(url,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
      const json=await res.json();if(!res.ok) throw new Error(json.error?.message??'İşlem başarısız');
      const message=json.data?.detail??'Plan kaydedildi';setMessage(message);onStatus?.(message);
      await reload();return true;
    } catch(e) {setError(e instanceof Error?e.message:'İşlem başarısız');return false;} finally{requestInFlight.current=false;setBusy(false);}
  }
  async function save() {
    const selected=data.metrics.find(m=>`${m.widgetId}|${m.column}`===metric);
    if(kind==='alert'&&!selected) {setError('Sayısal metrik seçin');return;}
    if(!firstRun||!Number.isFinite(new Date(firstRun).getTime())) {setError('İlk çalışma zamanı seçin');return;}
    const input:AutomationInput={pageId,name,kind,intervalHours:hours,format,active:true,firstRunAt:new Date(firstRun).toISOString(),alert:kind==='alert'&&selected?{widgetId:selected.widgetId,column:selected.column,op,threshold}:undefined};
    if(await action('/api/report-builder/automations'+(editing?'/'+editing:''),editing?'PATCH':'POST',input))setEditing(null);
  }
  function edit(item:Automation) {
    setEditing(item.id);setName(item.name);setKind(item.kind);setHours(item.interval_hours);setFormat(item.format);
    // datetime-local uses the viewer's local timezone; the persisted value is UTC.
    const date=new Date(item.next_run_at);setFirstRun(new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16));
    if(item.config.alert){setMetric(`${item.config.alert.widgetId}|${item.config.alert.column}`);setOp(item.config.alert.op);setThreshold(item.config.alert.threshold);}
  }
  const field='rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]';
  return <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" aria-label="Rapor otomasyonları">
    <h3 className="font-semibold text-[var(--text)]">Zamanlama ve akıllı alarmlar</h3>
    <p className="text-xs text-[var(--muted)]">Alıcı yalnız hesabınızın e-posta adresidir. İlk çalışma zamanı yerel saatle seçilir; aralık saat cinsindendir. Alarmlar eşik ilk aşıldığında bildirilir, normale dönene kadar tekrarlanmaz.</p>
    <p className="text-xs text-[var(--muted)]">AD hesaplarında plan sahibinin geçerli oturumu gerekir. Oturum sona ererse yeniden giriş yapılana kadar çalışma başarısız kaydedilir. Her çalışmada güncel roller ve planı kaydederken sahip olduğunuz yetkilerin ortak kapsamı uygulanır.</p>
    {!data.mailConfigured&&<p className="text-xs text-amber-800">E-posta servisi yapılandırılmadı. Çalışmalar ve alarm sonuçları aşağıdaki geçmişe kaydedilir.</p>}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <label className="grid gap-1 text-xs">Plan adı<input className={field} value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>
      <label className="grid gap-1 text-xs">Tür<select aria-label="Tür" className={field} value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="delivery">Rapor gönderimi</option><option value="alert">Eşik alarmı</option></select></label>
      <label className="grid gap-1 text-xs">Tekrar aralığı (saat)<input type="number" min={1} max={720} className={field} value={hours} onChange={e=>setHours(Number(e.target.value))}/></label>
      <label className="grid gap-1 text-xs">İlk çalışma<input type="datetime-local" className={field} value={firstRun} onChange={e=>setFirstRun(e.target.value)}/></label>
      <label className="grid gap-1 text-xs">Ek biçimi<select className={field} value={format} onChange={e=>setFormat(e.target.value as typeof format)}><option value="pdf">PDF</option><option value="csv">CSV</option></select></label>
      {kind==='alert'&&<>
        <label className="grid gap-1 text-xs">Tek değerli metrik<select aria-label="Tek değerli metrik" className={field} value={metric} onChange={e=>setMetric(e.target.value)}><option value="">Metrik seçin</option>{data.metrics.map(m=><option key={`${m.widgetId}|${m.column}`} value={`${m.widgetId}|${m.column}`}>{m.label}</option>)}</select></label>
        <label className="grid gap-1 text-xs">Koşul<select aria-label="Koşul" className={field} value={op} onChange={e=>setOp(e.target.value as typeof op)}><option value="gt">Büyüktür</option><option value="gte">Büyük veya eşittir</option><option value="lt">Küçüktür</option><option value="lte">Küçük veya eşittir</option></select></label>
        <label className="grid gap-1 text-xs">Eşik<input type="number" step="any" className={field} value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/></label>
      </>}
    </div>
    {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex gap-2"><button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={busy} onClick={()=>void save()}>{editing?'Planı güncelle':'Plan oluştur'}</button>{editing&&<button type="button" className={field} onClick={()=>setEditing(null)}>Vazgeç</button>}</div>
    <ul className="space-y-2">{data.items.map(item=><li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-[var(--surface)] p-3 text-sm"><span className="flex-1">{item.name} · {item.is_active?'Aktif':'Durduruldu'} · {item.interval_hours} saatte bir · {new Date(item.next_run_at).toLocaleString('tr-TR')}</span><button type="button" className={field} disabled={busy} onClick={()=>edit(item)}>Düzenle</button><button type="button" className={field} disabled={busy} onClick={()=>void action(`/api/report-builder/automations/${item.id}`,'POST')}>Göndermeden test et</button>{item.is_active&&<button type="button" className={field} disabled={busy} onClick={()=>void action(`/api/report-builder/automations/${item.id}`,'DELETE')}>Durdur</button>}</li>)}</ul>
    <details><summary className="cursor-pointer text-sm font-medium">Son çalışmalar ({data.runs.length})</summary><ul className="mt-2 space-y-2 text-xs">{data.runs.map(run=><li key={run.id} className="rounded border bg-[var(--surface)] p-2">{new Date(run.created_at).toLocaleString('tr-TR')} · {data.items.find(i=>i.id===run.automation_id)?.name} · {run.status} — {run.detail}{run.result.observed!=null?` · Değer: ${run.result.observed}`:''}</li>)}</ul></details>
  </section>;
}
export default ReportAutomationPanel;
