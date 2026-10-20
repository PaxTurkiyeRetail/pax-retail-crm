'use client';
import { useEffect, useRef, useState } from 'react';
import type { RetailOpportunity } from '@/lib/reports/retail-operasyon';
import { businessType, retailModel } from '@/lib/reports/retail-projection';
import s from './retail-operasyon.module.css';
import type {ForecastQuickAddOptions} from '@/components/forecast/ForecastQuickAdd';
import {canonicalForecastItem,forecastChannel,isBankChannel} from './retail-forecast-form';
const months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
export default function RetailPlanEditor({row,year,options,onClose,onSaved}:{row:RetailOpportunity;year:number;options:ForecastQuickAddOptions|null;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [month,setMonth]=useState(row.month);const [qty,setQty]=useState(String(row.qty));
  const [editYear,setEditYear]=useState(year);
  const [model,setModel]=useState(retailModel(row.model));const [mode,setMode]=useState(businessType(row));const [prob,setProb]=useState(String(row.prob));const [note,setNote]=useState(row.note);
  const [price,setPrice]=useState(row.unitPrice==null?'':String(row.unitPrice));const [rentalPrice,setRentalPrice]=useState(row.rentalMonthlyPrice==null?'':String(row.rentalMonthlyPrice));
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const inFlight=useRef(false);const modal=useRef<HTMLDivElement>(null);
  const [channel,setChannel]=useState(row.channel);
  const products=options?.products??[];
  const product=products.find(p=>p.code===model||p.id===model);
  const selectedChannel=forecastChannel(options,mode,channel);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;modal.current?.focus();const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!inFlight.current)onClose();if(e.key==='Tab'){const items=modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');if(!items?.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};window.addEventListener('keydown',listener);return()=>{window.removeEventListener('keydown',listener);previous?.focus();};},[onClose]);
  async function save(){
    if(inFlight.current)return;
    if((row.source&&row.source!=='forecast')||!row.id){setError('Forecast bilgisi güncel değil. Pencereyi kapatıp raporu yenileyin.');return;}
    if(!product||!qty.trim()||!Number.isInteger(Number(qty))||Number(qty)<1||Number(qty)>100000||!prob.trim()||!(options?.probabilities??[]).some(p=>Number(p.value)===Number(prob))){setError('Katalogdan model ve olasılık seçin; adet 1–100.000 arasında tam sayı olmalıdır.');return;}
    if(!selectedChannel){setError('Uygun satış kanalı bulunamadı. Kanal ayarlarını kontrol edin.');return;}
    if([price,rentalPrice].some(v=>v!==''&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1000000))){setError('Birim fiyatlar boş veya 0–1.000.000 aralığında olmalıdır.');return;}
    if(mode==='rental'&&rentalPrice!==''&&Number(rentalPrice)<=0){setError('Aylık kira bedeli pozitif olmalıdır.');return;}
    inFlight.current=true;setBusy(true);setError('');
    try{
      const item=canonicalForecastItem({productId:product.id,quantity:Number(qty),year:editYear,month,channel:selectedChannel,business:mode,probability:Number(prob),note,unitPrice:price===''?null:Number(price),rentalMonthlyPrice:rentalPrice===''?null:Number(rentalPrice),includeInRetailPlan:row.includeInRetailPlan});
      const response=await fetch('/api/forecast/update',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:row.id,...item,expected_updated_at:row.updatedAt})});
      const json=await response.json().catch(()=>null);if(!response.ok)throw new Error(response.status===409?'Bu plan başka bir kullanıcı tarafından değiştirildi. Raporu yenileyip tekrar açın.':json?.error?.message??json?.message??'Plan kaydedilemedi.');
      await onSaved();onClose();
    }catch(e){setError(e instanceof Error?e.message:'Plan kaydedilemedi.');}finally{inFlight.current=false;setBusy(false);}
  }
  return <div className={s.planBackdrop}><div ref={modal} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Forecast düzenle" className={s.planModal}>
    <header><div><h3>{row.firm} · {year} Forecast</h3><p>Forecast · canlı</p></div><button type="button" className={s.button} disabled={busy} onClick={onClose}>Kapat</button></header>
    <div className={s.planEditGrid}>
      <label>Model<select aria-label="Model" value={product?.id??''} disabled={busy||!options} onChange={e=>setModel(e.target.value)}><option value="">{options?'Model seçin':'Modeller yükleniyor…'}</option>{products.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
      <label>Adet<input aria-label="Adet" type="number" min={1} max={100000} step={1} value={qty} onChange={e=>setQty(e.target.value)} disabled={busy}/></label>
      <label>İş modeli<select aria-label="İş modeli" value={mode} onChange={e=>setMode(e.target.value as typeof mode)} disabled={busy}><option value="sale">Satış</option><option value="rental">Kiralama</option><option value="bank">Banka</option></select></label>
      <label>Planlanan ay<select aria-label="Planlanan ay" value={month} onChange={e=>setMonth(Number(e.target.value))} disabled={busy}>{months.map((label,i)=><option key={label} value={i+1}>{label}</option>)}</select></label>
      <label>Forecast yılı<select aria-label="Forecast yılı" value={editYear} disabled={busy} onChange={e=>setEditYear(Number(e.target.value))}>{[...new Set([year,...(options?.years??[])])].sort().map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label>Kanal<select aria-label="Kanal" value={selectedChannel??''} disabled={busy||mode==='bank'} onChange={e=>setChannel(e.target.value)}><option value="">Kanal seçin</option>{(options?.salesChannels??[]).filter(c=>mode==='bank'?isBankChannel(c):!isBankChannel(c)).map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
      <label>Olasılık (%)<select aria-label="Olasılık (%)" value={prob} disabled={busy} onChange={e=>setProb(e.target.value)}><option value="">Olasılık seçin</option>{!(options?.probabilities??[]).some(p=>p.value===prob)&&<option value={prob}>{prob} · mevcut değer</option>}{(options?.probabilities??[]).map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
      {mode==='rental'?<label>Aylık birim kira (USD)<input aria-label="Aylık birim kira (USD)" type="number" min={0.01} max={1000000} step="0.01" placeholder="Katalog tarifesi" value={rentalPrice} onChange={e=>setRentalPrice(e.target.value)} disabled={busy}/></label>:<label>{mode==='bank'?'Banka birim tutarı (USD)':'Birim satış fiyatı (USD)'}<input aria-label="Birim tutar (USD)" type="number" min={0} max={1000000} step="0.01" placeholder="Fiyat girilmemiş" value={price} onChange={e=>setPrice(e.target.value)} disabled={busy}/></label>}
    </div>
    <label className={s.planNote}>Not<textarea aria-label="Not" value={note} maxLength={4000} rows={4} onChange={e=>setNote(e.target.value)} disabled={busy}/></label>
    <p className={s.note}>Değişiklikler mevcut Forecast kaydına kaydedilir. İş modeli, satış ve aylık kiralama hesabını belirler; Banka planları ayrıca gösterilir.</p>
    {error&&<div className={s.error} role="alert">{error}</div>}<footer><button type="button" className={s.button} disabled={busy} onClick={onClose}>Vazgeç</button><button type="button" className={s.button} disabled={busy||!options} onClick={()=>void save()}>{busy?'Kaydediliyor…':'Forecast kaydet'}</button></footer>
  </div></div>;
}
