'use client';
import { useMemo, useState } from 'react';
import type { RetailOperasyonPayload } from '@/lib/reports/retail-operasyon';
import { actualRetailAverage, actualRetailRevenue, allocateRetailScenario, businessLabel, isTerminal, projectRetail, retailModel } from '@/lib/reports/retail-projection';
import Table, { type RetailColumn } from './RetailTable';
import styles from './retail-operasyon.module.css';
const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const number = (n: number | null) => n == null ? '—' : n.toLocaleString('tr-TR',{maximumFractionDigits:0});
const money = (n: number | null) => n == null ? 'Fiyat eksik' : `${number(n)} $`;
const total = (n: number[]) => n.reduce((a,b)=>a+b,0);
const sumMoney = (values: Array<number | null>) => values.some(value => value == null) ? null : total(values as number[]);
type ModelGroup = ReturnType<typeof projectRetail>['groups'][number];
function groupTotal(rows: ModelGroup[]): ModelGroup {
  return {model:'TOPLAM',actualMonths:months.map((_,i)=>total(rows.map(r=>r.actualMonths[i]))),planMonths:months.map((_,i)=>total(rows.map(r=>r.planMonths[i]))),saleQty:total(rows.map(r=>r.saleQty)),leaseQty:total(rows.map(r=>r.leaseQty)),bankQty:total(rows.map(r=>r.bankQty)),salePrice:null,leasePrice:null,bankPrice:null,saleUsd:sumMoney(rows.map(r=>r.saleUsd)),leaseUsd:sumMoney(rows.map(r=>r.leaseUsd)),bankUsd:sumMoney(rows.map(r=>r.bankUsd))};
}
export default function RetailResults({data,year,pct,includeOpportunities=true}: {data:RetailOperasyonPayload;year:number;pct:number;includeOpportunities?:boolean}) {
  const current = year===data.year;
  const [finance,setFinance] = useState(false);
  const opportunities = useMemo(() => includeOpportunities ? current ? data.opportunities.current : data.opportunities.next : [], [includeOpportunities,current,data.opportunities]);
  const p = useMemo(()=>projectRetail(data.sales,opportunities,pct,current),[data.sales,opportunities,pct,current]);
  const allocated = useMemo(() => allocateRetailScenario(p.included,pct),[p.included,pct]);
  const actualUsd = current ? actualRetailRevenue(data.sales) : 0;
  const cards: Array<[string,string,string?]> = current ? [
    ['Gerçekleşen terminal',number(p.actualQty),'S210 dahil değil · sabit'],['Simüle edilen ek cihaz',number(p.planQty),'Seçilen gerçekleşme yüzdesi'],['Toplam terminal (senaryo)',number(p.actualQty+p.planQty)],['Gerçekleşen satış USD',money(actualUsd),'Satış raporu · değişmez'],
    ['Simüle edilen satış adedi',number(p.saleQty)],['Simüle edilen kiralama adedi',number(p.leaseQty)],['Simüle edilen banka adedi',number(p.bankQty),'Toplamda dahil · satış/kiralama dışında'],['Tahmini ek satış cirosu',money(p.saleUsd)],['Senaryo satış toplamı',money(p.saleUsd==null?null:actualUsd+p.saleUsd)],
  ] : [['Planlanan firma (CRM + projeksiyon)',number(new Set(p.included.map(o=>o.customerId??o.firm)).size)],['Toplam plan cihaz adedi',number(p.included.reduce((n,o)=>n+o.qty,0))],['Senaryolu sipariş toplamı',number(p.planQty),`%${pct} senaryosu`],['Satış cihaz',number(p.saleQty)],['Kiralama cihaz',number(p.leaseQty)],['Banka cihaz',number(p.bankQty),'Toplamda dahil · satış/kiralama dışında']];
  const modelFinance = [...new Set(data.sales.filter(s=>s.saleType!=='rental').map(s=>retailModel(s.model)))].map(model=>{const rows=data.sales.filter(s=>retailModel(s.model)===model&&s.saleType!=='rental');return {model,qty:rows.reduce((n,s)=>n+s.qty,0),usd:rows.reduce((n,s)=>n+s.usd,0),average:actualRetailAverage(rows),forecast:false};}).sort((a,b)=>b.usd-a.usd);
  const productRows = [...modelFinance,...(finance?p.groups.filter(g=>g.saleQty).map(g=>({model:`${g.model} · Forecast`,qty:g.saleQty,usd:g.saleUsd,average:g.salePrice,forecast:true})):[])];
  const rentalRows = [...(data.rental&&data.rental.activeQty>0?[{model:'Doğrulanmış aktif kiralama toplamı',qty:data.rental.activeQty,usd:data.rental.monthlyRevenue,average:data.rental.avgMonthlyPrice,forecast:false}]:[]),...(finance?p.groups.filter(g=>g.leaseQty).map(g=>({model:`${g.model} · Forecast`,qty:g.leaseQty,usd:g.leaseUsd,average:g.leasePrice,forecast:true})):[])];
  const recurring = data.kasapos.aylikGelir+(data.rental?.monthlyRevenue??0);
  const comparison = [
    {label:'Terminal adedi (S210 hariç)',kind:'qty',actual:p.actualQty,extra:finance?p.planQty:0,combined:p.actualQty+(finance?p.planQty:0)},
    {label:'Cihaz satış cirosu (USD)',kind:'money',actual:actualUsd,extra:finance?p.saleUsd:0,combined:finance&&p.saleUsd==null?null:actualUsd+(finance?p.saleUsd??0:0)},
    {label:'KasaPOS + kiralama düzenli aylık gelir (USD)',kind:'money',actual:recurring,extra:finance?p.leaseUsd:0,combined:finance&&p.leaseUsd==null?null:recurring+(finance?p.leaseUsd??0:0)},
  ];
  const monthlyColumns: RetailColumn<ModelGroup>[] = [
    {key:'model',label:'Model',value:g=>g.model},
    ...months.map((label,i):RetailColumn<ModelGroup>=>({key:`month-${i}`,label,num:true,value:g=>g.actualMonths[i]+g.planMonths[i],cellStyle:g=>g.model==='TOPLAM'?undefined:({background:g.actualMonths[i]?'#d8f6e3':g.planMonths[i]?'#fff0ce':undefined}),render:g=>g.model==='TOPLAM'?number(g.actualMonths[i]+g.planMonths[i]):g.actualMonths[i]&&g.planMonths[i]?<><span title="Gerçekleşen">{number(g.actualMonths[i])}</span><span title="Ek forecast" style={{display:'block',background:'#fff0ce'}}>+{number(g.planMonths[i])}</span></>:g.actualMonths[i]||g.planMonths[i]?number(g.actualMonths[i]+g.planMonths[i]):'—'})),
    {key:'total',label:'Toplam',num:true,value:g=>total(g.actualMonths)+total(g.planMonths)},...(current?[{key:'opportunities',label:'Fırsat',num:true,value:(g:ModelGroup)=>total(g.planMonths)}]:[]),
  ];
  const history=data.kasapos.monthly;
  const first=history[0],last=history.at(-1);
  return <>
    <div className={styles.grid}>{cards.map(([label,value,sub])=><div className={styles.metric} key={label}><div>{label}</div><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>)}</div>
    {current&&<Table title={`${year} · Senaryonun model bazlı satış / kiralama / banka sonucu`} name={`retail-${year}-model-sonuc`} rows={p.groups} summary={groupTotal} columns={[
      {key:'model',label:'Model',value:g=>g.model},{key:'sale',label:'Plan satış adedi',num:true,value:g=>g.saleQty},{key:'rental',label:'Plan kiralama adedi',num:true,value:g=>g.leaseQty},{key:'bank',label:'Plan banka adedi',num:true,value:g=>g.bankQty},
      {key:'price',label:'Satış ort. fiyatı',num:true,value:g=>g.salePrice,render:g=>g.model==='TOPLAM'?'—':money(g.salePrice)},{key:'usd',label:'Ek satış tutarı',num:true,value:g=>g.saleUsd,render:g=>money(g.saleUsd)},
    ]}/>}
    <div className={styles.note}>{current?'Yeşil = gerçekleşen · Sarı = kayıtlı ayındaki Forecast senaryosu. Gerçekleşenler sabit; fırsat olasılıkları kullanılmaz.':'Sarı = plan. Canlı Forecast kayıtları seçilen aylarda gösterilir.'}</div>
    <Table key={`monthly-${year}`} title={`${year} · Aylık ${current?'terminal adetleri':'cihaz sipariş planı'}`} name={`Retail_${year}_Aylik_Sonuc`} rows={p.groups} columns={monthlyColumns} summary={groupTotal}/>
    {current ? <>
      <label className={styles.actions}><input type="checkbox" checked={finance} onChange={e=>setFinance(e.target.checked)}/> Simülasyonu satış ve kiralama tablolarına dahil et</label>
      <Table title={`${year} · Gerçekleşen, Simülasyon ve Genel Toplam`} name={`retail-${year}-genel-toplam`} rows={comparison} columns={[
        {key:'label',label:'Gösterge',value:r=>r.label},
        ...([{key:'actual',label:'Gerçekleşen'},{key:'extra',label:'Simülasyon (ek)'},{key:'combined',label:'Genel toplam'}] as const).map(({key,label}):RetailColumn<typeof comparison[number]>=>({key,label,num:true,value:r=>r[key],render:r=>r.kind==='qty'?number(r[key]):money(r[key])})),
      ]}/>
      <div className={styles.note}>Satış cirosu ve düzenli aylık gelir ayrı göstergelerdir. Forecast fiyatı yoksa yalnızca USD satış adetleri üzerinden gerçekleşen model ortalaması kullanılır; döviz adedi bilinmeyen eski kayıtlardan fiyat türetilmez. Kiralama fiyatı bulunmayan planların geliri hesaplanmaz.</div>
      <div className={styles.two}>
        <Table title={`${year} cihaz / ürün satışları`} name={`retail-${year}-urun-satislari`} rows={productRows} rowStyle={r=>r.forecast?{background:'#fff9eb'}:undefined} columns={[
          {key:'model',label:'Model',value:r=>r.model,render:r=><>{r.model}{!r.forecast&&!isTerminal(r.model)?' (aksesuar)':''}</>},{key:'qty',label:'Adet',num:true,value:r=>r.qty},{key:'usd',label:'Satış tutarı (USD)',num:true,value:r=>r.usd,render:r=>money(r.usd)},{key:'average',label:'Ort. USD satış fiyatı',num:true,value:r=>r.average,render:r=>money(r.average)},
        ]}/>
        <Table title="Ödeme Sistemleri Altyapısı · Kiralama" name={`retail-${year}-kira-sonuc`} rows={rentalRows} rowStyle={r=>r.forecast?{background:'#fff9eb'}:undefined} columns={[
          {key:'model',label:'Model / firma',value:r=>r.model},{key:'qty',label:'Aktif / plan adet',num:true,value:r=>r.qty},{key:'usd',label:'Aylık gelir (USD)',num:true,value:r=>r.usd,render:r=>money(r.usd)},{key:'average',label:'Ort. aylık bedel (USD)',num:true,value:r=>r.average,render:r=>money(r.average)},
        ]}/>
      </div>
      <div className={styles.card}><h3>KasaPOS entegrasyon · aylık gerçekleşen</h3><div className={styles.grid}>{[['Son ay faturalanan kasa',number(last?.billed??null)],['Son ay aylık hizmet geliri',money(last?.usd??null)],['Dönem gelir artışı',first?.usd&&last?`${(last.usd/first.usd).toLocaleString('tr-TR',{maximumFractionDigits:2})} kat`:'—']].map(([label,value])=><div className={styles.metric} key={label}>{label}<strong>{value}</strong></div>)}</div>{(['billed','usd'] as const).map(key=><div key={key}><h4>{key==='billed'?'Faturalanan kasa adedi':'Aylık düzenli gelir (USD)'}</h4><div style={{display:'flex',gap:8,alignItems:'end',minHeight:145,overflowX:'auto'}}>{history.map(m=><div key={m.month} style={{flex:1,minWidth:42,textAlign:'center'}}><small>{key==='usd'?money(m[key]):number(m[key])}</small><div style={{height:Math.max(2,m[key]/Math.max(1,...history.map(x=>x[key]))*100),background:key==='usd'?'#9accc3':'#b2cdea',margin:'4px 12% 0',borderRadius:'4px 4px 0 0'}}/><small>{m.month}</small></div>)}</div></div>)}{!history.length&&<p>Aylık doğrulanmış veri bulunmuyor.</p>}</div>

    </> : <><p className={styles.note}>Senaryo adetleri model ve ay toplamı üzerinden firmalara dağıtılır; detay toplamı aylık tabloyla eşittir.</p>
      <Table title={`${year} plan firma detayları`} name={`retail-${year}-plan-detay`} rows={p.included.slice().sort((a,b)=>a.month-b.month||a.model.localeCompare(b.model,'tr')||a.firm.localeCompare(b.firm,'tr')).map((opportunity,index)=>({opportunity,index:index+1}))} columns={[
        {key:'index',label:'#',num:true,value:r=>r.index},{key:'firm',label:'Firma',value:r=>r.opportunity.firm},{key:'model',label:'Model',value:r=>r.opportunity.model},{key:'business',label:'İş modeli',value:r=>businessLabel(r.opportunity)},
        {key:'month',label:'Ay',value:r=>r.opportunity.month,filterValue:r=>months[r.opportunity.month-1]??'Ay eksik',render:r=>months[r.opportunity.month-1]??'Ay eksik'},{key:'qty',label:'Plan adedi',num:true,value:r=>r.opportunity.qty},{key:'scenario',label:'Senaryo adedi',num:true,value:r=>allocated.get(r.opportunity)??0},
      ]}/>
    </>}
  </>;
}
