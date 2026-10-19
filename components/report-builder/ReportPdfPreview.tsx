'use client';
import { useEffect, useRef, useState } from 'react';
import { isDataWidget, type PageDefinition, type DataWidget } from '@/lib/report-builder/page-types';
import type { ColumnMeta } from '@/lib/report-builder/types';

type Props={page:PageDefinition;values:Record<string,unknown>;letterheadId?:string|null;onClose:()=>void;onApply?:(page:PageDefinition)=>void;builtinPortrait?:boolean};
export default function ReportPdfPreview({page,values,letterheadId,onClose,onApply,builtinPortrait=false}:Props) {
  const [draft,setDraft]=useState<PageDefinition>(()=>structuredClone(page));
  const [url,setUrl]=useState('');const [renderedKey,setRenderedKey]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const [columns,setColumns]=useState<Record<string,ColumnMeta[]>>({});
  const modal=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';modal.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
  const controller=useRef<AbortController>();const objectUrl=useRef('');
  const effective={...draft,pdf:{...draft.pdf,...(builtinPortrait?{orientation:'portrait' as const}:{})}};
  const key=JSON.stringify({page:effective,values,letterheadId});
  const stale=key!==renderedKey;
  useEffect(()=>{
    const abort=new AbortController();
    void fetch('/api/report-builder/pages/run',{method:'POST',headers:{'content-type':'application/json'},signal:abort.signal,body:JSON.stringify({page,values})}).then(async r=>{
      if(!r.ok)return;const json=await r.json();
      const next:Record<string,ColumnMeta[]>={};for(const [id,widget]of Object.entries(json.data??{}))next[id]=(widget as {result?:{columns:ColumnMeta[]}}).result?.columns??[];setColumns(next);
    }).catch(()=>undefined);
    return()=>abort.abort();
  },[page,values]);
  useEffect(()=>{controller.current?.abort();setLoading(false);},[key]);
  useEffect(()=>()=>{controller.current?.abort();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);},[]);
  function pdf(change:Partial<PageDefinition['pdf']>){setDraft(d=>({...d,pdf:{...d.pdf,...change}}));}
  function widget(id:string,change:(w:DataWidget)=>DataWidget){setDraft(d=>({...d,widgets:d.widgets.map(w=>w.id===id&&isDataWidget(w)?change(w):w)}));}
  function column(id:string,columnKey:string,change:Partial<DataWidget['style']['columns'][number]>){widget(id,w=>{
    const prior=w.style.columns.find(c=>c.key===columnKey);
    const setting={key:columnKey,...prior,...change};
    return {...w,style:{...w.style,columns:prior?w.style.columns.map(c=>c.key===columnKey?setting:c):[...w.style.columns,setting]}};
  });}
  async function preview(){
    controller.current?.abort();const abort=new AbortController();controller.current=abort;setLoading(true);setError('');
    const requestedKey=key;
    try {
      const response=await fetch('/api/report-builder/pdf',{method:'POST',signal:abort.signal,headers:{'content-type':'application/json'},body:JSON.stringify({page:effective,values,letterheadId,inline:true})});
      if(!response.ok){const json=await response.json().catch(()=>({}));throw new Error(json.error?.message??'PDF oluşturulamadı');}
      const blob=await response.blob();if(abort.signal.aborted)return;
      if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);
      objectUrl.current=URL.createObjectURL(blob);setUrl(objectUrl.current);setRenderedKey(requestedKey);
    }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'PDF oluşturulamadı');}
    finally{if(controller.current===abort)setLoading(false);}
  }
  const field='min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)]';
  return <div ref={modal} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){const list=Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],iframe')??[]).filter(el=>el.offsetParent!==null);const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}} role="dialog" aria-modal="true" aria-label="Gelişmiş PDF önizleme" className="fixed inset-0 z-[100] flex flex-col bg-[var(--surface)] text-[var(--text)]">
    <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] p-3"><h2 className="flex-1 font-semibold">PDF düzeni ve gerçek çıktı önizlemesi</h2><button className={field} type="button" onClick={onClose}>Kapat</button></header>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="w-full space-y-4 overflow-auto border-r border-[var(--border)] p-4 md:w-[380px]">
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs">Yön<select className={field} disabled={builtinPortrait} value={builtinPortrait?'portrait':draft.pdf.orientation??'portrait'} onChange={e=>pdf({orientation:e.target.value as 'portrait'|'landscape'})}><option value="portrait">Dikey</option><option value="landscape">Yatay</option></select></label>
          <label className="grid gap-1 text-xs">Tablo yazı boyutu<input className={field} type="number" min={6} max={12} step={0.5} value={draft.pdf.fontSize??8} onChange={e=>pdf({fontSize:Math.min(12,Math.max(6,Number(e.target.value)))})}/></label>
        </div>
        {builtinPortrait&&<p className="text-xs opacity-70">Resmî antet dikeydir; güvenli içerik alanı sunucuda korunur.</p>}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.pdf.wordWrap!==false} onChange={e=>pdf({wordWrap:e.target.checked})}/>Uzun hücreleri satıra böl</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.pdf.hideRepeatedTitle!==false} onChange={e=>pdf({hideRepeatedTitle:e.target.checked})}/>Sayfa başlığını tekrarlayan bileşen başlığını gizle</label>
        <fieldset className="grid grid-cols-2 gap-2"><legend className="mb-2 text-xs font-medium">Kenar boşluğu (mm, antetin alt sınırı korunur)</legend>{(['top','right','bottom','left']as const).map((side,i)=><label className="grid gap-1 text-xs" key={side}>{['Üst','Sağ','Alt','Sol'][i]}<input className={field} type="number" min={5} max={60} value={draft.pdf.marginsMm?.[side]??15} onChange={e=>pdf({marginsMm:{top:15,right:15,bottom:15,left:15,...draft.pdf.marginsMm,[side]:Math.min(60,Math.max(5,Number(e.target.value)))}})}/></label>)}</fieldset>
        {draft.widgets.filter(isDataWidget).map(w=><details key={w.id} className="rounded-lg border border-[var(--border)] p-2"><summary className="cursor-pointer text-sm font-medium">{w.title||w.type}</summary>
          <div className="mt-2 space-y-2"><label className="flex gap-2 text-xs"><input type="checkbox" checked={w.pdf.hideInPdf} onChange={e=>widget(w.id,x=>({...x,pdf:{...x.pdf,hideInPdf:e.target.checked}}))}/>PDF içinde gizle</label><label className="flex gap-2 text-xs"><input type="checkbox" checked={w.pdf.pageBreakBefore} onChange={e=>widget(w.id,x=>({...x,pdf:{...x.pdf,pageBreakBefore:e.target.checked}}))}/>Yeni sayfada başlat</label>
          {(columns[w.id]??w.style.columns.map(c=>({key:c.key,label:c.label??c.key}))).map(c=>{const setting=w.style.columns.find(s=>s.key===c.key);return <div className="space-y-1 rounded border border-[var(--border)] p-2" key={c.key}><div className="text-xs">{c.label}</div><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs">Sütun genişliği<input className={field} type="number" min={0.1} max={100} step={0.1} value={setting?.width??1} onChange={e=>column(w.id,c.key,{width:Math.min(100,Math.max(0.1,Number(e.target.value)))})}/></label><label className="grid gap-1 text-xs">Hizalama<select className={field} value={setting?.align??''} onChange={e=>column(w.id,c.key,{align:(e.target.value||undefined)as 'left'|'center'|'right'|undefined})}><option value="">Otomatik</option><option value="left">Sol</option><option value="center">Orta</option><option value="right">Sağ</option></select></label></div><label className="flex gap-2 text-xs"><input type="checkbox" checked={setting?.wordWrap??draft.pdf.wordWrap!==false} onChange={e=>column(w.id,c.key,{wordWrap:e.target.checked})}/>Satıra böl</label></div>;})}
          </div></details>)}
        {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="button" className="w-full rounded-lg bg-blue-600 p-2 text-sm text-white disabled:opacity-50" disabled={loading} onClick={()=>void preview()}>{loading?'PDF hazırlanıyor…':'Önizlemeyi oluştur / yenile'}</button>
        <div className="flex gap-2">{url&&!stale&&!loading?<a className={field+' flex-1 text-center'} href={url} download={`${draft.title.replace(/[^\p{L}\p{N} _-]/gu,'')}.pdf`}>Aynı PDF’yi indir</a>:<button type="button" className={field+' flex-1 opacity-50'} disabled>PDF indir</button>}{onApply&&<button type="button" className={field} onClick={()=>onApply(effective)}>Düzeni uygula</button>}</div>
      </aside>
      <main className="flex min-h-0 flex-1 flex-col bg-slate-200 p-3">{stale&&url&&<p className="mb-2 rounded bg-amber-100 p-2 text-sm text-amber-900">Ayarlar değişti. İndirmek için önizlemeyi yenileyin.</p>}{url?<iframe title="Sunucuda üretilen PDF" className="min-h-[300px] flex-1 border-0" src={url}/>:<div className="m-auto max-w-md text-center text-sm text-slate-700">Ayarları düzenleyip önizlemeyi oluşturun. Burada gösterilen dosya ile indirilen PDF aynı baytlardır.</div>}</main>
    </div>
  </div>;
}
