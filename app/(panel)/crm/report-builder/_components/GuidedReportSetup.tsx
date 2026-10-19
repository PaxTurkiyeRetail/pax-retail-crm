'use client';
import { useState } from 'react';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import { parsePageDefinition, type PageDefinition } from '@/lib/report-builder/page-types';
import { RELATIVE_PRESETS, parseReportDefinition, type ReportDefinition } from '@/lib/report-builder/types';
import { PRESET_LABEL } from './labels';
import styles from './ReportStudio.module.css';

type Section = { title: string; query: ReportDefinition };
export default function GuidedReportSetup({datasets,onCreate}:{datasets:DatasetCatalogEntry[];onCreate:(page:PageDefinition)=>void}) {
  const [step,setStep]=useState(1);
  const [source,setSource]=useState(datasets[0]?.key??'');
  const [measures,setMeasures]=useState<string[]>([]);
  const [groups,setGroups]=useState<string[]|null>(null);
  const [title,setTitle]=useState('');
  const [sectionTitle,setSectionTitle]=useState('');
  const [period,setPeriod]=useState('this_year');
  const [monthly,setMonthly]=useState(false);
  const [view,setView]=useState<'table'|'pivot'>('table');
  const [sections,setSections]=useState<Section[]>([]);
  const [tabbed,setTabbed]=useState(false);
  const ds=datasets.find(d=>d.key===source)??datasets[0];
  if(!ds)return <p>Rapor kaynakları yükleniyor…</p>;
  const date=ds.dimensions.find(d=>d.key===ds.defaultDateField);
  const selected=measures.length?measures:ds.measures.slice(0,1).map(m=>m.key);
  const breakdown=groups??ds.dimensions.filter(d=>d.key==='customer').slice(0,1).map(d=>d.key);
  const dimensions=breakdown.map(field=>{const dim=ds.dimensions.find(d=>d.key===field)!;return {field,...(dim.type==='date'?{grain:dim.grains?.includes('month')?'month' as const:dim.grains?.[0]??'day' as const}:{})};});
  const monthlyExtra=monthly&&date?.grains?.includes('month')&&!breakdown.includes(date.key);
  if(monthlyExtra)dimensions.push({field:date!.key,grain:'month'});
  const valid=selected.length>0&&dimensions.length<=12&&(view!=='pivot'||(dimensions.length>=2&&selected.length===1));
  const current=():Section=>({title:sectionTitle.trim()||ds.label,query:parseReportDefinition({dataset:ds.key,measures:selected,dimensions,dateRange:date?{type:'relative',preset:period}:undefined,visualization:{type:view,...(view==='pivot'?{pivotColumn:dimensions[dimensions.length-1]?.field}:{})}})});
  const add=()=>{if(!valid||sections.length>=11)return;setSections([...sections,current()]);setMeasures([]);setGroups(null);setSectionTitle('');setMonthly(false);setPeriod('this_year');setView('table');setStep(1);};
  const create=()=>{
    if(!valid)return;
    const all=[...sections,current()];
    const widgets:unknown[]=[];
    if(tabbed&&all.length>1)widgets.push({id:'sections',type:'tabs',tabs:all.map((s,i)=>({key:`section_${i}`,label:s.title.slice(0,60)})),layout:{lg:{x:0,y:0,w:12,h:1}}});
    all.forEach((s,i)=>{const tab=tabbed&&all.length>1?`section_${i}`:undefined;const y=tabbed&&all.length>1?1:i*11;widgets.push({id:`summary_${i}`,type:'kpi_strip',tab,title:`${s.title} · toplamlar`,ignorePageFilters:true,query:{...s.query,dimensions:[],visualization:{type:'kpi'}},layout:{lg:{x:0,y,w:12,h:3}}},{id:`details_${i}`,type:s.query.visualization.type,tab,title:s.title,ignorePageFilters:true,query:s.query,layout:{lg:{x:0,y:y+3,w:12,h:8}}});});
    onCreate(parsePageDefinition({version:1,title:title.trim()||'Yeni rapor',navigation:{enabled:true},widgets}));
  };
  const describe=(section:Section)=>{const source=datasets.find(d=>d.key===section.query.dataset);return `${source?.label??section.query.dataset} · ${section.query.measures.map(k=>source?.measures.find(m=>m.key===k)?.label??k).join(', ')} · ${section.query.dimensions.map(d=>source?.dimensions.find(dim=>dim.key===d.field)?.label??d.field).join(', ')} · ${section.query.dateRange?.type==='relative'?PRESET_LABEL[section.query.dateRange.preset]:'Dönemsiz'}`;};
  return <div className={styles.settingsForm}>
    <nav aria-label="Rapor oluşturma adımları" className={styles.guideSteps}>{['Konu ve rakamlar','Kırılımlar ve görünüm','Bölümleri gözden geçir'].map((label,i)=><span key={label} aria-current={step===i+1?'step':undefined}>{i+1}. {label}</span>)}</nav>
    {step===1&&<><h3>Raporunuzun bölümlerini oluşturun</h3><label className={styles.field}>Raporun adı<input value={title} maxLength={120} placeholder="Raporunuza bir ad verin" onChange={e=>setTitle(e.target.value)}/></label><label className={styles.field}>Bölümün adı<input value={sectionTitle} maxLength={120} placeholder={ds.label} onChange={e=>setSectionTitle(e.target.value)}/></label><label className={styles.field}>Konu<select aria-label="Konu" value={ds.key} onChange={e=>{setSource(e.target.value);setMeasures([]);setGroups(null);setMonthly(false);}}>{datasets.map(d=><option key={d.key} value={d.key}>{d.label}</option>)}</select><small>{ds.description}</small></label><fieldset><legend>Hangi rakamlar görünsün?</legend><div className={styles.guideChoices}>{ds.measures.map(m=><label className={styles.check} key={m.key}><input type="checkbox" checked={selected.includes(m.key)} disabled={selected.includes(m.key)?selected.length===1:selected.length>=12} onChange={e=>setMeasures(e.target.checked?[...selected,m.key]:selected.filter(k=>k!==m.key))}/>{m.label}</label>)}</div></fieldset></>}
    {step===2&&<><h3>Bu bölümü nasıl inceleyelim?</h3><p>En fazla 12 kırılım seçin. Her bölümün konusu ve dönemi ayrı tutulur.</p><div className={styles.guideChoices}>{ds.dimensions.map(d=><label className={styles.check} key={d.key}><input type="checkbox" checked={breakdown.includes(d.key)} disabled={!breakdown.includes(d.key)&&dimensions.length>=12&&!(monthlyExtra&&d.key===date?.key)} onChange={e=>setGroups(e.target.checked?[...breakdown,d.key]:breakdown.filter(k=>k!==d.key))}/>{d.label}</label>)}</div>{date&&<><label className={styles.field}>Hangi dönem?<select aria-label="Hangi dönem?" value={period} onChange={e=>setPeriod(e.target.value)}>{RELATIVE_PRESETS.map(p=><option key={p} value={p}>{PRESET_LABEL[p]??p}</option>)}</select></label>{date.grains?.includes('month')&&<label className={styles.check}><input type="checkbox" checked={monthly} disabled={!monthly&&breakdown.length>=12&&!breakdown.includes(date.key)} onChange={e=>setMonthly(e.target.checked)}/>Ay ay ayrıntı göster</label>}</>}<label className={styles.field}>Görünüm<select aria-label="Görünüm" value={view} onChange={e=>setView(e.target.value as 'table'|'pivot')}><option value="table">Tablo</option><option value="pivot">Çapraz tablo</option></select></label>{!valid&&<p role="status">Çapraz tablo için en az iki kırılım ve tek rakam seçin. Son kırılım sütunlarda gösterilir.</p>}</>}
    {step===3&&<><h3>Bölümleri gözden geçirin</h3>{sections.length>0&&<label className={styles.field}>Sayfa düzeni<select aria-label="Sayfa düzeni" value={tabbed?'tabs':'blocks'} onChange={e=>setTabbed(e.target.value==='tabs')}><option value="blocks">Tek sayfada bölümler</option><option value="tabs">Sekmeli sayfa</option></select></label>}{sections.map((s,i)=><div key={i}><strong>{s.title}</strong><p>{describe(s)}</p><button onClick={()=>setSections(sections.filter((_,index)=>index!==i))}>Bölümü kaldır</button></div>)}<strong>{sectionTitle.trim()||ds.label} · yeni bölüm</strong><p>{describe(current())}</p><p>Her bölüm kendi dönemine göre özet kartları ve ayrıntılarıyla açılır.</p><button disabled={!valid||sections.length>=11} onClick={add}>Başka bölüm ekle</button>{sections.length>=11&&<p>En fazla 12 bölüm oluşturabilirsiniz.</p>}</>}
    <div className={styles.headerActions}>{step>1&&<button onClick={()=>setStep(s=>s-1)}>Geri</button>}{step<3?<button className={styles.primary} disabled={step===2&&!valid} onClick={()=>setStep(s=>s+1)}>Devam et</button>:<button className={styles.primary} disabled={!valid} onClick={create}>Raporumu oluştur</button>}</div>
  </div>;
}

