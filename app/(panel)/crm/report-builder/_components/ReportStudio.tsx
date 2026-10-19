'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, ChevronRight, Copy, FileDown, LayoutGrid, ListOrdered, Loader2, PanelTop, Plus, RefreshCw, Save, Settings2, Share2, Table2, Trash2, Type, X } from 'lucide-react';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import { applyPageFilters, COLOR_TOKENS, isDataWidget, parsePageDefinition, resolveDepartment, type DataWidget, type PageDefinition, type PageWidget } from '@/lib/report-builder/page-types';
import { DEPARTMENT_VALUES, RELATIVE_PRESETS, ReportDefinitionError, reportDefinitionSchema, type ReportDefinitionInput, type VizType } from '@/lib/report-builder/types';
import type { WidgetData } from '@/lib/report-builder/pdf';
import { api, ApiFailure, downloadCsv, type LetterheadLite, type SavedPageLite } from './api';
import QueryBuilder from './QueryBuilder';
import GuidedReportSetup from './GuidedReportSetup';
import ConditionalFormattingEditor,{COLOR_NAMES} from './ConditionalFormattingEditor';
import ReportPdfPreview from '@/components/report-builder/ReportPdfPreview';
import { DrilldownPanel } from './DrilldownPanel';
import ReportDataInfo from './ReportDataInfo';
import ReportSnapshotPanel from './ReportSnapshotPanel';
import ReportAutomationPanel from '@/components/report-builder/ReportAutomationPanel';
import { DataWidgetBody, TextBlock } from './renderers/WidgetRenderer';
import { DEPARTMENT_LABEL, PRESET_LABEL } from './labels';
import styles from './ReportStudio.module.css';

type Props = { datasets: DatasetCatalogEntry[]; letterheads: LetterheadLite[]; canDesign: boolean; pageId?: string; liveView?: boolean; currentUserId?: string; onClose: () => void; onSaved: () => void };
type Notice = { kind: 'error' | 'success'; text: string };
const uid = () => `b_${crypto.randomUUID().replaceAll('-','').slice(0,24)}`;
const blank = () => parsePageDefinition({ version: 1, title: 'Yeni özel rapor', subtitle: '', filters: [{key:'period',label:'Dönem',kind:'date_range'}], widgets: [], pdf: {orientation:'landscape'} });
const widgetLabels: Partial<Record<PageWidget['type'],string>> = {table:'Tablo',pivot:'Aylık pivot',kpi_strip:'KPI şeridi',bar:'Sütun grafik',line:'Çizgi grafik',pie:'Pasta grafik',heatmap:'Isı tablosu',text:'Metin / bölüm',tabs:'Sekmeler'};
const palette: PageWidget['type'][] = ['table','pivot','kpi_strip','pie','heatmap','text','tabs'];
const roles = [{key:'super_admin',label:'Süper yönetici'},{key:'admin',label:'Yönetici'},{key:'account_manager',label:'Account manager'},{key:'itsm',label:'ITSM'},{key:'user',label:'Kullanıcı'}];
const errorText = (e: unknown) => e instanceof ReportDefinitionError ? [e.message,...e.issues].join(' · ') : e instanceof ApiFailure ? [e.message,...(e.details??[])].join(' · ') : e instanceof Error ? e.message : 'İşlem tamamlanamadı';

/** Keep saved grid layout in the same order as the studio outline. */
function arrange(widgets: PageWidget[]) {
  let x=0,y=0,rowHeight=0;
  return widgets.map(widget=>{
    const w=widget.layout.lg.w,h=widget.layout.lg.h;
    if(x+w>12){y+=rowHeight;x=0;rowHeight=0;}
    const next={...widget,layout:{lg:{x,y,w,h}}};
    x+=w;rowHeight=Math.max(rowHeight,h);
    if(x===12){y+=rowHeight;x=0;rowHeight=0;}
    return next;
  });
}

function defaultQuery(dataset: DatasetCatalogEntry, type: PageWidget['type']): ReportDefinitionInput {
  const date=dataset.dimensions.find(d=>d.key===dataset.defaultDateField)??dataset.dimensions.find(d=>d.type==='date');
  const row=dataset.dimensions.find(d=>d.key==='customer')??dataset.dimensions.find(d=>d.type==='string');
  const viz: VizType=type==='kpi_strip'?'kpi':type as VizType;
  const dims: NonNullable<ReportDefinitionInput['dimensions']> = [];
  if(type==='pivot'||type==='heatmap'){
    if(row)dims.push({field:row.key});
    if(date&&date.key!==row?.key)dims.push({field:date.key,grain:date.grains?.includes('month')?'month':date.grains?.[0]});
    if(dims.length<2){const other=dataset.dimensions.find(d=>!dims.some(x=>x.field===d.key));if(other)dims.push({field:other.key});}
  }else if(type!=='kpi'&&type!=='kpi_strip'){
    const dimension=type==='pie'?row:date??row;
    if(dimension)dims.push({field:dimension.key,...(dimension.type==='date'?{grain:dimension.grains?.includes('month')?'month' as const:dimension.grains?.[0]}:{})});
  }
  const measure=dataset.measures.find(m=>m.key==='quantity')??dataset.measures.find(m=>m.key==='device_count')??dataset.measures[0];
  return {dataset:dataset.key,measures:measure?[measure.key]:[],dimensions:dims,filters:[],calculated:[],sort:[],compare:'none',limit:500,visualization:{type:viz,...((type==='pivot'||type==='heatmap')&&dims.length?{pivotColumn:dims[dims.length-1].field}:{})}};
}

function Modal({title,onClose,children}: {title:string;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const before=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const node=ref.current;
    const focusables=()=>Array.from(node?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')??[]).filter(el=>el.offsetParent!==null);
    focusables()[0]?.focus();
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){const list=focusables(),first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    node?.addEventListener('keydown',onKey);
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{node?.removeEventListener('keydown',onKey);document.body.style.overflow=previous;before?.focus();};
  },[onClose]);
  return <div className={styles.backdrop}><div ref={ref} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="studio-dialog-title"><header><h2 id="studio-dialog-title">{title}</h2><button type="button" onClick={onClose} aria-label="Pencereyi kapat"><X size={18}/></button></header><div className={styles.modalBody}>{children}</div></div></div>;
}

