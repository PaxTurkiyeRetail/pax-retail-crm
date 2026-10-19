'use client';

import { useState } from 'react';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import { parsePageDefinition, type PageDefinition } from '@/lib/report-builder/page-types';
import { getPageTemplate } from '@/lib/report-builder/templates';
import { RELATIVE_PRESETS } from '@/lib/report-builder/types';
import { PRESET_LABEL } from './labels';
import styles from './ReportStudio.module.css';

export default function GuidedReportSetup({datasets,onCreate}:{datasets:DatasetCatalogEntry[];onCreate:(page:PageDefinition)=>void}) {
  const [step,setStep]=useState(1);
  const [source,setSource]=useState('sale_items');
  const [measures,setMeasures]=useState<string[]>([]);
  const [groups,setGroups]=useState<string[]>([]);
  const [title,setTitle]=useState('');
  const [period,setPeriod]=useState('this_year');
  const [monthly,setMonthly]=useState(false);
  const ds=datasets.find(d=>d.key===source)??datasets[0];
  if(!ds)return <p>Rapor kaynakları yükleniyor…</p>;
  const date=ds.dimensions.find(d=>d.key===ds.defaultDateField);
  const selected=measures.length?measures:[ds.measures.find(m=>m.key==='device_quantity'||m.key==='device_count'||m.key==='quantity')?.key??ds.measures[0]?.key].filter(Boolean) as string[];
  const breakdown=groups.length?groups:[ds.dimensions.find(d=>d.key==='product_code'||d.key==='customer')?.key??ds.dimensions[0]?.key].filter(Boolean) as string[];
  const orderedGroups=[...ds.dimensions].sort((a,b)=>(['product_code','customer','owner','sale_date'].includes(a.key)?['product_code','customer','owner','sale_date'].indexOf(a.key):99)-(['product_code','customer','owner','sale_date'].includes(b.key)?['product_code','customer','owner','sale_date'].indexOf(b.key):99));
  const create=()=>{
    const dimensions=breakdown.map(field=>({field,...(ds.dimensions.find(d=>d.key===field)?.type==='date'?{grain:'month' as const}:{})}));
    if(monthly&&date&&!dimensions.some(d=>d.field===date.key)&&dimensions.length<12)dimensions.push({field:date.key,grain:'month'});
    const query={dataset:ds.key,measures:selected,dimensions,dateRange:date?{type:'relative',preset:period}:undefined,visualization:{type:'table'}};
    onCreate(parsePageDefinition({version:1,title:title.trim()||`${ds.label} raporum`,navigation:{enabled:true},filters:date?[{key:'period',label:'Dönem',kind:'date_range',defaultValue:period}]:[],widgets:[{id:'summary',type:'kpi_strip',title:'Genel toplam',query:{...query,dimensions:[],visualization:{type:'kpi'}},layout:{lg:{x:0,y:0,w:12,h:3}}},{id:'details',type:'table',title:'Detaylar',query,layout:{lg:{x:0,y:3,w:12,h:8}}}]}));
  };
  return <div className={styles.settingsForm}>
    <nav aria-label="Rapor oluşturma adımları" className={styles.guideSteps}>{['Ne görmek istiyorsunuz?','Nasıl inceleyelim?','Önizlemeye hazır'].map((label,i)=><span key={label} aria-current={step===i+1?'step':undefined}>{i+1}. {label}</span>)}</nav>
    {step===1&&<><div className={styles.kitCards}><button onClick={()=>{const p=getPageTemplate('retail_custom');if(p){p.navigation={enabled:true};onCreate(p);}}}><strong>Operasyon Paneli gibi sayfa oluştur</strong><small>Özetler, satış / model, Forecast, KasaPOS ve müşteri havuzu. Bölümleri ve kırılımları kendiniz düzenleyin.</small></button><button onClick={()=>{const p=getPageTemplate('kasapos_monthly');if(p){p.navigation={enabled:true};onCreate(p);}}}><strong>KasaPOS yönetim sayfası oluştur</strong><small>Müşteri × ay adet ve gelir tabloları, özetler ve operasyon durumu.</small></button></div><h3>Raporunuzun konusunu seçin</h3><p>İstediğiniz rakamları seçin. Alanları daha sonra da değiştirebilirsiniz.</p><label className={styles.field}>Konu<select aria-label="Konu" value={ds.key} onChange={e=>{setSource(e.target.value);setMeasures([]);setGroups([]);setMonthly(false);}}>{datasets.map(d=><option key={d.key} value={d.key}>{d.label}</option>)}</select><small>{ds.description}</small></label><fieldset><legend>Hangi rakamlar görünsün?</legend><div className={styles.guideChoices}>{ds.measures.map(m=><label className={styles.check} key={m.key}><input type="checkbox" checked={selected.includes(m.key)} disabled={selected.includes(m.key)?selected.length===1:selected.length>=12} onChange={e=>setMeasures(e.target.checked?[...selected,m.key]:selected.filter(k=>k!==m.key))}/>{m.label}</label>)}</div></fieldset></>}
    {step===2&&<><h3>Rakamları neye göre ayıralım?</h3><p>Örneğin model ve müşteri seçerek her müşteriye hangi modelden kaç adet satıldığını görebilirsiniz.</p><div className={styles.guideChoices}>{orderedGroups.map(d=><label className={styles.check} key={d.key}><input type="checkbox" checked={breakdown.includes(d.key)} disabled={breakdown.includes(d.key)?breakdown.length===1:breakdown.length>=12} onChange={e=>setGroups(e.target.checked?[...breakdown,d.key]:breakdown.filter(k=>k!==d.key))}/>{d.label}</label>)}</div>{date&&<><label className={styles.field}>Hangi dönem?<select value={period} onChange={e=>setPeriod(e.target.value)}>{RELATIVE_PRESETS.map(p=><option key={p} value={p}>{PRESET_LABEL[p]??p}</option>)}</select></label><label className={styles.check}><input type="checkbox" checked={monthly} disabled={breakdown.length>=12&&!breakdown.includes(date.key)} onChange={e=>setMonthly(e.target.checked)}/>Ay ay ayrıntı göster</label></>}</>}
    {step===3&&<><h3>Raporunuz hazır</h3><label className={styles.field}>Raporun adı<input value={title} maxLength={120} placeholder={`${ds.label} raporum`} onChange={e=>setTitle(e.target.value)}/></label><p><strong>Konu:</strong> {ds.label}</p><p><strong>Rakamlar:</strong> {selected.map(k=>ds.measures.find(m=>m.key===k)?.label).join(', ')}</p><p><strong>Kırılımlar:</strong> {breakdown.map(k=>ds.dimensions.find(d=>d.key===k)?.label).join(', ')}{monthly?' · Ay ay':''}</p><p>Özet kartları ve detay tablosu güncel verilerle açılacak. Önizlemeyi kontrol edip kaydedince rapor sol menüde yerini alacak.</p></>}
    <div className={styles.headerActions}>{step>1&&<button onClick={()=>setStep(s=>s-1)}>Geri</button>}{step<3?<button className={styles.primary} onClick={()=>setStep(s=>s+1)}>Devam et</button>:<button className={styles.primary} onClick={create}>Raporumu oluştur</button>}</div>
  </div>;
}
