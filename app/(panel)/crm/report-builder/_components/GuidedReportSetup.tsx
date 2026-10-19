'use client';
import { useState } from 'react';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import { parsePageDefinition, type PageDefinition } from '@/lib/report-builder/page-types';
import { RELATIVE_PRESETS, parseReportDefinition, type ReportDefinition } from '@/lib/report-builder/types';
import { PRESET_LABEL } from './labels';
import styles from './ReportStudio.module.css';
import GuidedRecordFilters from './GuidedRecordFilters';
import { buildGuidedFilters, describeGuidedFilters, type GuidedFilterDraft } from './guided-record-filters';

type Section = { id:string; title: string; query: ReportDefinition };
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
  const [filters,setFilters]=useState<GuidedFilterDraft[]>([]);
  const [measureSearch,setMeasureSearch]=useState('');
  const [groupSearch,setGroupSearch]=useState('');
  const [currentId,setCurrentId]=useState(()=>crypto.randomUUID());
  const [tabs,setTabs]=useState(()=>[{id:'tab_'+crypto.randomUUID().replaceAll('-',''),label:'Genel bakış'}]);
  const [sectionTabs,setSectionTabs]=useState<Record<string,string>>({});
  const ds=datasets.find(d=>d.key===source)??datasets[0];
  if(!ds)return <p>Rapor kaynakları yükleniyor…</p>;
  const date=ds.dimensions.find(d=>d.key===ds.defaultDateField);
  const selected=measures.length?measures:ds.measures.slice(0,1).map(m=>m.key);
  const breakdown=groups??ds.dimensions.filter(d=>d.key==='customer').slice(0,1).map(d=>d.key);
  const dimensions=breakdown.map(field=>{const dim=ds.dimensions.find(d=>d.key===field)!;return {field,...(dim.type==='date'?{grain:dim.grains?.includes('month')?'month' as const:dim.grains?.[0]??'day' as const}:{})};});
  const monthlyExtra=monthly&&date?.grains?.includes('month')&&!breakdown.includes(date.key);
  if(monthlyExtra)dimensions.push({field:date!.key,grain:'month'});
  const recordFilters=buildGuidedFilters(filters,ds);
  const layoutValid=selected.length>0&&dimensions.length<=12&&(view!=='pivot'||(dimensions.length>=2&&selected.length===1));
  const valid=layoutValid&&!recordFilters.error;
  const matchingMeasures=ds.measures.filter(m=>`${m.label} ${m.description??''}`.toLocaleLowerCase('tr').includes(measureSearch.toLocaleLowerCase('tr')));
  const matchingGroups=ds.dimensions.filter(d=>d.group!=='Kayıt bağlantıları'&&`${d.label} ${d.description??''} ${d.group??''}`.toLocaleLowerCase('tr').includes(groupSearch.toLocaleLowerCase('tr')));
  const current=():Section=>({id:currentId,title:sectionTitle.trim()||ds.label,query:parseReportDefinition({dataset:ds.key,measures:selected,dimensions,filters:recordFilters.filters,dateRange:date?{type:'relative',preset:period}:undefined,visualization:{type:view,...(view==='pivot'?{pivotColumn:dimensions[dimensions.length-1]?.field}:{})}})});
  const add=()=>{if(!valid||sections.length>=11)return;setSections([...sections,current()]);setCurrentId(crypto.randomUUID());setMeasures([]);setGroups(null);setFilters([]);setMeasureSearch('');setGroupSearch('');setSectionTitle('');setMonthly(false);setPeriod('this_year');setView('table');setStep(1);};
  const placementSections=[...sections,{id:currentId,title:sectionTitle.trim()||ds.label}];
  const tabFor=(id:string)=>tabs.some(t=>t.id===sectionTabs[id])?sectionTabs[id]:tabs[0].id;
  const usedTabs=tabs.filter(tab=>placementSections.some(section=>tabFor(section.id)===tab.id));
  const placementValid=!tabbed||(usedTabs.every(tab=>!!tab.label.trim())&&new Set(usedTabs.map(tab=>tab.label.trim().toLocaleLowerCase('tr'))).size===usedTabs.length);
  const create=()=>{
    if(!valid||!placementValid)return;
    const all=[...sections,current()];
    const widgets:unknown[]=[];
    if(tabbed)widgets.push({id:'sections',type:'tabs',tabs:usedTabs.map(tab=>({key:tab.id,label:tab.label.trim()})),layout:{lg:{x:0,y:0,w:12,h:1}}});
    const positions:Record<string,number>={};
    all.forEach((s,i)=>{const tab=tabbed?tabFor(s.id):undefined;const group=tab??'page';const position=positions[group]??0;positions[group]=position+1;const y=(tabbed?1:0)+position*11;widgets.push({id:`summary_${i}`,type:'kpi_strip',tab,title:`${s.title} · toplamlar`,ignorePageFilters:true,query:{...s.query,dimensions:[],visualization:{type:'kpi'}},layout:{lg:{x:0,y,w:12,h:3}}},{id:`details_${i}`,type:s.query.visualization.type,tab,title:s.title,ignorePageFilters:true,query:s.query,layout:{lg:{x:0,y:y+3,w:12,h:8}}});});
    onCreate(parsePageDefinition({version:1,title:title.trim()||'Yeni rapor',navigation:{enabled:true},widgets}));
  };
  const describe=(section:Section)=>{const source=datasets.find(d=>d.key===section.query.dataset);return `${source?.label??'Rapor konusu'} · ${section.query.measures.map(k=>source?.measures.find(m=>m.key===k)?.label??'Seçili rakam').join(', ')} · ${section.query.dimensions.map(d=>source?.dimensions.find(dim=>dim.key===d.field)?.label??'Seçili alan').join(', ')} · ${section.query.dateRange?.type==='relative'?PRESET_LABEL[section.query.dateRange.preset]:'Dönemsiz'}`;};
  const filterSummary=(section:Section)=>{const lines=describeGuidedFilters(section.query.filters,datasets.find(d=>d.key===section.query.dataset));return lines.length?<ul className={styles.recordFilterSummary}>{lines.map((line,i)=><li key={i}>{line}</li>)}</ul>:<p>Kayıt filtresi yok; yetkiniz dahilindeki tüm kayıtlar.</p>;};
  const reorderGroup=(index:number,delta:number)=>{const ordered=dimensions.map(d=>d.field);const target=index+delta;if(target<0||target>=ordered.length)return;[ordered[index],ordered[target]]=[ordered[target],ordered[index]];setGroups(ordered);setMonthly(false);};
  const removeGroup=(field:string)=>{setGroups(dimensions.filter(d=>d.field!==field).map(d=>d.field));setMonthly(false);};
  const groupOrder=<div className={styles.guidedGroupOrder}><strong>Seçili kırılımlar · gösterim sırası</strong>{dimensions.length?<ol>{dimensions.map((dimension,i)=><li key={dimension.field}><span>{ds.dimensions.find(d=>d.key===dimension.field)?.label??'Seçili alan'}{dimension.grain==='month'?' · ay bazında':''}</span><div><button type="button" aria-label={`${i+1}. kırılımı yukarı taşı`} disabled={i===0} onClick={()=>reorderGroup(i,-1)}>Yukarı</button><button type="button" aria-label={`${i+1}. kırılımı aşağı taşı`} disabled={i===dimensions.length-1} onClick={()=>reorderGroup(i,1)}>Aşağı</button><button type="button" aria-label={`${i+1}. kırılımı kaldır`} onClick={()=>removeGroup(dimension.field)}>Kaldır</button></div></li>)}</ol>:<p>Kırılım seçilmedi; yalnız toplamlar gösterilir.</p>}{view==='pivot'&&dimensions.length>0&&<p>Çapraz tablonun sütunları: <strong>{ds.dimensions.find(d=>d.key===dimensions[dimensions.length-1].field)?.label??'Son seçili alan'}</strong>. Sıralamayı değiştirerek sütuna açılacak alanı seçebilirsiniz.</p>}</div>;
  const placementUI=<section className={styles.guidedPlacement} aria-label="Sekme ve bölüm yerleşimi">
    <label className={styles.field}>Sayfa düzeni<select aria-label="Sayfa düzeni" value={tabbed?'tabs':'blocks'} onChange={e=>setTabbed(e.target.value==='tabs')}><option value="blocks">Tek sayfada bölümler</option><option value="tabs">Sekmeli sayfa</option></select></label>
    {tabbed&&<>
      <p>Sekme bir başlıktır; altında birden fazla bölüm bulunabilir. Her bölüm kendi özet kartları ve ayrıntı tablosuyla birlikte taşınır.</p>
      <div className={styles.guidedTabEditors}>{tabs.map((tab,i)=><div key={tab.id}><label className={styles.field}>Sekme {i+1} adı<input value={tab.label} maxLength={60} onChange={e=>setTabs(tabs.map(t=>t.id===tab.id?{...t,label:e.target.value}:t))}/></label><button type="button" disabled={tabs.length===1} aria-label={`${i+1}. sekmeyi kaldır`} onClick={()=>setTabs(tabs.filter(t=>t.id!==tab.id))}>Sekmeyi kaldır</button></div>)}</div>
      <button type="button" disabled={tabs.length>=12} onClick={()=>setTabs([...tabs,{id:'tab_'+crypto.randomUUID().replaceAll('-',''),label:`Sekme ${tabs.length+1}`}])}>Sekme ekle</button>
      <p>En fazla 12 sekme. Bölüm atanmayan boş sekmeler rapora eklenmez.</p>
      <div className={styles.guidedSectionDestinations}>{placementSections.map((section,i)=><label key={section.id} className={styles.field}>{section.title} · hedef sekme<select aria-label={`${i+1}. bölümün hedef sekmesi`} value={tabFor(section.id)} onChange={e=>setSectionTabs({...sectionTabs,[section.id]:e.target.value})}>{tabs.map((tab,j)=><option key={tab.id} value={tab.id}>{tab.label.trim()||`${j+1}. sekme (adı eksik)`}</option>)}</select></label>)}</div>
      {!placementValid&&<p role="alert">Kullanılan sekmelere birbirinden farklı, boş olmayan adlar verin.</p>}
    </>}
    <div className={styles.guidedPlacementTree} aria-label="Rapor yerleşim önizlemesi"><strong>Oluşacak raporun yapısı</strong>
      {(tabbed?usedTabs:[{id:'page',label:'Tek sayfa'}]).map(tab=><div key={tab.id}><h4>{tab.label.trim()||'Adı eksik sekme'}</h4><ul>{placementSections.filter(section=>!tabbed||tabFor(section.id)===tab.id).map(section=><li key={section.id}><strong>{section.title}</strong><ul><li>{section.title} · özet kartları</li><li>{section.title} · ayrıntı tablosu</li></ul></li>)}</ul></div>)}
    </div>
  </section>;
  return <div className={styles.settingsForm}>
    <nav aria-label="Rapor oluşturma adımları" className={styles.guideSteps}>{['Konu ve rakamlar','Kırılımlar ve görünüm','Bölümleri gözden geçir'].map((label,i)=><span key={label} aria-current={step===i+1?'step':undefined}>{i+1}. {label}</span>)}</nav>
    {step===1&&<><h3>Raporunuzun bölümlerini oluşturun</h3><label className={styles.field}>Raporun adı<input value={title} maxLength={120} placeholder="Raporunuza bir ad verin" onChange={e=>setTitle(e.target.value)}/></label><label className={styles.field}>Bölümün adı<input value={sectionTitle} maxLength={120} placeholder={ds.label} onChange={e=>setSectionTitle(e.target.value)}/></label><label className={styles.field}>Konu<select aria-label="Konu" value={ds.key} onChange={e=>{setSource(e.target.value);setMeasures([]);setGroups(null);setFilters([]);setMeasureSearch('');setGroupSearch('');setMonthly(false);setPeriod('this_year');setView('table');}}>{datasets.map(d=><option key={d.key} value={d.key}>{d.label}</option>)}</select><small>{ds.description}</small></label><fieldset><legend>Hangi rakamlar görünsün? ({selected.length}/12 seçili)</legend><p>Seçili rakamlar: {selected.map(key=>ds.measures.find(m=>m.key===key)?.label??'Seçili rakam').join(', ')}</p><label className={styles.field}>Rakamlarda ara<input type="search" value={measureSearch} onChange={e=>setMeasureSearch(e.target.value)} placeholder="Rakam adı veya açıklaması"/></label>{!matchingMeasures.length&&<p role="status">Aramanıza uygun rakam bulunamadı. Seçimleriniz korunur.</p>}<div className={styles.guideChoices}>{matchingMeasures.map(m=><label className={styles.check} key={m.key}><input type="checkbox" checked={selected.includes(m.key)} disabled={selected.includes(m.key)?selected.length===1:selected.length>=12} onChange={e=>setMeasures(e.target.checked?[...selected,m.key]:selected.filter(k=>k!==m.key))}/>{m.label}</label>)}</div></fieldset></>}
    {step===2&&<><h3>Bu bölümü nasıl inceleyelim?</h3><p>{dimensions.length}/12 kırılım seçili. Her bölümün konusu ve dönemi ayrı tutulur.</p><label className={styles.field}>Kırılımlarda ara<input type="search" value={groupSearch} onChange={e=>setGroupSearch(e.target.value)} placeholder="Alan adı, açıklaması veya grubu"/></label>{!matchingGroups.length&&<p role="status">Aramanıza uygun kırılım bulunamadı. Seçimleriniz korunur.</p>}<div className={styles.guideChoices}>{matchingGroups.map(d=><label className={styles.check} key={d.key}><input type="checkbox" checked={breakdown.includes(d.key)} disabled={!breakdown.includes(d.key)&&dimensions.length>=12&&!(monthlyExtra&&d.key===date?.key)} onChange={e=>setGroups(e.target.checked?[...breakdown,d.key]:breakdown.filter(k=>k!==d.key))}/>{d.label}{d.group&&<small className={styles.guideGroupLabel}>{d.group}</small>}</label>)}</div>{groupOrder}{date&&<><label className={styles.field}>Hangi dönem?<select aria-label="Hangi dönem?" value={period} onChange={e=>setPeriod(e.target.value)}>{RELATIVE_PRESETS.filter(p=>!['performance_comparison','actual_forecast'].includes(ds.key)||['this_month','last_month','this_quarter','last_quarter','this_year','last_year'].includes(p)).map(p=><option key={p} value={p}>{PRESET_LABEL[p]??p}</option>)}</select></label>{date.grains?.includes('month')&&<label className={styles.check}><input type="checkbox" checked={monthly} disabled={!monthly&&breakdown.length>=12&&!breakdown.includes(date.key)} onChange={e=>setMonthly(e.target.checked)}/>Ay ay ayrıntı göster</label>}</>}<label className={styles.field}>Görünüm<select aria-label="Görünüm" value={view} onChange={e=>setView(e.target.value as 'table'|'pivot')}><option value="table">Tablo</option><option value="pivot">Çapraz tablo</option></select></label>{!layoutValid&&<p role="status">Çapraz tablo için en az iki kırılım ve tek rakam seçin. Son kırılım sütunlarda gösterilir.</p>}<GuidedRecordFilters key={ds.key} dataset={ds} value={filters} onChange={setFilters} error={recordFilters.error}/></>}
    {step===3&&<><h3>Bölümleri gözden geçirin</h3>{placementUI}{sections.map((s,i)=><div key={i}><strong>{s.title}</strong><p>{describe(s)}</p>{filterSummary(s)}<button onClick={()=>setSections(sections.filter((_,index)=>index!==i))}>Bölümü kaldır</button></div>)}<strong>{sectionTitle.trim()||ds.label} · yeni bölüm</strong>{valid?<><p>{describe(current())}</p>{filterSummary(current())}</>:<p role="alert">{recordFilters.error??'Bölüm ayarlarını tamamlayın.'}</p>}<p>Her bölüm kendi dönemine göre özet kartları ve ayrıntılarıyla açılır.</p><button disabled={!valid||sections.length>=11} onClick={add}>Başka bölüm ekle</button>{sections.length>=11&&<p>En fazla 12 bölüm oluşturabilirsiniz.</p>}</>}
    <div className={styles.headerActions}>{step>1&&<button onClick={()=>setStep(s=>s-1)}>Geri</button>}{step<3?<button className={styles.primary} disabled={step===2&&!valid} onClick={()=>setStep(s=>s+1)}>Devam et</button>:<button className={styles.primary} disabled={!valid||!placementValid} onClick={create}>Raporumu oluştur</button>}</div>
  </div>;
}