function StudioDataStyle({widget,dataset,data,editable,onChange}:{widget:DataWidget;dataset?:DatasetCatalogEntry;data?:WidgetData;editable:boolean;onChange:(fn:(w:PageWidget)=>void)=>void}){
  const fallback=[...widget.query.dimensions.map(d=>({key:`d_${d.field}${d.grain&&d.grain!=='day'?`_${d.grain}`:''}`,label:dataset?.dimensions.find(f=>f.key===d.field)?.label??d.field})),...widget.query.measures.map(m=>({key:`m_${m}`,label:dataset?.measures.find(f=>f.key===m)?.label??m})),...widget.query.calculated.map(c=>({key:`c_${c.key}`,label:c.label}))];
  const fields=data?.result?.columns??fallback;
  const changeColumn=(key:string,patch:Partial<DataWidget['style']['columns'][number]>)=>onChange(w=>{const found=w.style.columns.find(c=>c.key===key);if(found)Object.assign(found,patch);else w.style.columns.push({key,...patch});});
  return <div className={styles.displaySettings}>
    <label className={styles.check}><input type="checkbox" checked={widget.ignorePageFilters} disabled={!editable} onChange={e=>onChange(w=>{if(isDataWidget(w))w.ignorePageFilters=e.target.checked;})}/>Rapor filtrelerinden bağımsız çalıştır</label>
    <details><summary>Sütun adları ve biçimleri <span>{fields.length}</span></summary><div className={styles.detailContent}>{fields.map(field=>{const column=widget.style.columns.find(c=>c.key===field.key);return <div className={styles.columnCard} key={field.key}><strong>{field.label}</strong><input aria-label={`${field.label} görünen adı`} placeholder={field.label} maxLength={200} value={column?.label??''} disabled={!editable} onChange={e=>changeColumn(field.key,{label:e.target.value})}/><div><select aria-label={`${field.label} biçimi`} disabled={!editable} value={column?.format??''} onChange={e=>changeColumn(field.key,{format:(e.target.value||undefined) as 'number'|'money'|'percent'|'compact'|undefined})}><option value="">Alan biçimi</option><option value="number">Sayı</option><option value="money">Para</option><option value="percent">Yüzde</option><option value="compact">Kısa sayı</option></select><label className={styles.check}><input type="checkbox" checked={column?.hidden??false} disabled={!editable} onChange={e=>changeColumn(field.key,{hidden:e.target.checked})}/>Gizle</label>{/^[mc]_/.test(field.key)&&<label className={styles.check}><input type="checkbox" checked={column?.dataBar??false} disabled={!editable} onChange={e=>changeColumn(field.key,{dataBar:e.target.checked})}/>Veri çubuğu</label>}</div></div>;})}</div></details>
    <ConditionalFormattingEditor key={widget.id} fields={fields} rules={widget.style.conditional} disabled={!editable} onChange={rules=>onChange(w=>{w.style.conditional=rules;})}/>
  </div>;
}

