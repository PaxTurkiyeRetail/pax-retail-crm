'use client';
// Sorgu oluşturucu: dataset → ölçü / kırılım / filtre / tarih / departman / karşılaştırma / görünüm / formül.
// Tanım istemcide JSON; SQL sunucuda derlenir (istemci SQL göndermez).
import { useEffect, useMemo, useState } from 'react';
import { changeFilterOperator, definitionFilterIssue, filterInputIssue, normalizeDefinitionFilters } from '@/lib/report-builder/filter-input';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import type { ReportResult } from '@/lib/report-builder/result';
import {
  DEPARTMENT_VALUES, FILTER_OPS, RELATIVE_PRESETS, TIME_GRAINS, VIZ_TYPES,
  type FilterOp, type ReportDefinitionInput, type TimeGrain, type VizType,
} from '@/lib/report-builder/types';
import { api, downloadCsv, fetchPdf, saveBlob, type SavedDefinitionLite } from './api';
import { DEPARTMENT_LABEL, GRAIN_LABEL, OP_LABEL, PRESET_LABEL, VIZ_LABEL } from './labels';
import { ResultView } from './renderers/WidgetRenderer';
import { TOKEN_CSS } from './renderers/tokens';
import styles from './QueryBuilder.module.css';

type Def = ReportDefinitionInput;
type Filter = NonNullable<Def['filters']>[number];
type Calc = NonNullable<Def['calculated']>[number];

const NO_VALUE: FilterOp[] = ['is_null', 'not_null'];
const LIST_OPS: FilterOp[] = ['in', 'not_in'];

type Props = {
  datasets: DatasetCatalogEntry[];
  initial?: Def;
  /** Designer'dan açıldıysa: "Widget'a uygula". */
  onApply?: (def: Def) => void;
  onCancel?: () => void;
};

