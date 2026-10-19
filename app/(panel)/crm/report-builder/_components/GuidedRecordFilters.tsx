'use client';
import { useState } from 'react';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import type { FilterOp } from '@/lib/report-builder/types';
import { emptyFilter, filterOperators, filterOptionLabel, FILTER_LABEL, type GuidedFilterDraft } from './guided-record-filters';
import styles from './ReportStudio.module.css';
import GuidedFilterSuggestions from './GuidedFilterSuggestions';
export default function GuidedRecordFilters({dataset,value,onChange,error}:{dataset:DatasetCatalogEntry;value:GuidedFilterDraft[];onChange:(value:GuidedFilterDraft[])=>void;error:string|null}){
  const [search,setSearch]=useState('');
  const fields=dataset.dimensions.filter(d=>d.group!=='Kayıt bağlantıları'&&`${d.label} ${d.description??''} ${d.group??''} ${d.options?.map(filterOptionLabel).join(' ')??''}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')));
  const groups=[...new Set(fields.map(d=>d.group??'Diğer alanlar'))];
  const update=(id:string,change:Partial<GuidedFilterDraft>)=>onChange(value.map(f=>f.id===id?{...f,...change}:f));
  return <fieldset className={styles.recordFilters}><legend>Hangi kayıtlar dahil edilsin? ({value.length}/20)</legend><p>Filtreler yalnız bu bölümü etkiler. Birden fazla filtre eklerseniz kayıtların <strong>tüm koşulları</strong> sağlaması gerekir (VE). “Seçilenlerden biri” işaretlediğiniz değerlerden herhangi birini dahil eder; “Seçilenler dışında” işaretlenenlerin tamamını dışarıda tutar.</p>
    <label className={styles.field}>Filtre alanlarında ara<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Alan adı, açıklama veya grup"/></label>
    {search&&!fields.length&&<p role="status">Aramanıza uygun alan bulunamadı. Seçili filtreler korunur.</p>}
    {value.map((filter,index)=>{const dim=dataset.dimensions.find(d=>d.key===filter.field);const noValue=['is_null','not_null'].includes(filter.op);const shown=dim&&!fields.some(d=>d.key===dim.key)?[dim,...fields]:fields;return <div className={styles.recordFilterCard} key={filter.id}>
      <div className={styles.recordFilterHeading}><strong>Filtre {index+1}</strong><button type="button" onClick={()=>onChange(value.filter(f=>f.id!==filter.id))}>Filtreyi kaldır</button></div>
      <div className={styles.recordFilterGrid}><label className={styles.field}>Filtre {index+1} alanı<select aria-label={`Filtre ${index+1} alanı`} value={filter.field} onChange={e=>{const next=dataset.dimensions.find(d=>d.key===e.target.value);update(filter.id,{...emptyFilter(e.target.value,next),id:filter.id});}}><option value="">Alan seçin</option>{dim&&!fields.some(d=>d.key===dim.key)&&<option value={dim.key}>{dim.label} (seçili)</option>}{groups.map(group=><optgroup key={group} label={group}>{shown.filter(d=>(d.group??'Diğer alanlar')===group&&fields.some(f=>f.key===d.key)).map(d=><option key={d.key} value={d.key}>{d.label}</option>)}</optgroup>)}</select></label>
      {dim&&<label className={styles.field}>Filtre {index+1} koşulu<select aria-label={`Filtre ${index+1} koşulu`} value={filter.op} onChange={e=>update(filter.id,{op:e.target.value as FilterOp})}>{filterOperators(dim).map(op=><option key={op} value={op}>{FILTER_LABEL[op]}</option>)}</select></label>}</div>
      {dim?.description&&<small>{dim.description}</small>}
      {dim&&!noValue&&(dim.options?.length?<div className={styles.recordFilterOptions} role="group" aria-label={`Filtre ${index+1} değerleri`}>{dim.options.map(option=><label className={styles.check} key={option}><input type="checkbox" checked={filter.selected.includes(option)} onChange={e=>update(filter.id,{selected:e.target.checked?[...filter.selected,option]:filter.selected.filter(v=>v!==option)})}/>{filterOptionLabel(option)}</label>)}</div>:dim.type==='boolean'?<label className={styles.field}>Filtre {index+1} değeri<select aria-label={`Filtre ${index+1} değeri`} value={filter.value} onChange={e=>update(filter.id,{value:e.target.value})}><option value="true">Evet</option><option value="false">Hayır</option></select></label>:<div className={styles.recordFilterGrid}><label className={styles.field}>Filtre {index+1} {filter.op==='between'?'başlangıç değeri':'değeri'}<input type={dim.type==='date'?'date':dim.type==='number'?'number':'text'} step={dim.type==='number'?'any':undefined} maxLength={500} value={filter.value} onChange={e=>update(filter.id,{value:e.target.value})}/></label>{filter.op==='between'&&<label className={styles.field}>Filtre {index+1} bitiş değeri<input type={dim.type==='date'?'date':'number'} step={dim.type==='number'?'any':undefined} value={filter.value2} onChange={e=>update(filter.id,{value2:e.target.value})}/></label>}</div>)}
      {dim?.type==='string'&&!dim.options?.length&&!noValue&&<GuidedFilterSuggestions dataset={dataset} field={dim.key} search={filter.value} onSelect={selected=>update(filter.id,{value:selected,op:'eq'})}/>}
    </div>;})}
    {error&&<p role="alert" className={styles.recordFilterError}>{error}</p>}
    <button type="button" disabled={value.length>=20} onClick={()=>onChange([...value,emptyFilter()])}>Kayıt filtresi ekle</button>
  </fieldset>;
}
