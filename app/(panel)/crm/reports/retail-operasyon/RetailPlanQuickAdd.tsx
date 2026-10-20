'use client';
import {useRef,useState} from 'react';
import type {ForecastQuickAddOptions} from '@/components/forecast/ForecastQuickAdd';
import type {RetailBusinessModel} from '@/lib/reports/retail-projection';
import s from './retail-operasyon.module.css';
const months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
export default function RetailPlanQuickAdd({customerId,customerName,year,options,onSaved}:{customerId:string;customerName:string;year:number;options:ForecastQuickAddOptions|null;onSaved:()=>Promise<void>}){
  const [productCode,setProductCode]=useState('');const [quantity,setQuantity]=useState('');const [month,setMonth]=useState(new Date().getMonth()+1);const [business,setBusiness]=useState<RetailBusinessModel>('sale');const [probability,setProbability]=useState('30');const [note,setNote]=useState('');const [price,setPrice]=useState('');const [rentalPrice,setRentalPrice]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState<{ok:boolean;text:string}|null>(null);const inFlight=useRef(false);
  const products=Array.isArray(options?.products)?options.products:[];
  function selectModel(code:string){setProductCode(code);const product=products.find(p=>p.code===code);setRentalPrice(product?.rental_monthly_price==null?'':String(product.rental_monthly_price));}
  async function save(){
    if(inFlight.current)return;
    const qty=Number(quantity),prob=Number(probability);
    if(!products.some(p=>p.code===productCode)||!quantity.trim()||!Number.isInteger(qty)||qty<1||qty>100000||!probability.trim()||!Number.isInteger(prob)||prob<0||prob>100){setMessage({ok:false,text:'Katalogdan model seçin; adet 1–100.000, olasılık 0–100 arasında tam sayı olmalıdır.'});return;}
    if([price,rentalPrice].some(v=>v!==''&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1000000))){setMessage({ok:false,text:'Birim fiyatlar boş veya 0–1.000.000 aralığında olmalıdır.'});return;}
    inFlight.current=true;setBusy(true);setMessage(null);
    try{
      const response=await fetch('/api/reports/retail-plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customerId,productCode,quantity:qty,planYear:year,planMonth:month,businessModel:business,probability:prob,note,unitPrice:price===''?null:Number(price),rentalMonthlyPrice:rentalPrice===''?null:Number(rentalPrice)})});
      const json=await response.json().catch(()=>null);if(!response.ok)throw new Error(json?.error?.message??json?.message??'Retail planı kaydedilemedi.');
      await onSaved();setQuantity('');setMessage({ok:true,text:`${customerName}: ${qty} adet ${year} Retail planına eklendi.`});
    }catch(error){setMessage({ok:false,text:error instanceof Error?error.message:'Retail planı kaydedilemedi.'});}finally{inFlight.current=false;setBusy(false);}
  }
  return <div className={s.retailQuickAdd} aria-label={`${customerName} Retail planı ekle`}><p><strong>{year} Retail planı</strong> · Bu plan Retail projeksiyonuna ve aylık sonuçlara eklenir.</p><div className={s.planEditGrid}>
    <label>Model<select aria-label="Model" disabled={busy||!products.length} value={productCode} onChange={e=>selectModel(e.target.value)}><option value="">{options?'Model seçin':'Modeller yükleniyor…'}</option>{products.map(p=><option key={p.id} value={p.code}>{p.code}{p.name&&p.name!==p.code?` · ${p.name}`:''}</option>)}</select></label>
    <label>Adet<input aria-label="Adet" type="number" min={1} max={100000} step={1} value={quantity} disabled={busy} onChange={e=>setQuantity(e.target.value)}/></label>
    <label>Ay<select aria-label="Ay" value={month} disabled={busy} onChange={e=>setMonth(Number(e.target.value))}>{months.map((label,i)=><option key={label} value={i+1}>{label}</option>)}</select></label>
    <label>İş modeli<select aria-label="İş modeli" value={business} disabled={busy} onChange={e=>setBusiness(e.target.value as RetailBusinessModel)}><option value="sale">Satış</option><option value="rental">Kiralama</option><option value="bank">Banka</option></select></label>
    <label>Olasılık (%)<input aria-label="Olasılık (%)" type="number" min={0} max={100} step={1} value={probability} disabled={busy} onChange={e=>setProbability(e.target.value)}/></label>
    {business==='rental'?<label>Aylık birim kira (USD)<input aria-label="Aylık birim kira (USD)" type="number" min={0} max={1000000} step="0.01" value={rentalPrice} disabled={busy} placeholder="Fiyat girilmemiş" onChange={e=>setRentalPrice(e.target.value)}/></label>:<label>{business==='bank'?'Banka birim tutarı (USD)':'Birim satış fiyatı (USD)'}<input aria-label="Birim tutar (USD)" type="number" min={0} max={1000000} step="0.01" value={price} disabled={busy} placeholder="Fiyat girilmemiş" onChange={e=>setPrice(e.target.value)}/></label>}
  </div><label className={s.planNote}>Not<textarea aria-label="Plan notu" maxLength={4000} rows={2} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></label><p className={s.note}>{business==='bank'?'Banka planının tutarı satış cirosu ve aylık kira hesabına eklenmez.':business==='rental'?'Aylık kira boşsa gelir fiyat eksik olarak gösterilir.':'Satış fiyatı boşsa varsa aynı modelin gerçekleşen USD satış ortalaması kullanılır. Banka planları satış cirosundan ayrı tutulur.'}</p>{message&&<div role={message.ok?'status':'alert'} className={message.ok?s.note:s.error}>{message.text}</div>}<button type="button" className={s.button} disabled={busy||!products.length} onClick={()=>void save()}>{busy?'Kaydediliyor…':'+ Retail planı'}</button></div>;
}