export default function QueryBuilder({ datasets, initial, onApply, onCancel }: Props) {
  const [def, setDef] = useState<Def>(() => initial ? normalizeDefinitionFilters(initial) : { dataset: datasets[0]?.key ?? 'sales', measures: [], dimensions: [], filters: [], calculated: [], visualization: { type: 'table' }, compare: 'none', limit: 500 });
  const [result, setResult] = useState<ReportResult | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SavedDefinitionLite[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [title, setTitle] = useState('Yeni rapor');
  const [visibility, setVisibility] = useState<'private' | 'roles' | 'everyone'>('private');
  const [note, setNote] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');

  const ds = datasets.find((d) => d.key === def.dataset) ?? null;
  const dateDims = useMemo(() => ds?.dimensions.filter((d) => d.type === 'date') ?? [], [ds]);

  useEffect(() => { if (!onApply) api.definitions().then((r) => setSaved(r.definitions)).catch(() => undefined); }, [onApply]);

  const patch = (p: Partial<Def>) => {
    setDef((d) => {
      const next = { ...d, ...p };
      const keys = new Set([...next.measures.flatMap((measure) => [measure, `m_${measure}`]), ...(next.dimensions ?? []).flatMap((dimension) => [dimension.field, `d_${dimension.field}`, `d_${dimension.field}_${dimension.grain ?? 'day'}`]), ...(next.calculated ?? []).flatMap((calc) => [calc.key, `c_${calc.key}`])]);
      next.sort = next.sort?.filter((sort) => keys.has(sort.field));
      if (next.visualization?.pivotColumn && !(next.dimensions ?? []).some((dimension) => dimension.field === next.visualization?.pivotColumn)) next.visualization = { ...next.visualization, pivotColumn: next.dimensions?.at(-1)?.field };
      return next;
    });
    setResult(null);
  };
  const toggleMeasure = (k: string) => patch({ measures: def.measures.includes(k) ? def.measures.filter((m) => m !== k) : [...def.measures, k].slice(0, 12) });

  const run = async () => {
    const issue = definitionFilterIssue(def);
    if (issue) { setIssues([issue]); setResult(null); return; }
    setBusy(true); setIssues([]); setNote(null);
    try { setResult(await api.query(def)); } catch (e) {
      const err = e as { message: string; details?: string[] };
      setIssues(err.details?.length ? err.details : [err.message]);
    } finally { setBusy(false); }
  };

  const save = async () => {
    const issue = definitionFilterIssue(def);
    if (issue) { setIssues([issue]); return; }
    try {
      const body = { title, description: '', visibility, definition: def };
      if (savedId) await api.updateDefinition(savedId, body); else setSavedId((await api.createDefinition(body)).id);
      setNote('Kaydedildi');
      setSaved((await api.definitions()).definitions);
    } catch (e) { setIssues([(e as Error).message]); }
  };

  const pdf = async () => {
    const issue = definitionFilterIssue(def);
    if (issue) { setIssues([issue]); return; }
    try { const { blob, fileName } = await fetchPdf(savedId ? { definitionId: savedId, title } : { definition: def, title }); saveBlob(blob, fileName); }
    catch (e) { setIssues([(e as Error).message]); }
  };

  if (!ds) return <p className="pax-card p-4">Görüntüleyebileceğiniz veri kaynağı yok.</p>;
  const viz = (def.visualization?.type ?? 'table') as VizType;
  const fieldMatches = (label: string, key: string) => `${label} ${key}`.toLocaleLowerCase('tr-TR').includes(fieldSearch.toLocaleLowerCase('tr-TR'));
  const sortFields = [...(def.dimensions ?? []).map((d) => ({ key: d.field, label: ds.dimensions.find((field) => field.key === d.field)?.label ?? d.field })), ...def.measures.map((key) => ({ key, label: ds.measures.find((measure) => measure.key === key)?.label ?? key })), ...(def.calculated ?? []).map((calc) => ({ key: `c_${calc.key}`, label: calc.label }))];

  return (
    <div className={styles.builder}>
      <form className="pax-card space-y-4 p-4 text-sm" onSubmit={(e) => { e.preventDefault(); run(); }} aria-label="Rapor tanımı">
        {!onApply && saved.length > 0 && (
          <label className="block">Kayıtlı rapor
            <select className="pax-input mt-1 w-full" value={savedId ?? ''} onChange={(e) => {
              const s = saved.find((x) => x.id === e.target.value);
              if (!s) { setSavedId(null); return; }
              setSavedId(s.id); setTitle(s.title); setVisibility(s.visibility as never); setDef(normalizeDefinitionFilters(s.definition)); setResult(null);
            }}>
              <option value="">— yeni —</option>
              {saved.map((s) => <option key={s.id} value={s.id}>{s.title}{s.owner_name ? ` · ${s.owner_name}` : ''}</option>)}
            </select>
          </label>
        )}

        <label className="block">Veri kaynağı
          <select className="pax-input mt-1 w-full" value={def.dataset} onChange={(e) => setDef({ dataset: e.target.value, measures: [], dimensions: [], filters: [], calculated: [], visualization: def.visualization, compare: 'none', department: def.department })}>
            {datasets.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <span className="mt-1 block text-xs text-[var(--muted)]">{ds.description}</span>
        </label>

        <label className={styles.search}>Alan veya gösterge ara<input aria-label="Alan veya gösterge ara" type="search" placeholder="Müşteri, model, adet, tutar…" value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)} /></label>

        <fieldset>
          <legend className="font-medium">Göstergeler <span className={styles.counter}>{def.measures.length} / 12 seçili</span></legend>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {ds.measures.filter((m) => fieldMatches(m.label, m.key)).map((m) => (
              <label key={m.key} className="flex items-center gap-1" title={m.description ?? undefined}>
                <input type="checkbox" checked={def.measures.includes(m.key)} onChange={() => toggleMeasure(m.key)} />{m.label}
              </label>
            ))}
          </div>
          {def.measures.length > 0 && <div className={styles.selectionOrder} aria-label="Gösterge sırası">{def.measures.map((key, index) => <div key={key}><span>{index + 1}. {ds.measures.find((m) => m.key === key)?.label ?? key}</span><button type="button" aria-label={`${key} göstergesini yukarı taşı`} disabled={index === 0} onClick={() => { const measures = [...def.measures]; [measures[index - 1], measures[index]] = [measures[index], measures[index - 1]]; patch({ measures }); }}>↑</button><button type="button" aria-label={`${key} göstergesini aşağı taşı`} disabled={index === def.measures.length - 1} onClick={() => { const measures = [...def.measures]; [measures[index], measures[index + 1]] = [measures[index + 1], measures[index]]; patch({ measures }); }}>↓</button></div>)}</div>}
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="font-medium">Neye göre gruplanacak? <span className={styles.counter}>{def.dimensions?.length ?? 0} / 12</span></legend>
          {(def.dimensions ?? []).map((d, i) => {
            const meta = ds.dimensions.find((x) => x.key === d.field);
            return (
              <div key={i} className="flex gap-1">
                <select aria-label="Kırılım" className="pax-input min-w-0 flex-1" value={d.field} onChange={(e) => patch({ dimensions: def.dimensions!.map((x, j) => (j === i ? { field: e.target.value } : x)) })}>
                  {ds.dimensions.filter((x) => x.key === d.field || fieldMatches(x.label, x.key)).map((x) => <option key={x.key} value={x.key} disabled={def.dimensions?.some((dimension, index) => index !== i && dimension.field === x.key)}>{x.group ? `${x.group} · ` : ''}{x.label}</option>)}
                </select>
                {meta?.type === 'date' && (
                  <select aria-label="Zaman kırılımı" className="pax-input" value={d.grain ?? 'month'} onChange={(e) => patch({ dimensions: def.dimensions!.map((x, j) => (j === i ? { ...x, grain: e.target.value as TimeGrain } : x)) })}>
                    {(meta.grains ?? TIME_GRAINS).map((g) => <option key={g} value={g}>{GRAIN_LABEL[g]}</option>)}
                  </select>
                )}
                <button type="button" aria-label="Kırılımı kaldır" className="pax-btn px-2" onClick={() => patch({ dimensions: def.dimensions!.filter((_, j) => j !== i) })}>✕</button>
                <button type="button" className="pax-btn px-2" aria-label="Kırılımı yukarı taşı" disabled={i === 0} onClick={() => { const dimensions = [...def.dimensions!]; [dimensions[i - 1], dimensions[i]] = [dimensions[i], dimensions[i - 1]]; patch({ dimensions }); }}>↑</button>
              </div>
            );
          })}
          <button type="button" className="pax-btn" disabled={(def.dimensions?.length ?? 0) >= 12} onClick={() => {
            const f = ds.dimensions.find((field) => !def.dimensions?.some((dimension) => dimension.field === field.key) && fieldMatches(field.label, field.key));
            if (!f) return;
            patch({ dimensions: [...(def.dimensions ?? []), { field: f.key, ...(f.type === 'date' ? { grain: 'month' as const } : {}) }] });
          }}>+ Kırılım</button>
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="font-medium">Filtreler</legend>
          {(def.filters ?? []).map((f, i) => <FilterRow key={i} ds={ds} filter={f} onChange={(nf) => patch({ filters: def.filters!.map((x, j) => (j === i ? nf : x)) })} onRemove={() => patch({ filters: def.filters!.filter((_, j) => j !== i) })} />)}
          <button type="button" className="pax-btn" disabled={(def.filters?.length ?? 0) >= 20} onClick={() => patch({ filters: [...(def.filters ?? []), { field: ds.dimensions[0].key, op: 'eq', value: '' }] })}>+ Filtre</button>
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <label>Departman
            <select className="pax-input mt-1 w-full" value={def.department ?? 'all'} onChange={(e) => patch({ department: e.target.value as never })}>
              {DEPARTMENT_VALUES.map((d) => <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>)}
            </select>
          </label>
          <label>Dönem
            <select className="pax-input mt-1 w-full" value={def.dateRange?.type === 'relative' ? def.dateRange.preset : def.dateRange ? 'abs' : ''} onChange={(e) => {
              const v = e.target.value;
              if (!v) patch({ dateRange: undefined, compare: 'none' });
              else if (v === 'abs') patch({ dateRange: { type: 'absolute', from: new Date().getFullYear() + '-01-01', to: new Date().toISOString().slice(0, 10), field: def.dateRange?.field } });
              else patch({ dateRange: { type: 'relative', preset: v as never, field: def.dateRange?.field } });
            }}>
              <option value="">Tümü</option>
              {RELATIVE_PRESETS.map((p) => <option key={p} value={p}>{PRESET_LABEL[p]}</option>)}
              <option value="abs">Özel aralık…</option>
            </select>
          </label>
          {def.dateRange?.type === 'absolute' && (
            <>
              <label>Başlangıç<input type="date" className="pax-input mt-1 w-full" value={def.dateRange.from} onChange={(e) => patch({ dateRange: { ...def.dateRange as { type: 'absolute'; from: string; to: string }, from: e.target.value } })} /></label>
              <label>Bitiş<input type="date" className="pax-input mt-1 w-full" value={def.dateRange.to} onChange={(e) => patch({ dateRange: { ...def.dateRange as { type: 'absolute'; from: string; to: string }, to: e.target.value } })} /></label>
            </>
          )}
          {def.dateRange && dateDims.length > 1 && (
            <label>Tarih alanı
              <select className="pax-input mt-1 w-full" value={def.dateRange.field ?? ds.defaultDateField} onChange={(e) => patch({ dateRange: { ...def.dateRange!, field: e.target.value } })}>
                {dateDims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </label>
          )}
          <label>Karşılaştır
            <select className="pax-input mt-1 w-full" disabled={!def.dateRange} value={def.compare ?? 'none'} onChange={(e) => patch({ compare: e.target.value as never })}>
              <option value="none">Yok</option><option value="previous_period">Önceki dönem</option><option value="yoy">Geçen yıl</option>
            </select>
          </label>
          <label>Görünüm
            <select className="pax-input mt-1 w-full" value={viz} onChange={(e) => patch({ visualization: { ...def.visualization, type: e.target.value as VizType } })}>
              {VIZ_TYPES.filter((v) => v !== 'bar' && v !== 'line').map((v) => <option key={v} value={v}>{VIZ_LABEL[v]}</option>)}
            </select>
          </label>
          {(viz === 'pivot' || viz === 'heatmap') && (
            <label>Sütuna aç
              <select className="pax-input mt-1 w-full" value={def.visualization?.pivotColumn ?? ''} onChange={(e) => patch({ visualization: { ...def.visualization!, pivotColumn: e.target.value || undefined } })}>
                <option value="">Son kırılım</option>
                {(def.dimensions ?? []).map((d) => <option key={d.field} value={d.field}>{ds.dimensions.find((x) => x.key === d.field)?.label}</option>)}
              </select>
            </label>
          )}
          <label>Satır limiti<input type="number" min={1} max={5000} className="pax-input mt-1 w-full" value={def.limit ?? 500} onChange={(e) => patch({ limit: Math.max(1, Math.min(5000, Number(e.target.value) || 500)) })} /></label>
        </div>

        <CalcEditor calcs={def.calculated ?? []} measures={def.measures} onChange={(c) => patch({ calculated: c })} />

        <fieldset className="space-y-2"><legend className="font-medium">Sıralama ve öncelik</legend><p className="text-xs text-[var(--muted)]">İlk satır ana sıralamadır; eşit değerlerde sonraki satır uygulanır.</p>{(def.sort ?? []).map((sort, index) => <div className="flex gap-1" key={index}><select aria-label={`Sıralama alanı ${index + 1}`} className="pax-input min-w-0 flex-1" value={sort.field} onChange={(event) => patch({ sort: def.sort!.map((item, i) => i === index ? { ...item, field: event.target.value } : item) })}>{sortFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select><select aria-label={`Sıralama yönü ${index + 1}`} className="pax-input" value={sort.dir} onChange={(event) => patch({ sort: def.sort!.map((item, i) => i === index ? { ...item, dir: event.target.value as 'asc' | 'desc' } : item) })}><option value="asc">Artan</option><option value="desc">Azalan</option></select><button type="button" className="pax-btn" aria-label={`Sıralama ${index + 1} kaldır`} onClick={() => patch({ sort: def.sort!.filter((_, i) => i !== index) })}>×</button></div>)}<button type="button" className="pax-btn" disabled={!sortFields.length || (def.sort?.length ?? 0) >= 4} onClick={() => patch({ sort: [...(def.sort ?? []), { field: sortFields.find((field) => !def.sort?.some((sort) => sort.field === field.key))?.key ?? sortFields[0].key, dir: 'desc' }] })}>+ Sıralama ekle</button></fieldset>

        {issues.length > 0 && (
          <ul role="alert" className="list-disc space-y-0.5 pl-5 text-xs" style={{ color: TOKEN_CSS.danger }}>{issues.map((i, k) => <li key={k}>{i}</li>)}</ul>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="pax-btn pax-btn-primary" disabled={busy || !def.measures.length}>{busy ? 'Çalışıyor…' : 'Çalıştır'}</button>
          {onApply && <button type="button" className="pax-btn pax-btn-primary" disabled={!def.measures.length || !!definitionFilterIssue(def)} onClick={() => onApply(def)}>Bölüme uygula</button>}
          {onCancel && <button type="button" className="pax-btn" onClick={onCancel}>Vazgeç</button>}
        </div>

        {!onApply && (
          <fieldset className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <legend className="sr-only">Kaydet ve paylaş</legend>
            <label className="block">Başlık<input className="pax-input mt-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="block">Paylaşım
              <select className="pax-input mt-1 w-full" value={visibility} onChange={(e) => setVisibility(e.target.value as never)}>
                <option value="private">Yalnız ben</option><option value="roles">Rollerle</option><option value="everyone">Rapor erişimi olan herkes</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="pax-btn" disabled={!def.measures.length || !title.trim()} onClick={save}>{savedId ? 'Güncelle' : 'Kaydet'}</button>
              <button type="button" className="pax-btn" disabled={!def.measures.length || !!definitionFilterIssue(def)} onClick={() => downloadCsv(def).catch((e) => setIssues([e.message]))}>CSV</button>
              <button type="button" className="pax-btn" disabled={!def.measures.length || !!definitionFilterIssue(def)} onClick={pdf}>PDF</button>
            </div>
            {note && <p role="status" className="text-xs" style={{ color: TOKEN_CSS.success }}>{note}</p>}
          </fieldset>
        )}
      </form>

      <section className="pax-card min-w-0 p-4" aria-live="polite" aria-label="Önizleme">
        {result ? (
          <>
            <p className="mb-2 text-xs text-[var(--muted)]">
              {result.rows.length} satır · {result.durationMs} ms
              {result.range && ` · ${result.range.from} – ${result.range.to}`}
              {result.compareRange && ` · karşılaştırma ${result.compareRange.from} – ${result.compareRange.to}`}
            </p>
            <ResultView result={result} viz={viz} pivotColumn={def.visualization?.pivotColumn} title={title} />
          </>
        ) : <p className="pax-empty text-sm">Ölçü seçip “Çalıştır”a basın.</p>}
      </section>
    </div>
  );
}

export function FilterRow({ ds, filter, onChange, onRemove }: { ds: DatasetCatalogEntry; filter: Filter; onChange: (f: Filter) => void; onRemove: () => void }) {
  const fields = [...ds.dimensions.map((d) => ({ key: d.key, label: d.label, type: d.type, options: d.options })), ...ds.measures.map((m) => ({ key: m.key, label: `Σ ${m.label}`, type: 'number' as const, options: null }))];
  const meta = fields.find((f) => f.key === filter.field);
  const listId = `opts-${filter.field}`;
  const issue = filterInputIssue(filter);
  const operators = FILTER_OPS.filter((op) => ds.measures.some((measure) => measure.key === filter.field) ? ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'].includes(op) : meta?.type === 'boolean' ? ['eq', 'neq', 'is_null', 'not_null'].includes(op) : meta?.type === 'string' ? !['gt', 'gte', 'lt', 'lte', 'between'].includes(op) : !['contains', 'starts_with'].includes(op));
  const raw = Array.isArray(filter.value) ? filter.value.join(', ') : filter.value === undefined ? '' : String(filter.value);
  const setRaw = (s: string) => {
    if (LIST_OPS.includes(filter.op)) onChange({ ...filter, value: s.split(',').map((x) => x.trim()).filter(Boolean) });
    else if (filter.op === 'between') onChange({ ...filter, value: s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 2) });
    else if (meta?.type === 'boolean') onChange({ ...filter, value: s === 'true' });
    else onChange({ ...filter, value: s });
  };
  return (
    <div className="flex flex-wrap gap-1">
      <select aria-label="Alan" className="pax-input min-w-0 flex-1" value={filter.field} onChange={(e) => onChange({ field: e.target.value, op: 'eq', value: fields.find((field) => field.key === e.target.value)?.type === 'boolean' ? true : '' })}>
        {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
      <select aria-label="Koşul" className="pax-input" value={filter.op} onChange={(e) => onChange(changeFilterOperator({ ...filter, value: meta?.type === 'boolean' && (filter.value === undefined || filter.value === '') ? true : filter.value }, e.target.value as FilterOp))}>
        {operators.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
      </select>
      {!NO_VALUE.includes(filter.op) && (meta?.type === 'date' && filter.op === 'between'
        ? <div className="flex flex-wrap items-center gap-1">
            <input aria-label="Başlangıç tarihi" type="date" className="pax-input" value={Array.isArray(filter.value) ? String(filter.value[0] ?? '') : ''} onChange={(event) => onChange({ ...filter, value: [event.target.value, Array.isArray(filter.value) ? filter.value[1] ?? '' : ''] })} />
            <span aria-hidden>–</span>
            <input aria-label="Bitiş tarihi" type="date" className="pax-input" value={Array.isArray(filter.value) ? String(filter.value[1] ?? '') : ''} onChange={(event) => onChange({ ...filter, value: [Array.isArray(filter.value) ? filter.value[0] ?? '' : '', event.target.value] })} />
          </div>
        : meta?.type === 'boolean'
        ? <select aria-label="Değer" className="pax-input" value={String(filter.value ?? 'true')} onChange={(e) => setRaw(e.target.value)}><option value="true">Evet</option><option value="false">Hayır</option></select>
        : <>
            <input key={`${filter.field}-${filter.op}`} aria-label="Değer" aria-invalid={!!issue} list={meta?.options ? listId : undefined} className="pax-input w-32" type={meta?.type === 'date' && !LIST_OPS.includes(filter.op) && filter.op !== 'between' ? 'date' : 'text'}
              placeholder={LIST_OPS.includes(filter.op) || filter.op === 'between' ? 'a, b' : ''} defaultValue={raw} onChange={(e) => setRaw(e.target.value)} />
            {meta?.options && <datalist id={listId}>{meta.options.map((o) => <option key={o} value={o} />)}</datalist>}
          </>)}
      <button type="button" aria-label="Filtreyi kaldır" className="pax-btn px-2" onClick={onRemove}>✕</button>
      {issue && <p role="status" className="w-full text-xs text-[var(--muted)]">{issue}</p>}
    </div>
  );
}

export function CalcEditor({ calcs, measures, onChange }: { calcs: Calc[]; measures: string[]; onChange: (c: Calc[]) => void }) {
  return (
    <details>
      <summary className="cursor-pointer font-medium">Hesaplanmış alanlar ({calcs.length})</summary>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Formül: <code>[ölçü]</code>, + − × ÷, IF, ROUND, DIV, PCT, GROWTH, SHARE, RANK, RUNNING_SUM, SUM/AVG/MIN/MAX. Seçili ölçüler: {measures.join(', ') || '—'}
      </p>
      <div className="mt-1 space-y-2">
        {calcs.map((c, i) => (
          <div key={i} className="space-y-1 rounded-md border p-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex gap-1">
              <input aria-label="Anahtar" className="pax-input w-28" value={c.key} onChange={(e) => onChange(calcs.map((x, j) => (j === i ? { ...x, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') } : x)))} />
              <input aria-label="Etiket" className="pax-input min-w-0 flex-1" value={c.label} onChange={(e) => onChange(calcs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <select aria-label="Format" className="pax-input" value={c.format ?? 'number'} onChange={(e) => onChange(calcs.map((x, j) => (j === i ? { ...x, format: e.target.value as never } : x)))}>
                <option value="number">Sayı</option><option value="money">Para</option><option value="percent">Yüzde</option>
              </select>
              <button type="button" aria-label="Alanı kaldır" className="pax-btn px-2" onClick={() => onChange(calcs.filter((_, j) => j !== i))}>✕</button>
            </div>
            <input aria-label="Formül" className="pax-input w-full font-mono text-xs" placeholder="DIV([amount_usd], [sale_count])" value={c.formula ?? ''} onChange={(e) => onChange(calcs.map((x, j) => (j === i ? { key: x.key, label: x.label, format: x.format, formula: e.target.value } : x)))} />
          </div>
        ))}
        <button type="button" className="pax-btn" disabled={calcs.length >= 6} onClick={() => onChange([...calcs, { key: `calc${calcs.length + 1}`, label: 'Hesaplanan', formula: measures[0] ? `[${measures[0]}]` : '0' }])}>+ Alan</button>
      </div>
    </details>
  );
}