export default function ReportStudio({datasets,letterheads,canDesign,pageId,liveView=false,currentUserId,onClose,onSaved}:Props){
  const [page,setPage]=useState<PageDefinition>(blank);
  const [meta,setMeta]=useState<SavedPageLite|null>(null);
  const [savedId,setSavedId]=useState<string|undefined>(pageId);
  const [loading,setLoading]=useState(!!pageId);
  const [selected,setSelected]=useState<string|null>(null);
  const [source,setSource]=useState(datasets.find(d=>d.key==='sales')?.key??datasets[0]?.key??'');
  const [sourceSearch,setSourceSearch]=useState('');
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState<'save'|'pdf'|'delete'|null>(null);
  const [running,setRunning]=useState(false);
  const [notice,setNotice]=useState<Notice|null>(null);
  const [data,setData]=useState<Record<string,WidgetData>>({});
  const [values,setValues]=useState<Record<string,unknown>>({});
  const [visibility,setVisibility]=useState<SavedPageLite['visibility']>('private');
  const [sharedRoles,setSharedRoles]=useState<string[]>([]);
  const [letterhead,setLetterhead]=useState('default');
  const [queryId,setQueryId]=useState<string|null>(null);
  const [queryMode,setQueryMode]=useState<'actual'|'forecast'>('actual');
  const [settings,setSettings]=useState(false);
  const [pdfPreview,setPdfPreview]=useState(false);
  const [snapshotPanel,setSnapshotPanel]=useState(false),[automationPanel,setAutomationPanel]=useState(false);
  const [drill,setDrill]=useState<{definition:DataWidget['query'];row:Record<string,unknown>}|null>(null);
  const closeSnapshots=useCallback(()=>setSnapshotPanel(false),[]),closeAutomation=useCallback(()=>setAutomationPanel(false),[]);
  const [guided,setGuided]=useState(!pageId);
  const [readPreview,setReadPreview]=useState(liveView);
  const [activeTab,setActiveTab]=useState<string>('');
  const [confirm,setConfirm]=useState<{title:string;run:()=>void}|null>(null);
  const versionRef=useRef(0),runRef=useRef(0),pageRef=useRef(page),savingRef=useRef(false),loadedIdRef=useRef<string|undefined>(undefined);
  pageRef.current=page;
  const editable=canDesign&&(!savedId||!!meta?.can_edit)&&!loading;
  const selectedWidget=page.widgets.find(w=>w.id===selected);
  const selectedDataset=datasets.find(d=>d.key===source);
  const selectedLetterhead=letterhead==='default'?letterheads.find(item=>item.isDefault):letterheads.find(item=>item.id===letterhead);
  const usesSectionFilters=page.widgets.some(isDataWidget)&&page.widgets.filter(isDataWidget).every(w=>w.ignorePageFilters);
  const tabs=page.widgets.flatMap(w=>w.type==='tabs'?w.tabs:[]);
  const tabKeys=tabs.map(t=>t.key);
  const visibleTab=tabKeys.includes(activeTab)?activeTab:tabs[0]?.key??'';
  const visibleTabLabel=tabs.find(tab=>tab.key===visibleTab)?.label;
  const outlineGroups=[{key:'common',label:'Ortak alanlar · her sekmede',widgets:page.widgets.filter(widget=>widget.type==='tabs'||!widget.tab)},...tabs.map(tab=>({key:`tab:${tab.key}`,label:tab.label,widgets:page.widgets.filter(widget=>widget.type!=='tabs'&&widget.tab===tab.key)}))];
  const selectOutlineWidget=(widget:PageWidget)=>{
    setSelected(widget.id);
    if(widget.tab)setActiveTab(widget.tab);
    requestAnimationFrame(()=>document.getElementById(`studio-${widget.id}`)?.scrollIntoView({behavior:'smooth',block:'center'}));
  };
  const chosenQuery=page.widgets.find((w):w is DataWidget=>w.id===queryId&&isDataWidget(w));

  useEffect(()=>{
    if(!pageId||loadedIdRef.current===pageId)return;
    setLoading(true);setPage(blank());setMeta(null);setSavedId(pageId);setData({});setSelected(null);setDirty(false);runRef.current+=1;
    let active=true;
    api.page(pageId).then(({page:saved})=>{if(!active)return;loadedIdRef.current=saved.id;setPage(parsePageDefinition(saved.page));setMeta(saved);setSavedId(saved.id);setVisibility(saved.visibility);setSharedRoles(saved.shared_roles);setValues(Object.fromEntries(saved.page.filters.filter(f=>f.defaultValue!==undefined).map(f=>[f.key,f.defaultValue])));setLetterhead(saved.page.pdf.noLetterhead?'none':saved.page.pdf.letterheadId??saved.letterhead_id??'default');setSelected(saved.page.widgets[0]?.id??null);setDirty(false);}).catch(e=>{if(active)setNotice({kind:'error',text:errorText(e)});}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[pageId]);

  useEffect(()=>{if(!dirty)return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);

  const update=useCallback((fn:(draft:PageDefinition)=>void)=>{
    if(!editable)return;
    try{const next=structuredClone(pageRef.current);fn(next);const parsed=parsePageDefinition(next);pageRef.current=parsed;setPage(parsed);setDirty(true);versionRef.current+=1;setNotice(null);}catch(e){setNotice({kind:'error',text:errorText(e)});}
  },[editable]);
  const updateWidget=(id:string,fn:(w:PageWidget)=>void)=>update(p=>{const widget=p.widgets.find(w=>w.id===id);if(widget)fn(widget);});
  const closeQuery=useCallback(()=>setQueryId(null),[]);
  const closeSettings=useCallback(()=>setSettings(false),[]);
  const closeGuided=useCallback(()=>setGuided(false),[]);

  const run=useCallback(async(p:PageDefinition,v:Record<string,unknown>)=>{
    const request=++runRef.current;
    if(!p.widgets.some(isDataWidget)){setData({});setRunning(false);return;}
    setRunning(true);setData({});
    try{const result=await api.runPage({page:p,values:v});if(request===runRef.current)setData(result.data);}
    catch(e){if(request===runRef.current){const message=errorText(e);setData(Object.fromEntries(p.widgets.filter(isDataWidget).map(w=>[w.id,{error:message}])));setNotice({kind:'error',text:message});}}
    finally{if(request===runRef.current)setRunning(false);}
  },[]);
  const queryFingerprint=JSON.stringify({department:page.department,filters:page.filters,widgets:page.widgets.filter(isDataWidget).map(w=>({id:w.id,query:w.query,forecastQuery:w.forecastQuery,ignorePageFilters:w.ignorePageFilters}))});
  useEffect(()=>{if(loading)return;const timer=setTimeout(()=>void run(pageRef.current,values),450);return()=>{clearTimeout(timer);runRef.current+=1;};},[queryFingerprint,values,loading,run]);

  const add=(type:PageWidget['type'])=>{
    if(!editable)return;
    if(type!=='text'&&type!=='tabs'&&!selectedDataset){setNotice({kind:'error',text:'Önce yetkili bir veri kaynağı seçin.'});return;}
    if(type==='tabs'&&tabs.length){setSelected(page.widgets.find(w=>w.type==='tabs')?.id??null);return;}
    if(page.widgets.length>=60){setNotice({kind:'error',text:'Bir raporda en fazla 60 bileşen kullanılabilir.'});return;}
    const id=uid();
    update(p=>{
      const common={id,title:widgetLabels[type]??'',layout:{lg:{x:0,y:0,w:12,h:type==='text'||type==='tabs'?2:type==='kpi_strip'?3:6}},...(visibleTab&&type!=='tabs'?{tab:visibleTab}:{})};
      const widget=type==='text'?{...common,type,variant:'heading',text:'Yeni bölüm'}:type==='tabs'?{...common,type,tabs:[{key:'genel',label:'Genel'},{key:'detay',label:'Detay'}]}:{...common,type,query:defaultQuery(selectedDataset!,type)};
      p.widgets=arrange(parsePageDefinition({...p,widgets:[...p.widgets,widget]}).widgets);
    });setSelected(id);
  };
  const reorder=(id:string,delta:number)=>update(p=>{const index=p.widgets.findIndex(w=>w.id===id),to=index+delta;if(to<0||to>=p.widgets.length)return;[p.widgets[index],p.widgets[to]]=[p.widgets[to],p.widgets[index]];p.widgets=arrange(p.widgets);});
  const duplicate=(id:string)=>{const newId=uid();update(p=>{const index=p.widgets.findIndex(w=>w.id===id);if(index<0)return;const w=structuredClone(p.widgets[index]);w.id=newId;w.title=`${w.title} · Kopya`.slice(0,200);if(w.type==='tabs'){const keys=new Map(w.tabs.map(t=>[t.key,`t_${crypto.randomUUID().slice(0,8)}`]));w.tabs=w.tabs.map(t=>({...t,key:keys.get(t.key)!}));}p.widgets.splice(index+1,0,w);p.widgets=arrange(p.widgets);});setSelected(newId);};
  const remove=(id:string)=>{update(p=>{const w=p.widgets.find(x=>x.id===id);if(w?.type==='tabs'){const keys=new Set(w.tabs.map(t=>t.key));p.widgets.forEach(x=>{if(x.tab&&keys.has(x.tab))delete x.tab;});}p.widgets=arrange(p.widgets.filter(w=>w.id!==id));});setSelected(null);};
  const save=async()=>{
    if(!editable||busy||savingRef.current)return;
    savingRef.current=true;setBusy('save');setNotice(null);const revision=versionRef.current;
    try{
      const parsed=parsePageDefinition(pageRef.current);
      if(savedId&&!meta)throw new Error('Rapor sürümü yüklenmeden kayıt yapılamaz.');
      if(visibility==='roles'&&!sharedRoles.length)throw new Error('Paylaşmak için en az bir rol seçin.');
      parsed.pdf.noLetterhead=letterhead==='none';
      if(letterhead==='default'||letterhead==='none')delete parsed.pdf.letterheadId;else parsed.pdf.letterheadId=letterhead;
      const body={page:parsed,visibility,sharedRoles,letterheadId:letterhead==='default'||letterhead==='none'||selectedLetterhead?.isBuiltin?null:letterhead};
      if(savedId){const result=await api.updatePage(savedId,{...body,baseVersion:meta?.version});setMeta(m=>m?{...m,version:result.version}:m);}
      else{const result=await api.createPage(body);loadedIdRef.current=result.id;setSavedId(result.id);const url=new URL(window.location.href);url.searchParams.set('page',result.id);window.history.replaceState(window.history.state,'',url.toString());setMeta({id:result.id,title:parsed.title,owner_name:null,owner_user_id:currentUserId,visibility,shared_roles:sharedRoles,is_template:false,version:1,letterhead_id:body.letterheadId,updated_at:new Date().toISOString(),can_edit:true});}
      if(versionRef.current===revision)setDirty(false);
      setNotice({kind:'success',text:'Rapor kaydedildi. Canlı veriler rapor açıldığında güncellenir.'});onSaved();window.dispatchEvent(new Event('pax:reportschange'));
    }catch(e){setNotice({kind:'error',text:e instanceof ApiFailure&&e.status===409?'Raporun daha yeni bir sürümü var. Taslağınız korunuyor; değişiklikleri ayrı rapor olarak kaydedebilirsiniz.':errorText(e)});}finally{savingRef.current=false;setBusy(null);}
  };
  const deleteSaved=async()=>{if(!savedId||!meta?.can_edit||busy)return;setBusy('delete');try{await api.archivePage(savedId);setDirty(false);window.dispatchEvent(new Event('pax:reportschange'));onClose();}catch(e){setNotice({kind:'error',text:errorText(e)});}finally{setBusy(null);}};
  const copyShareLink=async()=>{if(!savedId)return;try{const link=new URL('/crm/report-builder',window.location.origin);link.searchParams.set('page',savedId);link.searchParams.set('view','live');await navigator.clipboard.writeText(link.toString());setNotice({kind:'success',text:'Bağlantı kopyalandı. Alıcının erişimi kaydedilmiş paylaşım ayarlarına göre kontrol edilir.'});}catch{setNotice({kind:'error',text:'Bağlantı kopyalanamadı. Tarayıcınızın pano iznini kontrol edin.'});}};
  const effectiveQuery=(widget:DataWidget)=>{const dataset=datasets.find(d=>d.key===widget.query.dataset);if(widget.ignorePageFilters)return widget.query;let query=applyPageFilters(widget.query,page.filters,values,f=>!!dataset?.dimensions.some(d=>d.key===f));if(dataset?.dimensions.some(d=>d.key==='department')){const department=resolveDepartment(page.department,query.department,values.department);query={...query,department:department==='all'?undefined:department};}return query;};
  const exportWidgetCsv=async(widget:DataWidget)=>{
    const dataset=datasets.find(d=>d.key===widget.query.dataset);
    let query=widget.query;
    if(!widget.ignorePageFilters){
      query=applyPageFilters(query,page.filters,values,field=>!!dataset?.dimensions.some(d=>d.key===field));
      if(dataset?.dimensions.some(d=>d.key==='department')){
        const department=resolveDepartment(page.department,query.department,values.department);
        query={...query,department:department==='all'?undefined:department};
      }
    }
    await downloadCsv(query);
  };
  const requestClose=()=>{if(!dirty||window.confirm('Kaydedilmemiş değişiklikler var. Rapor merkezine dönülsün mü?'))onClose();};
  const markSettings=()=>{setDirty(true);versionRef.current+=1;};
  const fieldList=useMemo(()=>selectedDataset?[...selectedDataset.measures.map(m=>({...m,kind:'Ölçü'})),...selectedDataset.dimensions.map(d=>({...d,kind:'Alan'}))].filter(f=>`${f.label} ${f.key}`.toLocaleLowerCase('tr-TR').includes(sourceSearch.toLocaleLowerCase('tr-TR'))):[],[selectedDataset,sourceSearch]);

  return <div className={styles.studio} style={{'--studio-accent':({primary:'#0e6fc7',success:'#166534',warning:'#854d0e',danger:'#b91c1c',info:'#0e7490',accent:'#6d28d9',neutral:'#4b5563'})[page.theme.accent]} as CSSProperties}>
    <header className={styles.topbar}><div className={styles.identity}><button className={styles.iconButton} onClick={requestClose} title="Rapor merkezine dön" aria-label="Rapor merkezine dön"><ArrowLeft size={18}/></button><div className={styles.brandIcon}><LayoutGrid size={20}/></div><div><span className={styles.eyebrow}>RAPOR STÜDYOSU</span><h1>{page.title||'Yeni özel rapor'}</h1><small>{loading?'Rapor yükleniyor…':dirty?'Kaydedilmemiş değişiklikler':savedId?`Kayıtlı · Sürüm ${meta?.version??1}`:'Boş taslak · İlk bileşeninizi ekleyin'}</small></div></div><div className={styles.headerActions}><button onClick={()=>setReadPreview(v=>!v)} disabled={!editable&&readPreview}><PanelTop size={16}/>{readPreview?'Düzenle':'Önizle'}</button><button onClick={()=>void run(page,values)} disabled={loading||running}><RefreshCw size={16} className={running?styles.spin:undefined}/><span>Veriyi yenile</span></button><button onClick={()=>setSettings(true)} aria-label="Rapor ve PDF ayarları"><Share2 size={16}/>Paylaş</button>{savedId&&<button onClick={()=>setSnapshotPanel(true)}>Dönem fotoğrafı</button>}{savedId&&meta?.owner_user_id===currentUserId&&<button onClick={()=>setAutomationPanel(true)}>Zamanla / uyar</button>}<button onClick={()=>setPdfPreview(true)} disabled={!!busy||loading||!page.widgets.length}><FileDown size={16}/>PDF</button>{editable&&<button className={styles.primary} onClick={()=>void save()} disabled={!!busy||loading}>{busy==='save'?<Loader2 size={16} className={styles.spin}/>:<Save size={16}/>}Kaydet</button>}</div></header>
    {notice&&<div role={notice.kind==='error'?'alert':'status'} className={`${styles.notice} ${notice.kind==='error'?styles.noticeError:styles.noticeSuccess}`}>{notice.text}<button onClick={()=>setNotice(null)} aria-label="Bildirimi kapat"><X size={15}/></button></div>}
    <div className={styles.filterbar}><span className={styles.live}><i/>{running?'Canlı veri sorgulanıyor':'Canlı veri'}</span>{!usesSectionFilters&&<><label>Dönem<select value={typeof values.period==='string'?values.period:''} onChange={e=>{const value=e.target.value;if(!page.filters.some(f=>f.key==='period'))update(p=>{p.filters.push({key:'period',label:'Dönem',kind:'date_range'});});setValues(v=>({...v,period:value}));}}><option value="">Tüm tarihler</option>{RELATIVE_PRESETS.map(p=><option key={p} value={p}>{PRESET_LABEL[p]}</option>)}</select></label><label>Departman<select value={String(values.department??page.department)} onChange={e=>setValues(v=>({...v,department:e.target.value}))}>{DEPARTMENT_VALUES.map(d=><option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>)}</select></label></>}{page.filters.filter(f=>f.key!=='period'&&f.key!=='department').map(f=><label key={f.key}>{f.label}{f.kind==='date_range'?<select value={String(values[f.key]??'')} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}><option value="">Tüm tarihler</option>{RELATIVE_PRESETS.map(p=><option key={p} value={p}>{PRESET_LABEL[p]}</option>)}</select>:f.options?.length?<select value={String(values[f.key]??'')} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}><option value="">Tümü</option>{f.options.map(o=><option key={o} value={o}>{o}</option>)}</select>:<input placeholder="Tümü" value={String(values[f.key]??'')} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/>}</label>)}<span className={styles.filterHint}>Her bölüm kendi veri kaynağını, kırılımlarını, dönemini ve hesaplarını kullanır.</span></div>
    <div className={`${styles.workspace} ${readPreview?styles.previewWorkspace:''}`}>
      {!readPreview&&<aside className={styles.leftPanel} aria-label="Veri kaynakları ve rapor bileşenleri"><div className={styles.panelHeading}><LayoutGrid size={15}/><h2>Bileşen ekle</h2></div><p className={styles.filterHint} role="status" style={{display:'block',padding:'0 14px 10px',margin:0}}>{visibleTabLabel?`Yeni bileşen “${visibleTabLabel}” sekmesine eklenecek.`:'Yeni bileşen ortak alana eklenecek.'} Sekme çubuğu her zaman ortak alandadır.</p><div className={styles.palette}>{palette.map(type=><button key={type} disabled={!editable||page.widgets.length>=60} onClick={()=>add(type)}>{type==='text'?<Type size={17}/>:type==='tabs'?<PanelTop size={17}/>:type==='table'||type==='pivot'||type==='heatmap'?<Table2 size={17}/>:<BarChart3 size={17}/>}<span>{widgetLabels[type]}</span><Plus size={13}/></button>)}</div><div className={styles.panelHeading}><Table2 size={15}/><h2>Veri kaynakları</h2><span>{datasets.length}</span></div><div className={styles.sourceArea}><label className={styles.field}>Yeni bileşenin kaynağı<select value={source} onChange={e=>setSource(e.target.value)}>{datasets.map(d=><option key={d.key} value={d.key}>{d.label}</option>)}</select></label>{selectedDataset&&<><p>{selectedDataset.description}</p><input aria-label="Kaynak alanı ara" placeholder="Alan veya ölçü ara…" value={sourceSearch} onChange={e=>setSourceSearch(e.target.value)}/><div className={styles.fieldList}>{fieldList.map(f=><div key={`${f.kind}-${f.key}`} title={f.description??f.key}><span className={f.kind==='Ölçü'?styles.measureDot:styles.dimensionDot}/><span>{f.label}</span><small>{f.kind}</small></div>)}</div></>}</div><div className={styles.panelHeading}><ListOrdered size={15}/><h2>Rapor yapısı</h2><span>{page.widgets.length}/60</span></div><ol className={styles.outline} aria-label="Rapor yapısı: ortak alanlar ve sekmelere göre bileşenler">{outlineGroups.map(group=><li key={group.key}><h3 className={styles.panelHeading} style={{margin:0,padding:'12px 4px 6px'}}><strong style={{fontSize:11}}>{group.label}</strong><small>{group.widgets.length}</small></h3><ol aria-label={`${group.label} bileşenleri`} style={{listStyle:'none',margin:0,padding:'0 0 8px 8px'}}>{group.widgets.map(w=>{const sourceLabel=isDataWidget(w)?datasets.find(d=>d.key===w.query.dataset)?.label??w.query.dataset:'';const title=w.title||(w.type==='text'?w.text:widgetLabels[w.type])||'Bileşen';return <li key={w.id}><button type="button" className={selected===w.id?styles.outlineActive:''} aria-current={selected===w.id?'true':undefined} aria-label={`${title} · ${widgetLabels[w.type]??w.type}${sourceLabel?` · ${sourceLabel}`:''} · ${group.label}`} onClick={()=>selectOutlineWidget(w)}><span>{String(page.widgets.findIndex(widget=>widget.id===w.id)+1).padStart(2,'0')}</span><strong>{title}<small style={{display:'block',fontSize:9,fontWeight:400,color:'var(--muted)',marginTop:3}}>{widgetLabels[w.type]??w.type}{sourceLabel?` · ${sourceLabel}`:''}</small></strong><ChevronRight size={13}/></button></li>;})}</ol>{!group.widgets.length&&<p className={styles.muted} style={{fontSize:10,padding:'0 10px'}}>Henüz bileşen yok</p>}</li>)}</ol></aside>}
      <section className={styles.canvasArea} aria-label="Rapor çalışma alanı"><div className={styles.canvasToolbar}><span>{readPreview?'Rapor önizlemesi':'ÇALIŞMA ALANI'}</span><small>{page.widgets.length} bileşen · {new Set(page.widgets.filter(isDataWidget).map(w=>w.query.dataset)).size} veri kaynağı</small></div><div className={styles.paper}><div className={styles.paperHeading}>{readPreview?<h2>{page.title}</h2>:<input aria-label="Rapor başlığı" value={page.title} maxLength={120} disabled={!editable} onChange={e=>update(p=>{p.title=e.target.value||'Yeni özel rapor';})}/>}<p>{page.subtitle||'Tabloları, göstergeleri ve grafikleri tek raporda bir araya getirin.'}</p></div>{loading?<div className={styles.empty}><Loader2 size={28} className={styles.spin}/><p>Rapor yükleniyor…</p></div>:!page.widgets.length?<div className={styles.empty}><div className={styles.emptyIcon}><LayoutGrid size={32}/></div><h2>Raporunuzun yapısını siz kurun</h2><p>Soldan bir kaynak seçip tablo, aylık pivot, KPI veya grafik ekleyin. Her bileşende alanları, filtreleri ve formülleri özelleştirin.</p><div><button className={styles.primary} disabled={!editable||!datasets.length} onClick={()=>setGuided(true)}><Plus size={16}/>Adım adım rapor oluştur</button></div></div>:<div className={styles.canvas}>{page.widgets.filter(w=>w.type!=='filter'&&(w.type==='tabs'||!w.tab||w.tab===visibleTab)).map(w=><section id={`studio-${w.id}`} key={w.id} className={`${styles.block} ${selected===w.id&&!readPreview?styles.selectedBlock:''} ${w.type==='text'?styles.textBlock:''}`} style={{gridColumn:`span ${w.layout.lg.w}`}} onClick={()=>setSelected(w.id)} aria-label={w.title||widgetLabels[w.type]}>
        {!readPreview&&<div className={styles.blockTools}><span>{widgetLabels[w.type]??'Bileşen'}{isDataWidget(w)?` · ${datasets.find(d=>d.key===w.query.dataset)?.label??w.query.dataset}`:''}</span><div>{isDataWidget(w)&&editable&&<button onClick={()=>{setQueryMode('actual');setQueryId(w.id);}}>Alanlar / sorgu</button>}{editable&&<><button onClick={()=>duplicate(w.id)} title="Bileşeni çoğalt" aria-label={`${w.title} çoğalt`}><Copy size={13}/></button><button onClick={()=>remove(w.id)} title="Bileşeni kaldır" aria-label={`${w.title} kaldır`}><Trash2 size={13}/></button></>}</div></div>}
        {w.style.showTitle&&w.title&&w.type!=='text'&&w.type!=='tabs'&&<h3>{w.title}</h3>}<div className={styles.blockBody} style={isDataWidget(w)?{minHeight:w.type==='kpi'||w.type==='kpi_strip'?80:Math.max(140,w.layout.lg.h*38)}:undefined}>{isDataWidget(w)?<><DataWidgetBody widget={{...w,style:{...w.style,accent:w.style.accent??page.theme.accent}}} data={data[w.id]} onDrill={(row)=>{try{setDrill({definition:effectiveQuery(w),row});}catch(e){setNotice({kind:"error",text:errorText(e)});}}}/><ReportDataInfo result={data[w.id]?.result}/></>:w.type==='text'?<TextBlock variant={w.variant} text={w.text}/>:w.type==='tabs'?<div role="tablist" aria-label="Rapor bölümleri" className={styles.reportTabs}>{w.tabs.map(t=><button key={t.key} role="tab" aria-selected={t.key===visibleTab} onClick={()=>setActiveTab(t.key)}>{t.label}</button>)}</div>:w.type==='filter'?<p className={styles.muted}>Bu filtre üstteki rapor dönemine veya gelişmiş pano tasarımına bağlıdır: {w.filterKey}</p>:null}</div>
      </section>)}</div>}</div></section>
      {!readPreview&&<aside className={styles.inspector} aria-label="Seçili bileşen ayarları"><div className={styles.panelHeading}><Settings2 size={15}/><h2>{selectedWidget?'Bileşen ayarları':'Rapor ayarları'}</h2></div>{selectedWidget?<div className={styles.inspectorBody}><span className={styles.badge}>{widgetLabels[selectedWidget.type]??selectedWidget.type}</span><label className={styles.field}>Bileşen başlığı<input value={selectedWidget.title} maxLength={200} disabled={!editable} onChange={e=>updateWidget(selectedWidget.id,w=>{w.title=e.target.value;})}/></label>{isDataWidget(selectedWidget)&&<><label className={styles.field}>Veri kaynağı<select value={selectedWidget.query.dataset} disabled={!editable} onChange={e=>{const ds=datasets.find(d=>d.key===e.target.value);if(ds)updateWidget(selectedWidget.id,w=>{if(isDataWidget(w)){w.query=reportDefinitionSchema.parse(defaultQuery(ds,w.type));delete w.forecastQuery;}});}}>{datasets.map(d=><option key={d.key} value={d.key}>{d.label}</option>)}</select></label><button className={styles.queryButton} disabled={!editable} onClick={()=>{setQueryMode('actual');setQueryId(selectedWidget.id);}}><Table2 size={16}/><span>Alanları ve sorguyu düzenle<small>Ölçüler, kırılımlar, filtreler, formüller</small></span><ChevronRight size={15}/></button><div className={styles.querySummary}><strong>Ölçüler</strong><p>{selectedWidget.query.measures.map(k=>datasets.find(d=>d.key===selectedWidget.query.dataset)?.measures.find(m=>m.key===k)?.label??k).join(', ')}</p><strong>Kırılımlar</strong><p>{selectedWidget.query.dimensions.map(d=>datasets.find(ds=>ds.key===selectedWidget.query.dataset)?.dimensions.find(f=>f.key===d.field)?.label??d.field).join(' → ')||'Toplam'}</p><strong>Filtre ve hesap</strong><p>{selectedWidget.query.filters.length} filtre · {selectedWidget.query.calculated.length} hesaplanmış alan</p></div><button disabled={!data[selectedWidget.id]?.result} onClick={()=>void exportWidgetCsv(selectedWidget).catch(e=>setNotice({kind:'error',text:errorText(e)}))}>Bu bileşeni CSV indir</button>{selectedWidget.type==='heatmap'&&<><button disabled={!editable} onClick={()=>{setQueryMode('forecast');setQueryId(selectedWidget.id);}}>Tahmin katmanı sorgusu</button>{selectedWidget.forecastQuery&&<button disabled={!editable} onClick={()=>updateWidget(selectedWidget.id,w=>{if(isDataWidget(w))delete w.forecastQuery;})}>Tahmin katmanını kaldır</button>}</>}</>}
        {selectedWidget.type==='text'&&<><label className={styles.field}>Metin türü<select value={selectedWidget.variant} disabled={!editable} onChange={e=>updateWidget(selectedWidget.id,w=>{if(w.type==='text')w.variant=e.target.value as 'heading'|'paragraph'|'note';})}><option value="heading">Bölüm başlığı</option><option value="paragraph">Açıklama</option><option value="note">Bilgi notu</option></select></label><label className={styles.field}>İçerik<textarea rows={7} value={selectedWidget.text} maxLength={4000} disabled={!editable} onChange={e=>updateWidget(selectedWidget.id,w=>{if(w.type==='text')w.text=e.target.value;})}/></label></>}
        {selectedWidget.type==='tabs'&&<div className={styles.tabEditor}><p>Bileşeni seçip “Gösterileceği sekme” alanından hangi sekmede yer alacağını belirleyebilirsiniz.</p>{selectedWidget.tabs.map((t,i)=><label key={t.key} className={styles.field}>Sekme {i+1}<input value={t.label} disabled={!editable} maxLength={60} onChange={e=>updateWidget(selectedWidget.id,w=>{if(w.type==='tabs')w.tabs[i].label=e.target.value||'Bölüm';})}/></label>)}<button disabled={!editable||selectedWidget.tabs.length>=12} onClick={()=>updateWidget(selectedWidget.id,w=>{if(w.type==='tabs')w.tabs.push({key:`t_${crypto.randomUUID().slice(0,8)}`,label:`Bölüm ${w.tabs.length+1}`});})}><Plus size={14}/>Sekme ekle</button></div>}
        {isDataWidget(selectedWidget)&&<StudioDataStyle widget={selectedWidget} dataset={datasets.find(d=>d.key===selectedWidget.query.dataset)} data={data[selectedWidget.id]} editable={editable} onChange={fn=>updateWidget(selectedWidget.id,fn)}/>}
        {tabs.length>0&&selectedWidget.type!=='tabs'&&<label className={styles.field}>Gösterileceği sekme<select disabled={!editable} value={selectedWidget.tab??''} onChange={e=>{const tab=e.target.value;updateWidget(selectedWidget.id,w=>{if(tab)w.tab=tab;else delete w.tab;});if(tab)setActiveTab(tab);}}><option value="">Ortak alan · her sekmede göster</option>{tabs.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</select></label>}
        <div className={styles.controlGrid}><label className={styles.field}>Genişlik<select value={selectedWidget.layout.lg.w} disabled={!editable} onChange={e=>update(p=>{const w=p.widgets.find(w=>w.id===selectedWidget.id);if(w)w.layout.lg.w=Number(e.target.value);p.widgets=arrange(p.widgets);})}><option value={12}>Tam</option><option value={6}>Yarım</option><option value={4}>Üçte bir</option><option value={3}>Çeyrek</option>{![12,6,4,3].includes(selectedWidget.layout.lg.w)&&<option value={selectedWidget.layout.lg.w}>{selectedWidget.layout.lg.w}/12</option>}</select></label><label className={styles.field}>Yoğunluk<select value={selectedWidget.style.density} disabled={!editable} onChange={e=>updateWidget(selectedWidget.id,w=>{w.style.density=e.target.value as 'compact'|'normal'|'comfortable';})}><option value="compact">Sıkı</option><option value="normal">Normal</option><option value="comfortable">Rahat</option></select></label></div><label className={styles.field}>Bileşen yüksekliği<select value={selectedWidget.layout.lg.h} disabled={!editable} onChange={e=>update(p=>{const w=p.widgets.find(w=>w.id===selectedWidget.id);if(w)w.layout.lg.h=Number(e.target.value);p.widgets=arrange(p.widgets);})}>{[1,2,3,4,5,6,8,10,12,16,20,30,40].map(h=><option key={h} value={h}>{h} birim</option>)}</select></label><label className={styles.field}>Vurgu rengi<select value={selectedWidget.style.accent??'primary'} disabled={!editable} onChange={e=>updateWidget(selectedWidget.id,w=>{w.style.accent=e.target.value as typeof COLOR_TOKENS[number];})}>{COLOR_TOKENS.map(c=><option key={c} value={c}>{c}</option>)}</select></label><label className={styles.check}><input type="checkbox" checked={selectedWidget.style.showTitle} disabled={!editable} onChange={e=>updateWidget(selectedWidget.id,w=>{w.style.showTitle=e.target.checked;})}/>Başlığı göster</label><label className={styles.check}><input type="checkbox" checked={selectedWidget.pdf.pageBreakBefore} disabled={!editable} onChange={e=>updateWidget(selectedWidget.id,w=>{w.pdf.pageBreakBefore=e.target.checked;})}/>PDF’de yeni sayfada başlat</label><label className={styles.check}><input type="checkbox" checked={selectedWidget.pdf.hideInPdf} disabled={!editable} onChange={e=>updateWidget(selectedWidget.id,w=>{w.pdf.hideInPdf=e.target.checked;})}/>PDF çıktısında gizle</label><div className={styles.reorder}><button disabled={!editable||page.widgets[0]?.id===selectedWidget.id} onClick={()=>reorder(selectedWidget.id,-1)}><ArrowUp size={15}/>Yukarı</button><button disabled={!editable||page.widgets.at(-1)?.id===selectedWidget.id} onClick={()=>reorder(selectedWidget.id,1)}><ArrowDown size={15}/>Aşağı</button></div><button className={styles.danger} disabled={!editable} onClick={()=>remove(selectedWidget.id)}><Trash2 size={15}/>Bileşeni kaldır</button></div>:<div className={styles.inspectorBody}><div className={styles.inspectorEmpty}><Settings2 size={26}/><p>Bir bileşen seçerek kaynağını, sorgusunu ve görünümünü düzenleyin.</p></div><label className={styles.field}>Rapor açıklaması<textarea rows={3} value={page.subtitle??''} maxLength={200} disabled={!editable} onChange={e=>update(p=>{p.subtitle=e.target.value;})}/></label><button onClick={()=>setSettings(true)}>Paylaşım ve PDF ayarları</button><div className={styles.tip}><strong>İki örnek, esnek rapor yapısı</strong><p>KasaPOS için firma × ay pivotları kurun. Retail için farklı kaynaklardan KPI, satış tablosu, fırsat grafiği ve CRM bölümünü aynı rapora ekleyin.</p></div></div>}</aside>}
    </div>
    {chosenQuery&&<Modal title={`${chosenQuery.title||'Bileşen'} · ${queryMode==='forecast'?'Tahmin katmanı':'Veri ve hesaplar'}`} onClose={closeQuery}><QueryBuilder datasets={datasets} initial={queryMode==='forecast'?chosenQuery.forecastQuery??chosenQuery.query:chosenQuery.query} onCancel={closeQuery} onApply={query=>{updateWidget(chosenQuery.id,w=>{if(!isDataWidget(w))return;const parsed=reportDefinitionSchema.parse(query);if(queryMode==='forecast'){w.forecastQuery=parsed;return;}w.query=parsed;w.type=parsed.visualization.type==='kpi'?'kpi_strip':parsed.visualization.type;if(parsed.style)w.style={...w.style,...parsed.style};});closeQuery();}}/></Modal>}
    {pdfPreview&&<ReportPdfPreview page={page} values={values} letterheadId={letterhead==='none'?null:letterhead==='default'?undefined:letterhead} builtinPortrait={selectedLetterhead?.isBuiltin} onClose={()=>setPdfPreview(false)} onApply={editable?draft=>{update(p=>Object.assign(p,draft));setPdfPreview(false);}:undefined}/>}
    {drill&&<DrilldownPanel definition={drill.definition} row={drill.row} onClose={()=>setDrill(null)}/>}
    {snapshotPanel&&savedId&&<Modal title="Dönem fotoğrafları" onClose={closeSnapshots}><ReportSnapshotPanel pageId={savedId} values={values} canCapture={!dirty&&!running}/></Modal>}
    {automationPanel&&savedId&&<Modal title="Zamanlanmış raporlar ve uyarılar" onClose={closeAutomation}><ReportAutomationPanel pageId={savedId}/></Modal>}
    {guided&&editable&&<Modal title="Birlikte raporunuzu oluşturalım" onClose={closeGuided}><GuidedReportSetup datasets={datasets} onCreate={draft=>{setPage(draft);pageRef.current=draft;setSelected(draft.widgets[0]?.id??null);setValues(Object.fromEntries(draft.filters.filter(f=>f.defaultValue!==undefined).map(f=>[f.key,f.defaultValue])));setDirty(true);versionRef.current+=1;setGuided(false);setReadPreview(true);}}/></Modal>}
    {settings&&<Modal title="Rapor, paylaşım ve PDF ayarları" onClose={closeSettings}><div className={styles.settingsForm}><label className={styles.field}>Rapor adı<input value={page.title} maxLength={120} disabled={!editable} onChange={e=>update(p=>{p.title=e.target.value||'Yeni özel rapor';})}/></label><label className={styles.field}>Açıklama<textarea rows={3} value={page.subtitle??''} maxLength={200} disabled={!editable} onChange={e=>update(p=>{p.subtitle=e.target.value;})}/></label><label className={styles.field}>Rapor teması<select aria-label="Rapor teması" disabled={!editable} value={page.theme.accent} onChange={e=>update(p=>{p.theme.accent=e.target.value as typeof p.theme.accent;})}>{COLOR_TOKENS.map(c=><option key={c} value={c}>{COLOR_NAMES[c]}</option>)}</select></label><label className={styles.field}>Rapor yoğunluğu<select disabled={!editable} value={page.theme.density} onChange={e=>update(p=>{p.theme.density=e.target.value as typeof p.theme.density;})}><option value="compact">Sıkı</option><option value="normal">Dengeli</option><option value="comfortable">Ferah</option></select></label><button disabled={!editable} onClick={()=>update(p=>{p.widgets.forEach(w=>{w.style.accent=p.theme.accent;w.style.density=p.theme.density;});})}>Tema ve yoğunluğu tüm bölümlere uygula</button><label className={styles.field}>Varsayılan departman<select disabled={!editable} value={page.department} onChange={e=>update(p=>{p.department=e.target.value as PageDefinition['department'];})}>{DEPARTMENT_VALUES.map(d=><option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>)}</select></label><label className={styles.field}>Kimler görebilir?<select value={visibility} disabled={!editable} onChange={e=>{setVisibility(e.target.value as SavedPageLite['visibility']);markSettings();}}><option value="private">Yalnız ben</option><option value="roles">Seçili roller</option><option value="everyone">Erişimi olan herkes</option></select></label>{savedId&&<button onClick={()=>void copyShareLink()}><Share2 size={15}/>Rapor bağlantısını kopyala</button>}<p>Paylaşım seçimini değiştirdikten sonra Kaydet’e basın. Alıcılar kendi veri yetkileri kapsamındaki sonuçları görür.</p>{visibility==='roles'&&<fieldset className={styles.roleList}><legend>Paylaşılacak roller</legend>{roles.map(role=><label className={styles.check} key={role.key}><input type="checkbox" disabled={!editable} checked={sharedRoles.includes(role.key)} onChange={e=>{setSharedRoles(list=>e.target.checked?[...list,role.key]:list.filter(r=>r!==role.key));markSettings();}}/>{role.label}</label>)}</fieldset>}<label className={styles.check}><input type="checkbox" disabled={!editable} checked={page.navigation?.enabled??false} onChange={e=>update(p=>{p.navigation={enabled:e.target.checked};})}/>Sol menüde canlı rapor olarak göster</label><p>Kaydettikten sonra rapora erişimi olan kullanıcılar menüden açıp güncel verileri görebilir.</p><label className={styles.field}>PDF anteti<select value={letterhead} disabled={!editable} onChange={e=>{setLetterhead(e.target.value);markSettings();}}><option value="default">Varsayılan antet</option><option value="none">Antetsiz</option>{letterheads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label className={styles.field}>PDF yönü<select value={selectedLetterhead?.isBuiltin?'portrait':page.pdf.orientation??'landscape'} disabled={!editable||selectedLetterhead?.isBuiltin} onChange={e=>update(p=>{p.pdf.orientation=e.target.value as 'landscape'|'portrait';})}><option value="landscape">Yatay · geniş tablolar</option><option value="portrait">Dikey</option></select></label>{selectedLetterhead?.isBuiltin&&<p>Kurumsal antetinizin oranlarını korumak için PDF dikey A4 hazırlanır.</p>}{savedId&&editable&&<button disabled={!!busy} onClick={()=>{setSavedId(undefined);setMeta(null);markSettings();setNotice({kind:'success',text:'Taslak ayrı bir rapor olarak kaydedilecek.'});closeSettings();}}><Copy size={15}/>Ayrı rapor olarak kaydetmeye hazırla</button>}{savedId&&editable&&<button disabled={!!busy} onClick={()=>setConfirm({title:`“${page.title}” raporu silinsin mi? Menüden ve paylaşım bağlantısından kaldırılacak.`,run:()=>void deleteSaved()})}><Trash2 size={15}/>Raporu sil</button>}<button className={styles.primary} onClick={closeSettings}>Ayarları uygula</button></div></Modal>}
    {confirm&&<Modal title="Devam etmeden önce" onClose={()=>setConfirm(null)}><div className={styles.settingsForm}><p>{confirm.title}</p><div className={styles.headerActions}><button onClick={()=>setConfirm(null)}>Vazgeç</button><button className={styles.primary} onClick={()=>{const action=confirm.run;setConfirm(null);action();}}>Devam et</button></div></div></Modal>}
  </div>;
}
