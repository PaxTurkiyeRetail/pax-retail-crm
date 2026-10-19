'use client';
// 3 adımlı rapor sihirbazı: 1) Ne raporlanacak  2) Ne görmek istiyorsun (canlı önizleme)  3) Nasıl görünsün + kaydet/indir.
// Güçlü özellikler (karşılaştırma, ilk N, filtre, formül, koşullu renk, drill-down) "Gelişmiş" katmanında.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronLeft, ChevronRight, Download, FileDown, Gauge, Loader2, PieChart as PieIcon,
  Save, SlidersHorizontal, Table2, Undo2, X,
} from 'lucide-react';
import { definitionFilterIssue, normalizeDefinitionFilters } from '@/lib/report-builder/filter-input';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import type { ColorToken, ConditionalRule } from '@/lib/report-builder/page-types';
import type { ReportResult } from '@/lib/report-builder/result';
import { DEPARTMENT_VALUES, type ReportDefinitionInput, type TimeGrain, type VizType } from '@/lib/report-builder/types';
import { api, downloadCsv, fetchPdf, saveBlob, type LetterheadLite, type SavedDefinitionLite } from './api';
import {
  bucketRange, defaultDefinition, friendlyError, GRAIN_CHIP, PERIODS, periodToRange, rangeToPeriod, uiFor, type PeriodKey,
} from './friendly';
import { DEPARTMENT_LABEL } from './labels';
import { CalcEditor, FilterRow } from './QueryBuilder';
import { ResultView } from './renderers/WidgetRenderer';
import { TOKEN_CSS, TOKEN_SOFT } from './renderers/tokens';

type Def = ReportDefinitionInput;
type Step = 1 | 2 | 3;

const VIEWS: { type: VizType; label: string; hint: string; icon: typeof Table2 }[] = [
  { type: 'table', label: 'Tablo', hint: 'Satır satır rakamlar', icon: Table2 },
  { type: 'pie', label: 'Pasta', hint: 'Payların dağılımı', icon: PieIcon },
  { type: 'kpi', label: 'Özet kart', hint: 'Tek büyük rakam', icon: Gauge },
];

const STEPS: { n: Step; label: string }[] = [{ n: 1, label: 'Veri' }, { n: 2, label: 'İçerik' }, { n: 3, label: 'Görünüm ve kaydet' }];

function Chip({ on, onClick, children, tone = 'primary', disabled, title }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: ColorToken; disabled?: boolean; title?: string }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} title={title} onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
      style={on ? { background: TOKEN_SOFT[tone], borderColor: TOKEN_CSS[tone], color: TOKEN_CSS[tone] } : { borderColor: 'var(--border)' }}>
      {on && <Check size={14} aria-hidden />}{children}
    </button>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[var(--muted)]">{children}</p>;
}

type Props = {
  datasets: DatasetCatalogEntry[];
  letterheads: LetterheadLite[];
  /** Kayıtlı rapor veya hazır rapordan açılış. */
  initial?: { def: Def; title?: string; saved?: SavedDefinitionLite | null; step?: Step };
  onClose: () => void;
  onSaved?: () => void;
};

