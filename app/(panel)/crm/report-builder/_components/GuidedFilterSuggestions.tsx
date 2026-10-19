'use client';
import { useEffect, useState } from 'react';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import styles from './ReportStudio.module.css';
export default function GuidedFilterSuggestions({dataset,field,search,onSelect}:{dataset:DatasetCatalogEntry;field:string;search:string;onSelect:(value:string)=>void}){
  const [values,setValues]=useState<string[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [limited,setLimited]=useState(false);
  const measure=dataset.measures[0]?.key;
  useEffect(()=>{
    const abort=new AbortController();let current=true;
    setValues([]);setError('');setLoading(true);
    const timer=setTimeout(()=>{
      void fetch('/api/report-builder/query',{method:'POST',signal:abort.signal,headers:{'content-type':'application/json'},body:JSON.stringify({definition:{dataset:dataset.key,measures:[measure],dimensions:[{field}],dateRange:dataset.defaultDateField?{type:'relative',preset:'this_year'}:undefined,filters:search.trim()?[{field,op:'contains',value:search.trim()}]:[],sort:[{field,dir:'asc'}],limit:100,visualization:{type:'table'}}})}).then(async response=>{
        if(!response.ok)throw new Error('Değer önerileri yüklenemedi. Yetki veya bağlantınızı kontrol edin; metin girerek devam edebilirsiniz.');
        const result=await response.json();if(!current)return;
        const column=result.columns?.find((c:{role:string;sourceField?:string})=>c.role==='dimension'&&c.sourceField===field)??result.columns?.find((c:{role:string})=>c.role==='dimension');
        setValues(column?[...new Set<string>((result.rows??[]).map((row:Record<string,unknown>)=>row[column.key]).filter((v:unknown):v is string=>typeof v==='string'&&!!v.trim()))]:[]);
        setLimited(Boolean(result.truncated)||result.rows?.length>=100);
      }).catch(e=>{if(current&&!abort.signal.aborted)setError(e instanceof Error?e.message:'Değer önerileri yüklenemedi.');}).finally(()=>{if(current)setLoading(false);});
    },300);
    return()=>{current=false;clearTimeout(timer);abort.abort();};
  },[dataset.key,dataset.defaultDateField,measure,field,search]);
  return <div className={styles.filterSuggestions} aria-label="Mevcut kayıtlardan değer önerileri"><small>{dataset.defaultDateField?'Bu yılki mevcut kayıtlardan':'Mevcut kayıtlardan'} seçin; bir değer seçmek koşulu “Eşittir” yapar. Metin yazarak da filtreleyebilirsiniz.</small>{loading?<small role="status">Değerler aranıyor…</small>:error?<small role="status">{error}</small>:<>{values.length?<div>{values.map(v=><button type="button" key={v} onClick={()=>onSelect(v)}>{v}</button>)}</div>:<small role="status">Eşleşen değer bulunamadı; metin girerek devam edebilirsiniz.</small>}{limited&&<small>İlk 100 değer gösteriliyor. Aramayı daraltın.</small>}</>}</div>;
}
