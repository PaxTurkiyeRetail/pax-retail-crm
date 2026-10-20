'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { RetailOperasyonPayload } from '@/lib/reports/retail-operasyon';
import { actualRetailAverage, actualRetailRevenue, allocateRetailScenario, businessLabel, isTerminal, projectRetail, retailModel } from '@/lib/reports/retail-projection';
import styles from './retail-operasyon.module.css';

const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const number = (n: number | null) => n == null ? '—' : n.toLocaleString('tr-TR',{maximumFractionDigits:0});
const money = (n: number | null) => n == null ? 'Fiyat eksik' : `${number(n)} $`;
const total = (n: number[]) => n.reduce((a,b)=>a+b,0);

export default function RetailResults({data,year,pct,includeOpportunities=true}: {data:RetailOperasyonPayload;year:number;pct:number;includeOpportunities?:boolean}) {
  const current = year===data.year;
  const [finance,setFinance] = useState(false);
  const opportunities = useMemo(() => includeOpportunities ? current ? data.opportunities.current : data.opportunities.next : [], [includeOpportunities,current,data.opportunities]);
  const p = useMemo(()=>projectRetail(data.sales,opportunities,pct,current),[data.sales,opportunities,pct,current]);
  const allocated = useMemo(() => allocateRetailScenario(p.included, pct), [p.included, pct]);
  const actualUsd = current ? actualRetailRevenue(data.sales) : 0;
  const monthly = months.map((_,i)=>p.groups.reduce((n,g)=>n+g.actualMonths[i]+g.planMonths[i],0));
  const cards: Array<[string,string,string?]> = current ? [
    ['Gerçekleşen terminal',number(p.actualQty),'S210 dahil değil · sabit'],['Simüle edilen ek cihaz',number(p.planQty),'Seçilen gerçekleşme yüzdesi'],['Toplam terminal (senaryo)',number(p.actualQty+p.planQty)],['Gerçekleşen satış USD',money(actualUsd),'Satış raporu · değişmez'],
    ['Simüle edilen satış adedi',number(p.saleQty)],['Simüle edilen kiralama adedi',number(p.leaseQty)],['Simüle edilen banka adedi',number(p.bankQty),'Toplamda dahil · satış/kiralama dışında'],['Tahmini ek satış cirosu',money(p.saleUsd)],['Senaryo satış toplamı',money(p.saleUsd==null?null:actualUsd+p.saleUsd)],
  ] : [['Planlanan firma (CRM + projeksiyon)',number(new Set(p.included.map(o=>o.customerId??o.firm)).size)],['Toplam plan cihaz adedi',number(p.included.reduce((n,o)=>n+o.qty,0))],['Senaryolu sipariş toplamı',number(p.planQty),`%${pct} senaryosu`],['Satış cihaz',number(p.saleQty)],['Kiralama cihaz',number(p.leaseQty)],['Banka cihaz',number(p.bankQty),'Toplamda dahil · satış/kiralama dışında']];
  const table = (headers:string[], rows:ReactNode, title:string) => <div className={styles.card}><h3>{title}</h3><div className={styles.tableWrap}><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows}</tbody></table></div></div>;
  const csv = () => {
    const rows: (string|number)[][] = [['Model',...months,'Toplam'],...p.groups.map(g=>{const values=g.actualMonths.map((n,i)=>n+g.planMonths[i]);return [g.model,...values,total(values)];}),['TOPLAM',...monthly,total(monthly)]];
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Retail_${year}_Aylik_Sonuc.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const modelFinance = [...new Set(data.sales.filter(s=>s.saleType!=='rental').map(s=>retailModel(s.model)))].map(model=>{const rows=data.sales.filter(s=>retailModel(s.model)===model&&s.saleType!=='rental');return {model,qty:rows.reduce((n,s)=>n+s.qty,0),usd:rows.reduce((n,s)=>n+s.usd,0),average:actualRetailAverage(rows)};}).sort((a,b)=>b.usd-a.usd);
  const history=data.kasapos.monthly;
  const first=history[0],last=history.at(-1);
  return <>
    <div className={styles.actions}><button className={styles.button} onClick={csv}>Görünen tabloyu CSV indir</button></div>
    <div className={styles.grid}>{cards.map(([label,value,sub])=><div className={styles.metric} key={label}><div>{label}</div><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>)}</div>
    {current&&table(['Model','Plan satış adedi','Plan kiralama adedi','Plan banka adedi','Satış ort. fiyatı','Ek satış tutarı'],<>{p.groups.map(g=><tr key={g.model}><td>{g.model}</td><td>{number(g.saleQty)}</td><td>{number(g.leaseQty)}</td><td>{number(g.bankQty)}</td><td>{money(g.salePrice)}</td><td>{money(g.saleUsd)}</td></tr>)}<tr><th>TOPLAM</th><td>{number(p.saleQty)}</td><td>{number(p.leaseQty)}</td><td>{number(p.bankQty)}</td><td>—</td><td>{money(p.saleUsd)}</td></tr></>,`${year} · Senaryonun model bazlı satış / kiralama / banka sonucu`)}
    <div className={styles.note}>{current?'Yeşil = gerçekleşen · Sarı = kayıtlı ayındaki Forecast senaryosu. Gerçekleşenler sabit; fırsat olasılıkları kullanılmaz.':'Sarı = plan. Canlı Forecast kayıtları seçilen aylarda gösterilir.'}</div>
    {table(['Model',...months,'Toplam',...(current?['Fırsat']:[])],<>{p.groups.map(g=><tr key={g.model}><th>{g.model}</th>{g.actualMonths.map((n,i)=><td className={styles.num} key={i} style={{background:n?'#d8f6e3':g.planMonths[i]?'#fff0ce':undefined}}>{n&&g.planMonths[i]?<><span title='Gerçekleşen'>{number(n)}</span><span title='Ek forecast' style={{display:'block',background:'#fff0ce'}}>+{number(g.planMonths[i])}</span></>:n||g.planMonths[i]?number(n+g.planMonths[i]):'—'}</td>)}<th>{number(total(g.actualMonths)+total(g.planMonths))}</th>{current&&<td>{number(total(g.planMonths))}</td>}</tr>)}<tr><th>TOPLAM</th>{monthly.map((n,i)=><th key={i}>{number(n)}</th>)}<th>{number(total(monthly))}</th>{current&&<th>{number(p.planQty)}</th>}</tr></>,`${year} · Aylık ${current?'terminal adetleri':'cihaz sipariş planı'}`)}
    {current ? <>
      <label className={styles.actions}><input type="checkbox" checked={finance} onChange={e=>setFinance(e.target.checked)}/> Simülasyonu satış ve kiralama tablolarına dahil et</label>
      {table(['Gösterge','Gerçekleşen','Simülasyon (ek)','Genel toplam'],<>
        <tr><td>Terminal adedi (S210 hariç)</td><td>{number(p.actualQty)}</td><td>{number(finance?p.planQty:0)}</td><td>{number(p.actualQty+(finance?p.planQty:0))}</td></tr>
        <tr><td>Cihaz satış cirosu (USD)</td><td>{money(actualUsd)}</td><td>{money(finance?p.saleUsd:0)}</td><td>{money(finance&&p.saleUsd==null?null:actualUsd+(finance?p.saleUsd??0:0))}</td></tr>
        <tr><td>KasaPOS + kiralama düzenli aylık gelir (USD)</td><td>{money(data.kasapos.aylikGelir+(data.rental?.monthlyRevenue??0))}</td><td>{money(finance?p.leaseUsd:0)}</td><td>{money(finance&&p.leaseUsd==null?null:data.kasapos.aylikGelir+(data.rental?.monthlyRevenue??0)+(finance?p.leaseUsd??0:0))}</td></tr>
      </>,`${year} · Gerçekleşen, Simülasyon ve Genel Toplam`)}
      <div className={styles.note}>Satış cirosu ve düzenli aylık gelir ayrı göstergelerdir. Forecast fiyatı yoksa yalnızca USD satış adetleri üzerinden gerçekleşen model ortalaması kullanılır; döviz adedi bilinmeyen eski kayıtlardan fiyat türetilmez. Kiralama fiyatı bulunmayan planların geliri hesaplanmaz.</div>
      <div className={styles.two}>
        {table(['Model','Adet','Satış tutarı (USD)','Ort. USD satış fiyatı'],<>{modelFinance.map(g=><tr key={g.model}><td>{g.model}{!isTerminal(g.model)?' (aksesuar)':''}</td><td>{number(g.qty)}</td><td>{money(g.usd)}</td><td>{money(g.average)}</td></tr>)}{finance&&p.groups.filter(g=>g.saleQty).map(g=><tr key={'plan-'+g.model} style={{background:'#fff9eb'}}><td>{g.model} · Forecast</td><td>{number(g.saleQty)}</td><td>{money(g.saleUsd)}</td><td>{money(g.salePrice)}</td></tr>)}</>,`${year} cihaz / ürün satışları`)}
        {table(['Model / firma','Aktif / plan adet','Aylık gelir (USD)','Ort. aylık bedel (USD)'],<>{data.rental && data.rental.activeQty > 0 && <tr><td>Doğrulanmış aktif kiralama toplamı</td><td>{number(data.rental.activeQty)}</td><td>{money(data.rental.monthlyRevenue)}</td><td>{money(data.rental.avgMonthlyPrice)}</td></tr>}{finance&&p.groups.filter(g=>g.leaseQty).map(g=><tr key={g.model} style={{background:'#fff9eb'}}><td>{g.model} · Forecast</td><td>{number(g.leaseQty)}</td><td>{money(g.leaseUsd)}</td><td>{money(g.leasePrice)}</td></tr>)}{!data.rental?.activeQty&&!finance&&<tr><td colSpan={4}>Doğrulanmış aktif kiralama kaydı bulunmuyor.</td></tr>}</>,'Ödeme Sistemleri Altyapısı · Kiralama')}
      </div>
      <div className={styles.card}><h3>KasaPOS entegrasyon · aylık gerçekleşen</h3><div className={styles.grid}>{[['Son ay faturalanan kasa',number(last?.billed??null)],['Son ay aylık hizmet geliri',money(last?.usd??null)],['Dönem gelir artışı',first?.usd&&last?`${(last.usd/first.usd).toLocaleString('tr-TR',{maximumFractionDigits:2})} kat`:'—']].map(([label,value])=><div className={styles.metric} key={label}>{label}<strong>{value}</strong></div>)}</div>{(['billed','usd'] as const).map(key=><div key={key}><h4>{key==='billed'?'Faturalanan kasa adedi':'Aylık düzenli gelir (USD)'}</h4><div style={{display:'flex',gap:8,alignItems:'end',minHeight:145,overflowX:'auto'}}>{history.map(m=><div key={m.month} style={{flex:1,minWidth:42,textAlign:'center'}}><small>{key==='usd'?money(m[key]):number(m[key])}</small><div style={{height:Math.max(2,m[key]/Math.max(1,...history.map(x=>x[key]))*100),background:key==='usd'?'#9accc3':'#b2cdea',margin:'4px 12% 0',borderRadius:'4px 4px 0 0'}}/><small>{m.month}</small></div>)}</div></div>)}{!history.length&&<p>Aylık doğrulanmış veri bulunmuyor.</p>}</div>
    </> : <><p className={styles.note}>Senaryo adetleri model ve ay toplamı üzerinden firmalara dağıtılır; detay toplamı aylık tabloyla eşittir.</p>{table(['#','Firma','Model','İş modeli','Ay','Plan adedi','Senaryo adedi'],p.included.slice().sort((a,b)=>a.month-b.month||a.model.localeCompare(b.model,'tr')||a.firm.localeCompare(b.firm,'tr')).map((o,i)=><tr key={o.id??`${o.firm}-${i}`}><td>{i+1}</td><td>{o.firm}</td><td>{o.model}</td><td>{businessLabel(o)}</td><td>{months[o.month-1]??'Ay eksik'}</td><td>{number(o.qty)}</td><td>{number(allocated.get(o) ?? 0)}</td></tr>),`${year} plan firma detayları`)}</>}
  </>;
}