export default function ReportWizard({ datasets, letterheads, initial, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>(initial?.step ?? (initial ? 2 : 1));
  const [def, setDef] = useState<Def | null>(() => initial?.def ? normalizeDefinitionFilters(initial.def) : null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [savedId, setSavedId] = useState<string | null>(initial?.saved?.id ?? null);
  const [visibility, setVisibility] = useState<'private' | 'everyone'>(initial?.saved?.visibility === 'everyone' ? 'everyone' : 'private');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const rules = def?.style?.conditional ?? [];
  const setRules = (conditional: ConditionalRule[]) => setDef((current) => current ? {
    ...current, style: { ...current.style, conditional },
  } : current);
  const [drill, setDrill] = useState<{ label: string; def: Def }[]>([]);
  const [letterheadId, setLetterheadId] = useState<string>(letterheads.find((l) => l.isDefault)?.id ?? '');
  const reqId = useRef(0);

  const ds = def ? datasets.find((d) => d.key === def.dataset) ?? null : null;
  const ui = uiFor(def?.dataset ?? '');
  const viz = (def?.visualization?.type ?? 'table') as VizType;

  // CANLI önizleme: her değişiklikte 350 ms gecikmeyle çalışır; eski yanıtlar yok sayılır.
  useEffect(() => {
    if (!def || step === 1 || !def.measures.length) { setResult(null); return; }
    const id = ++reqId.current;
    const issue = definitionFilterIssue(def);
    if (issue) { setResult(null); setLoading(false); setError(issue); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api.query(def).then((r) => { if (id === reqId.current) { setResult(r); setError(null); } })
        .catch((e) => { if (id === reqId.current) { setResult(null); setError(friendlyError(e)); } })
        .finally(() => { if (id === reqId.current) setLoading(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [def, step]);

  const patch = (p: Partial<Def>) => setDef((d) => (d ? { ...d, ...p } : d));

  const pickDataset = (d: DatasetCatalogEntry) => {
    setDef(defaultDefinition(d.key, d.measures.map((m) => m.key), d.dimensions, d.defaultDateField));
    if (!title) setTitle(uiFor(d.key).title || d.label);
    setDrill([]); setStep(2);
  };

  const groupChips = useMemo(() => {
    if (!ds) return [];
    const keys = [...ui.groups.filter((k) => ds.dimensions.some((d) => d.key === k))];
    return keys.map((k) => ds.dimensions.find((d) => d.key === k)!);
  }, [ds, ui.groups]);

  if (step === 1 || !def || !ds) {
    return (
      <Shell step={1} onClose={onClose} onStep={() => undefined} canGo={() => false}>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Neyi raporlamak istiyorsun?</h2>
          <Help>Bir konu seç; sonraki adımda en çok kullanılan rakamlar hazır seçili gelir, hemen sonucu görürsün.</Help>
        </div>
        {!datasets.length ? <p className="pax-empty mt-4 text-sm">Rapor alabileceğin veri bulunamadı. Yetki için yöneticine başvur.</p> : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {datasets.map((d) => {
              const u = uiFor(d.key); const Icon = u.icon;
              return (
                <button key={d.key} type="button" onClick={() => pickDataset(d)}
                  className="pax-card group flex h-full flex-col gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: TOKEN_SOFT[u.tone], color: TOKEN_CSS[u.tone] }}><Icon size={22} aria-hidden /></span>
                  <span className="text-base font-semibold">{u.title || d.label}</span>
                  <span className="text-sm text-[var(--muted)]">{u.desc || d.description}</span>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium" style={{ color: TOKEN_CSS.primary }}>Seç <ChevronRight size={14} aria-hidden /></span>
                </button>
              );
            })}
          </div>
        )}
      </Shell>
    );
  }

  const dims = def.dimensions ?? [];
  const dateDims = ds.dimensions.filter((d) => d.type === 'date');
  const period = rangeToPeriod(def.dateRange);
  const firstMeasure = def.measures[0];
  const topN = def.limit && def.limit <= 100 ? def.limit : 0;

  const toggleMeasure = (k: string) => {
    const has = def.measures.includes(k);
    if (has && def.measures.length === 1) return;
    patch({ measures: has ? def.measures.filter((m) => m !== k) : [...def.measures, k].slice(0, 12) });
  };
  const toggleGroup = (k: string) => {
    const meta = ds.dimensions.find((d) => d.key === k)!;
    const has = dims.some((d) => d.field === k);
    const next = has ? dims.filter((d) => d.field !== k) : [...dims, { field: k, ...(meta.type === 'date' ? { grain: 'month' as const } : {}) }].slice(-3);
    const nv: VizType = next.length === 0 ? 'kpi' : viz === 'kpi' ? (meta.type === 'date' ? 'bar' : 'table') : viz;
    patch({ dimensions: next, visualization: { ...def.visualization, type: nv } });
  };
  const setGrain = (k: string, g: TimeGrain) => patch({ dimensions: dims.map((d) => (d.field === k ? { ...d, grain: g } : d)) });
  const setPeriod = (p: PeriodKey) => patch({ dateRange: periodToRange(p, def.dateRange?.field), ...(p === 'all' ? { compare: 'none' } : {}) });

  // Drill-down: grafikte çubuğa / dilime tıkla → o değerle süz, bir sonraki gruplamaya in.
  const onDrill = dims.length >= 1 ? (value: unknown, label: string) => {
    const d0 = dims[0];
    const meta = ds.dimensions.find((d) => d.key === d0.field);
    const nextGroup = groupChips.find((g) => g.key !== d0.field && g.type !== 'date' && !dims.some((x) => x.field === g.key));
    if (!nextGroup) return;
    let p: Partial<Def>;
    if (meta?.type === 'date') {
      const r = bucketRange(value, d0.grain ?? 'month');
      if (!r) return;
      p = { dateRange: { type: 'absolute', from: r.from, to: r.to, field: d0.field }, compare: 'none' };
    } else {
      if (value === null || value === undefined) return;
      p = { filters: [...(def.filters ?? []).filter((f) => f.field !== d0.field), { field: d0.field, op: 'eq', value: value as string | number | boolean }] };
    }
    setDrill((s) => [...s, { label: `${meta?.label ?? ''}: ${label}`, def }]);
    patch({ ...p, dimensions: [{ field: nextGroup.key }, ...dims.slice(1)] });
  } : undefined;

  const style = { ...def.style, accent: def.style?.accent ?? ui.tone, conditional: rules };
  const pdfBody = () => {
    const wType = viz === 'kpi' ? 'kpi_strip' : viz;
    return {
      title: title || 'Rapor',
      ...(letterheadId ? { letterheadId } : { letterheadId: null }),
      page: { version: 1, title: title || 'Rapor', department: def.department ?? 'all', widgets: [
        { id: 'h', type: 'text', variant: 'heading', text: title || 'Rapor', layout: { lg: { x: 0, y: 0, w: 12, h: 1 } } },
        { id: 'r', type: wType, title: '', query: def, style: { ...style, showTitle: false }, layout: { lg: { x: 0, y: 1, w: 12, h: viz === 'kpi' ? 2 : 8 } } },
      ] },
    };
  };

  const save = async () => {
    setNote(null); setError(null);
    const issue = definitionFilterIssue(def);
    if (issue) { setError(issue); return; }
    try {
      const body = { title: title.trim() || 'Rapor', description: '', visibility, definition: def };
      if (savedId) await api.updateDefinition(savedId, body); else setSavedId((await api.createDefinition(body)).id);
      setNote(visibility === 'everyone' ? 'Kaydedildi ve rapor erişimi olan herkesle paylaşıldı.' : 'Kaydedildi. Rapor Merkezi › Raporlarım altında bulabilirsin.');
      onSaved?.();
    } catch (e) { setError(friendlyError(e)); }
  };
  const pdf = async () => {
    setError(null);
    const issue = definitionFilterIssue(def);
    if (issue) { setError(issue); return; }
    try { const { blob, fileName } = await fetchPdf(pdfBody()); saveBlob(blob, fileName); } catch (e) { setError(friendlyError(e)); }
  };
  const csv = () => { setError(null); const issue = definitionFilterIssue(def); if (issue) { setError(issue); return; } downloadCsv(def).catch((e) => setError(friendlyError(e))); };
  const shareLink = savedId ? `${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}?report=${savedId}` : null;

  const preview = (
    <section className="pax-card min-w-0 p-4" aria-live="polite" aria-label="Canlı önizleme">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold">{title || 'Önizleme'}</h3>
        {loading && <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]"><Loader2 size={14} className="animate-spin" aria-hidden />Güncelleniyor…</span>}
        {result && !loading && <span className="text-xs text-[var(--muted)]">{result.rows.length} satır{result.range ? ` · ${result.range.from} – ${result.range.to}` : ''}{result.compareRange ? ` · kıyas ${result.compareRange.from} – ${result.compareRange.to}` : ''}</span>}
      </div>
      {drill.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--muted)]">Detaya inildi:</span>
          {drill.map((d, i) => <span key={i} className="rounded-full px-2 py-0.5" style={{ background: TOKEN_SOFT.primary, color: TOKEN_CSS.primary }}>{d.label}</span>)}
          <button type="button" className="pax-btn inline-flex items-center gap-1 px-2 py-0.5 text-xs" onClick={() => { const last = drill[drill.length - 1]; setDrill((s) => s.slice(0, -1)); setDef(last.def); }}><Undo2 size={12} aria-hidden />Geri çık</button>
        </div>
      )}
      {error ? <p role="alert" className="rounded-lg p-3 text-sm" style={{ background: TOKEN_SOFT.danger, color: TOKEN_CSS.danger }}>{error}</p>
        : result ? (result.rows.length ? (
          <>
            <ResultView result={result} viz={viz} title={title} style={style} onDrill={onDrill && (viz === 'bar' || viz === 'line' || viz === 'pie') ? onDrill : undefined} />
            {onDrill && (viz === 'bar' || viz === 'line' || viz === 'pie') && <Help>İpucu: bir çubuğa / dilime tıkla, o kalemin detayına in.</Help>}
          </>
        ) : <p className="pax-empty p-6 text-center text-sm">Bu seçimlerle kayıt bulunamadı. Dönemi genişletmeyi veya departmanı “Tümü” yapmayı dene.</p>)
          : <p className="pax-empty p-6 text-center text-sm">{loading ? 'Rapor hazırlanıyor…' : 'En az bir rakam seç; sonuç burada anında görünür.'}</p>}
    </section>
  );

  return (
    <Shell step={step} onClose={onClose} onStep={setStep} canGo={(n) => n === 1 || def.measures.length > 0}>
      {step === 2 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(340px,440px)_1fr]">
          <div className="pax-card space-y-5 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: TOKEN_SOFT[ui.tone], color: TOKEN_CSS[ui.tone] }}><ui.icon size={16} aria-hidden /></span>
                <h2 className="text-lg font-semibold">Ne görmek istiyorsun?</h2>
              </div>
              <Help>{ui.title || ds.label} · Seçimlerini değiştirdikçe sağdaki önizleme kendiliğinden güncellenir.</Help>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Rakamlar</legend>
              <div className="flex flex-wrap gap-2">
                {ds.measures.map((m) => <Chip key={m.key} on={def.measures.includes(m.key)} onClick={() => toggleMeasure(m.key)} title={m.description ?? undefined}>{m.label}</Chip>)}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Neye göre grupla?</legend>
              <div className="flex flex-wrap gap-2">
                {groupChips.map((g) => <Chip key={g.key} tone="accent" on={dims.some((d) => d.field === g.key)} onClick={() => toggleGroup(g.key)}>{g.type === 'date' ? `Zaman (${g.label})` : g.label}</Chip>)}
                <select aria-label="Diğer gruplama" className="pax-input rounded-full py-1 text-sm" value="" onChange={(e) => e.target.value && toggleGroup(e.target.value)}>
                  <option value="">Diğer…</option>
                  {ds.dimensions.filter((d) => !groupChips.some((g) => g.key === d.key)).map((d) => <option key={d.key} value={d.key}>{d.group ? `${d.group} · ` : ''}{d.label}{dims.some((x) => x.field === d.key) ? ' ✓' : ''}</option>)}
                </select>
              </div>
              {dims.filter((d) => ds.dimensions.find((x) => x.key === d.field)?.type === 'date').map((d) => (
                <div key={d.field} className="flex flex-wrap items-center gap-1 text-sm">
                  <span className="text-xs text-[var(--muted)]">Zaman adımı:</span>
                  {(ds.dimensions.find((x) => x.key === d.field)?.grains ?? ['month']).map((g) => <Chip key={g} tone="accent" on={(d.grain ?? 'month') === g} onClick={() => setGrain(d.field, g as TimeGrain)}>{GRAIN_CHIP[g as TimeGrain]}</Chip>)}
                </div>
              ))}
              {!dims.length && <Help>Gruplama seçmezsen tek bir toplam rakam görürsün.</Help>}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Dönem</legend>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((p) => <Chip key={p.key} tone="info" on={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</Chip>)}
                {period === 'custom' && <Chip tone="info" on onClick={() => undefined}>Özel aralık</Chip>}
              </div>
              {def.dateRange?.type === 'absolute' && (
                <div className="flex flex-wrap gap-2 text-sm">
                  <label>Başlangıç <input type="date" className="pax-input" value={def.dateRange.from} onChange={(e) => patch({ dateRange: { ...(def.dateRange as { type: 'absolute'; from: string; to: string }), from: e.target.value } })} /></label>
                  <label>Bitiş <input type="date" className="pax-input" value={def.dateRange.to} onChange={(e) => patch({ dateRange: { ...(def.dateRange as { type: 'absolute'; from: string; to: string }), to: e.target.value } })} /></label>
                </div>
              )}
              {period !== 'custom' && <button type="button" className="text-xs underline" style={{ color: TOKEN_CSS.primary }} onClick={() => { const r = periodToRange('last_12m', def.dateRange?.field); patch({ dateRange: r }); }}>Tarihleri elle seç</button>}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Departman</legend>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENT_VALUES.map((d) => <Chip key={d} tone="success" on={(def.department ?? 'all') === d} onClick={() => patch({ department: d })}>{DEPARTMENT_LABEL[d]}</Chip>)}
              </div>
            </fieldset>

            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <button type="button" aria-expanded={advanced} className="inline-flex items-center gap-2 text-sm font-semibold" onClick={() => setAdvanced((x) => !x)}>
                <SlidersHorizontal size={16} aria-hidden />Gelişmiş {advanced ? '▴' : '▾'}
                <span className="font-normal text-[var(--muted)]">kıyas, ilk N, sıralama, filtre, formül, renk</span>
              </button>
              {advanced && (
                <div className="mt-3 space-y-4 text-sm">
                  <div className="space-y-1">
                    <div className="font-medium">Karşılaştır</div>
                    <div className="flex flex-wrap gap-2">
                      {([['none', 'Yok'], ['previous_period', 'Önceki dönemle'], ['yoy', 'Geçen yılla']] as const).map(([k, l]) => <Chip key={k} on={(def.compare ?? 'none') === k} disabled={k !== 'none' && !def.dateRange} title={!def.dateRange ? 'Önce bir dönem seç' : undefined} onClick={() => patch({ compare: k })}>{l}</Chip>)}
                    </div>
                    <Help>Tabloda “önceki” sütunu, özet kartta artış/azalış oku çıkar.</Help>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label>İlk
                      <select className="pax-input ml-1" value={topN} onChange={(e) => {
                        const n = Number(e.target.value);
                        patch(n ? { limit: n, sort: [{ field: firstMeasure, dir: 'desc' }] } : { limit: 500 });
                      }}>
                        <option value={0}>Tümü</option>{[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <label>Sırala
                      <select className="pax-input ml-1" value={def.sort?.[0] ? `${def.sort[0].field}:${def.sort[0].dir}` : ''} onChange={(e) => {
                        const [f, dir] = e.target.value.split(':');
                        patch({ sort: f ? [{ field: f, dir: dir as 'asc' | 'desc' }] : [] });
                      }}>
                        <option value="">Varsayılan</option>
                        {def.measures.map((m) => { const l = ds.measures.find((x) => x.key === m)?.label; return [<option key={m + 'd'} value={`${m}:desc`}>{l} (büyükten küçüğe)</option>, <option key={m + 'a'} value={`${m}:asc`}>{l} (küçükten büyüğe)</option>]; })}
                        {dims.map((d) => <option key={d.field} value={`${d.field}:asc`}>{ds.dimensions.find((x) => x.key === d.field)?.label} (A→Z)</option>)}
                      </select>
                    </label>
                    {def.dateRange && dateDims.length > 1 && (
                      <label>Tarih alanı
                        <select className="pax-input ml-1" value={def.dateRange.field ?? ds.defaultDateField ?? ''} onChange={(e) => patch({ dateRange: { ...def.dateRange!, field: e.target.value } })}>
                          {dateDims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">Filtreler</div>
                    {(def.filters ?? []).map((f, i) => <FilterRow key={`${i}-${f.field}`} ds={ds} filter={f} onChange={(nf) => patch({ filters: def.filters!.map((x, j) => (j === i ? nf : x)) })} onRemove={() => patch({ filters: def.filters!.filter((_, j) => j !== i) })} />)}
                    <button type="button" className="pax-btn" disabled={(def.filters?.length ?? 0) >= 20} onClick={() => patch({ filters: [...(def.filters ?? []), { field: ds.dimensions[0].key, op: 'eq', value: '' }] })}>+ Filtre ekle</button>
                    <Help>Örn. Satıcı = Ahmet, Para birimi = USD. Değeri yazıp alandan çıkınca uygulanır.</Help>
                  </div>
                  <CalcEditor calcs={def.calculated ?? []} measures={def.measures} onChange={(c) => patch({ calculated: c })} />
                  <RulesEditor rules={rules} onChange={setRules} columns={[...def.measures.map((m) => ({ key: m, label: ds.measures.find((x) => x.key === m)?.label ?? m })), ...(def.calculated ?? []).map((c) => ({ key: `c_${c.key}`, label: c.label }))]} />
                </div>
              )}
            </div>

            <div className="flex justify-between gap-2">
              <button type="button" className="pax-btn inline-flex items-center gap-1" onClick={() => setStep(1)}><ChevronLeft size={16} aria-hidden />Geri</button>
              <button type="button" className="pax-btn pax-btn-primary inline-flex items-center gap-1" disabled={!def.measures.length} onClick={() => setStep(3)}>Devam: görünüm<ChevronRight size={16} aria-hidden /></button>
            </div>
          </div>
          {preview}
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(340px,440px)_1fr]">
          <div className="pax-card space-y-5 p-4">
            <div>
              <h2 className="text-lg font-semibold">Nasıl görünsün?</h2>
              <Help>Bir görünüm seç, rapora ad ver; kaydet veya hemen indir.</Help>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VIEWS.map((v) => {
                const on = viz === v.type; const Icon = v.icon;
                const bad = v.type !== 'kpi' && v.type !== 'table' && !dims.length;
                return (
                  <button key={v.type} type="button" aria-pressed={on} disabled={bad} title={bad ? 'Bu görünüm için bir gruplama seç' : undefined}
                    onClick={() => patch({ visualization: { ...def.visualization, type: v.type } })}
                    className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition disabled:opacity-40"
                    style={on ? { borderColor: TOKEN_CSS.primary, background: TOKEN_SOFT.primary } : { borderColor: 'var(--border)' }}>
                    <Icon size={22} aria-hidden style={{ color: on ? TOKEN_CSS.primary : 'var(--muted)' }} />
                    <span className="text-sm font-semibold">{v.label}</span>
                    <span className="text-xs text-[var(--muted)]">{v.hint}</span>
                  </button>
                );
              })}
            </div>
            <label className="block text-sm font-semibold">Rapor adı
              <input className="pax-input mt-1 w-full font-normal" value={title} placeholder="Örn. Aylık cihaz satışı" onChange={(e) => setTitle(e.target.value)} />
            </label>
            <fieldset className="space-y-1 text-sm">
              <legend className="font-semibold">Kimler görsün?</legend>
              <div className="flex flex-wrap gap-2">
                <Chip on={visibility === 'private'} onClick={() => setVisibility('private')}>Yalnız ben</Chip>
                <Chip on={visibility === 'everyone'} onClick={() => setVisibility('everyone')}>Rapor erişimi olan herkes</Chip>
              </div>
              <Help>Herkes kendi yetkisi kadar veri görür; paylaşmak yetki genişletmez.</Help>
            </fieldset>
            {letterheads.length > 0 && (
              <label className="block text-sm font-semibold">PDF antedi
                <select className="pax-input mt-1 w-full font-normal" value={letterheadId} onChange={(e) => setLetterheadId(e.target.value)}>
                  <option value="">Antetsiz</option>
                  {letterheads.map((l) => <option key={l.id} value={l.id}>{l.name}{l.isDefault ? ' (varsayılan)' : ''}</option>)}
                </select>
              </label>
            )}
            {note && <p role="status" className="rounded-lg p-2 text-sm" style={{ background: TOKEN_SOFT.success, color: TOKEN_CSS.success }}>{note}</p>}
            {shareLink && visibility === 'everyone' && (
              <div className="flex gap-1 text-xs">
                <input readOnly aria-label="Paylaşım bağlantısı" className="pax-input min-w-0 flex-1 text-xs" value={shareLink} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="pax-btn text-xs" onClick={() => navigator.clipboard?.writeText(shareLink).then(() => setNote('Bağlantı kopyalandı.'))}>Kopyala</button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="pax-btn pax-btn-primary inline-flex items-center gap-1" disabled={!title.trim()} onClick={save}><Save size={16} aria-hidden />{savedId ? 'Güncelle' : 'Kaydet'}</button>
              <button type="button" className="pax-btn inline-flex items-center gap-1" onClick={pdf}><FileDown size={16} aria-hidden />PDF</button>
              <button type="button" className="pax-btn inline-flex items-center gap-1" onClick={csv}><Download size={16} aria-hidden />Excel (CSV)</button>
            </div>
            <div className="flex justify-between">
              <button type="button" className="pax-btn inline-flex items-center gap-1" onClick={() => setStep(2)}><ChevronLeft size={16} aria-hidden />Geri</button>
              <button type="button" className="pax-btn" onClick={onClose}>Bitir</button>
            </div>
          </div>
          {preview}
        </div>
      )}
    </Shell>
  );
}

function Shell({ step, onClose, onStep, canGo, children }: { step: Step; onClose: () => void; onStep: (s: Step) => void; canGo: (s: Step) => boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ol className="mr-auto flex flex-wrap items-center gap-2" aria-label="Adımlar">
          {STEPS.map((s, i) => {
            const done = s.n < step; const cur = s.n === step;
            return (
              <li key={s.n} className="flex items-center gap-2">
                <button type="button" disabled={cur || !canGo(s.n)} onClick={() => onStep(s.n)} aria-current={cur ? 'step' : undefined}
                  className="inline-flex items-center gap-2 rounded-full px-1 py-0.5 text-sm disabled:cursor-default">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                    style={cur ? { background: TOKEN_CSS.primary, color: '#fff' } : done ? { background: TOKEN_SOFT.success, color: TOKEN_CSS.success } : { background: 'var(--app-bg, #f4f6fb)', color: 'var(--muted)' }}>
                    {done ? <Check size={14} aria-hidden /> : s.n}
                  </span>
                  <span className={cur ? 'font-semibold' : 'text-[var(--muted)]'}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <span aria-hidden className="h-px w-6 sm:w-10" style={{ background: 'var(--border)' }} />}
              </li>
            );
          })}
        </ol>
        <button type="button" className="pax-btn inline-flex items-center gap-1" onClick={onClose}><X size={16} aria-hidden />Rapor Merkezi</button>
      </div>
      {children}
    </div>
  );
}

function RulesEditor({ rules, onChange, columns }: { rules: ConditionalRule[]; onChange: (r: ConditionalRule[]) => void; columns: { key: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <div className="font-medium">Koşullu renk</div>
      {rules.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1">
          <select aria-label="Sütun" className="pax-input" value={r.column} onChange={(e) => onChange(rules.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)))}>
            {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select aria-label="Koşul" className="pax-input" value={r.op} onChange={(e) => onChange(rules.map((x, j) => (j === i ? { ...x, op: e.target.value as ConditionalRule['op'] } : x)))}>
            <option value="gte">≥</option><option value="gt">&gt;</option><option value="lte">≤</option><option value="lt">&lt;</option><option value="eq">=</option>
          </select>
          <input aria-label="Değer" type="number" className="pax-input w-24" value={r.value} onChange={(e) => onChange(rules.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) || 0 } : x)))} />
          {(['success', 'warning', 'danger'] as const).map((c) => (
            <button key={c} type="button" aria-label={c === 'success' ? 'Yeşil' : c === 'warning' ? 'Sarı' : 'Kırmızı'} aria-pressed={r.color === c}
              className="h-7 w-7 rounded-full border-2" style={{ background: TOKEN_CSS[c], borderColor: r.color === c ? 'var(--text, #111)' : 'transparent' }}
              onClick={() => onChange(rules.map((x, j) => (j === i ? { ...x, color: c } : x)))} />
          ))}
          <button type="button" aria-label="Kuralı sil" className="pax-btn px-2" onClick={() => onChange(rules.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="pax-btn" disabled={!columns.length || rules.length >= 10} onClick={() => onChange([...rules, { column: columns[0].key, op: 'gte', value: 0, color: 'success' }])}>+ Renk kuralı</button>
      <Help>Tabloda ve özet kartlarda rakamı renklendirir (PDF’e de yansır).</Help>
    </div>
  );
}
