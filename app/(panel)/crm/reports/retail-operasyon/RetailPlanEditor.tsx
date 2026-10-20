'use client';
import { useEffect, useRef, useState } from 'react';
import type { RetailOpportunity } from '@/lib/reports/retail-operasyon';
import { businessType, retailModel } from '@/lib/reports/retail-projection';
import s from './retail-operasyon.module.css';
const months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
export default function RetailPlanEditor({row,year,onClose,onSaved}:{row:RetailOpportunity;year:number;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [month,setMonth]=useState(row.month);const [qty,setQty]=useState(String(row.qty));
  const [model,setModel]=useState(retailModel(row.model));const [mode,setMode]=useState(businessType(row));const [prob,setProb]=useState(String(row.prob));const [note,setNote]=useState(row.note);
  const [price,setPrice]=useState(row.unitPrice==null?'':String(row.unitPrice));const [rentalPrice,setRentalPrice]=useState(row.rentalMonthlyPrice==null?'':String(row.rentalMonthlyPrice));
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const inFlight=useRef(false);const modal=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;modal.current?.focus();const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!inFlight.current)onClose();if(e.key==='Tab'){const items=modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');if(!items?.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};window.addEventListener('keydown',listener);return()=>{window.removeEventListener('keydown',listener);previous?.focus();};},[onClose]);
  async function save(){
    if(inFlight.current)return;
    if(row.source!=='retail_plan'||!row.id||!row.updatedAt){setError('Plan bilgisi güncel değil. Pencereyi kapatıp raporu yenileyin.');return;}
    if(!/^[A-Za-z0-9_-]{1,40}$/.test(model.trim())||!qty.trim()||!Number.isInteger(Number(qty))||Number(qty)<0||Number(qty)>100000||!prob.trim()||!Number.isInteger(Number(prob))||Number(prob)<0||Number(prob)>100){setError('Model kodu harf, rakam, tire veya alt çizgi içermeli; adet 0–100.000, olasılık 0–100 arasında tam sayı olmalıdır.');return;}
    if([price,rentalPrice].some(v=>v!==''&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1000000))){setError('Birim fiyatlar boş veya 0–1.000.000 aralığında olmalıdır.');return;}
    inFlight.current=true;setBusy(true);setError('');
    try{
      const response=await fetch(`/api/reports/retail-plan/${encodeURIComponent(row.id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({planMonth:month,quantity:Number(qty),businessModel:mode,probability:Number(prob),productCode:model.trim().toUpperCase(),note,unitPrice:price===''?null:Number(price),rentalMonthlyPrice:rentalPrice===''?null:Number(rentalPrice),expectedUpdatedAt:row.updatedAt})});
      const json=await response.json().catch(()=>null);if(!response.ok)throw new Error(response.status===409?'Bu plan başka bir kullanıcı tarafından değiştirildi. Raporu yenileyip tekrar açın.':json?.error?.message??json?.message??'Plan kaydedilemedi.');
      await onSaved();onClose();
    }catch(e){setError(e instanceof Error?e.message:'Plan kaydedilemedi.');}finally{inFlight.current=false;setBusy(false);}
  }
  return <div className={s.planBackdrop}><div ref={modal} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Retail planını düzenle" className={s.planModal}>
    <header><div><h3>{row.firm} · {year} planı</h3><p>Retail planı · canlı</p></div><button type="button" className={s.button} disabled={busy} onClick={onClose}>Kapat</button></header>
    <div className={s.planEditGrid}><label>Model<input aria-label="Model" value={model} maxLength={40} onChange={e=>setModel(e.target.value)} disabled={busy}/></label><label>Adet<input type="number" aria-label="Adet" min={0} max={100000} step={1} value={qty} onChange={e=>setQty(e.target.value)} disabled={busy}/></label><label>İş modeli<select aria-label="İş modeli" value={mode} onChange={e=>setMode(e.target.value as typeof mode)} disabled={busy}><option value="sale">Satış</option><option value="rental">Kiralama</option><option value="bank">Banka</option></select></label><label>Planlanan ay<select aria-label="Planlanan ay" value={month} onChange={e=>setMonth(Number(e.target.value))} disabled={busy}>{months.map((label,i)=><option key={label} value={i+1}>{label}</option>)}</select></label><label>Olasılık (%)<input type="number" aria-label="Olasılık (%)" min={0} max={100} step={1} value={prob} onChange={e=>setProb(e.target.value)} disabled={busy}/></label><label>{mode==='bank'?'Banka birim tutarı (USD)':'Birim satış fiyatı (USD)'}<input type="number" min={0} max={1000000} step="0.01" placeholder="Fiyat girilmemiş" value={price} onChange={e=>setPrice(e.target.value)} disabled={busy}/></label>{mode==='rental'&&<label>Aylık birim kira (USD)<input type="number" min={0} max={1000000} step="0.01" placeholder="Fiyat girilmemiş" value={rentalPrice} onChange={e=>setRentalPrice(e.target.value)} disabled={busy}/></label>}</div>
    <label className={s.planNote}>Not<textarea aria-label="Not" value={note} maxLength={4000} rows={4} onChange={e=>setNote(e.target.value)} disabled={busy}/></label>
    <p className={s.note}>Değişiklikler bu Retail planına kaydedilir. İş modeli, satış ve aylık kiralama hesabını belirler; Banka planları ayrıca gösterilir.</p>
    {error&&<div className={s.error} role="alert">{error}</div>}<footer><button type="button" className={s.button} disabled={busy} onClick={onClose}>Vazgeç</button><button type="button" className={s.button} disabled={busy||!row.updatedAt} onClick={()=>void save()}>{busy?'Kaydediliyor…':'Planı kaydet'}</button></footer>
  </div></div>;
}
