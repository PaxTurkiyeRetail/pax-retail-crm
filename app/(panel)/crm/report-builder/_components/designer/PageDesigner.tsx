'use client';
// Sayfa görüntüleyici + designer. Paketsiz 12 kolon grid: pointer ile taşı / boyutlandır, ekle / sil.
// Görüntüleme ve düzenleme modu ayrı; düzenleme yalnız canDesign (report.builder.design) ile.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BREAKPOINT_COLUMNS, COLOR_TOKENS, GRID_COLUMNS, isDataWidget, parsePageDefinition, resolveLayout,
  type Breakpoint, type PageDefinition, type PageWidget,
} from '@/lib/report-builder/page-types';
import type { WidgetData } from '@/lib/report-builder/pdf';
import { DEPARTMENT_VALUES, RELATIVE_PRESETS, ReportDefinitionError, type ReportDefinitionInput } from '@/lib/report-builder/types';
import { api, ApiFailure, fetchPdf, saveBlob, type LetterheadLite, type SavedPageLite } from '../api';
import { DataWidgetBody, TextBlock } from '../renderers/WidgetRenderer';
import { TOKEN_CSS } from '../renderers/tokens';
import { DEPARTMENT_LABEL, PRESET_LABEL } from '../labels';

const ROW_PX = 56;
const GAP_PX = 12;

type Props = {
  pageId: string;
  canDesign: boolean;
  letterheads: LetterheadLite[];
  onBack: () => void;
  onEditQuery: (query: ReportDefinitionInput, apply: (q: ReportDefinitionInput) => void) => void;
};

function newId(page: PageDefinition, prefix: string) {
  let i = page.widgets.length + 1;
  while (page.widgets.some((w) => w.id === `${prefix}${i}`)) i += 1;
  return `${prefix}${i}`;
}

function nextY(page: PageDefinition) {
  return page.widgets.reduce((m, w) => Math.max(m, w.layout.lg.y + w.layout.lg.h), 0);
}

const NEW_WIDGETS: { type: PageWidget['type']; label: string }[] = [
  { type: 'kpi_strip', label: 'KPI şeridi' }, { type: 'table', label: 'Tablo' }, { type: 'pivot', label: 'Pivot' },
  { type: 'bar', label: 'Bar' }, { type: 'line', label: 'Çizgi' }, { type: 'pie', label: 'Pasta' },
  { type: 'heatmap', label: 'Isı tablosu' }, { type: 'text', label: 'Metin' }, { type: 'filter', label: 'Filtre' }, { type: 'tabs', label: 'Sekme' },
];

function makeWidget(page: PageDefinition, type: PageWidget['type']): unknown {
  const base = { id: newId(page, 'w'), title: NEW_WIDGETS.find((n) => n.type === type)?.label ?? '', layout: { lg: { x: 0, y: nextY(page), w: type === 'text' || type === 'filter' ? 4 : 6, h: type === 'text' || type === 'filter' || type === 'tabs' ? 1 : 4 } } };
  if (type === 'text') return { ...base, type, variant: 'paragraph', text: 'Metin' };
  if (type === 'filter') {
    if (!page.filters.length) return null;
    return { ...base, type, filterKey: page.filters[0].key };
  }
  if (type === 'tabs') return { ...base, type, layout: { lg: { ...base.layout.lg, w: 12 } }, tabs: [{ key: 'genel', label: 'Genel' }, { key: 'detay', label: 'Detay' }] };
  const viz = type === 'kpi_strip' ? 'kpi' : type;
  return { ...base, type, query: { dataset: 'sales', measures: ['sale_count'], dimensions: viz === 'kpi' ? [] : [{ field: 'sale_date', grain: 'month' }], visualization: { type: viz, ...(viz === 'pivot' || viz === 'heatmap' ? { pivotColumn: 'sale_date' } : {}) } } };
}

function useBreakpoint(ref: React.RefObject<HTMLDivElement | null>, forced: Breakpoint | 'auto'): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>('lg');
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setBp(w < 640 ? 'sm' : w < 1024 ? 'md' : 'lg');
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return forced === 'auto' ? bp : forced;
}

export default function PageDesigner({ pageId, canDesign, letterheads, onBack, onEditQuery }: Props) {
  const [meta, setMeta] = useState<SavedPageLite | null>(null);
  const [page, setPage] = useState<PageDefinition | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [data, setData] = useState<Record<string, WidgetData>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Breakpoint | 'auto'>('auto');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [letterheadId, setLetterheadId] = useState<string>('default');
  const [versions, setVersions] = useState<{ version: number; title: string; created_at: string }[] | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const bp = useBreakpoint(gridRef, preview);
  const editMode = editing && canDesign && !!meta?.can_edit;

  const load = useCallback(async () => {
    const r = await api.page(pageId);
    setMeta(r.page);
    setPage(r.page.page);
    setDirty(false);
    if (r.page.letterhead_id) setLetterheadId(r.page.letterhead_id);
  }, [pageId]);

  useEffect(() => { load().catch((e) => setMsg({ kind: 'err', text: e.message })); }, [load]);

  const run = useCallback(async (p: PageDefinition, v: Record<string, unknown>, ids?: string[]) => {
    setData((d) => { const n = { ...d }; (ids ?? p.widgets.map((w) => w.id)).forEach((id) => delete n[id]); return n; });
    try {
      const r = dirty || ids ? await api.runPage({ page: p, values: v, widgetIds: ids }) : await api.runPage({ pageId, values: v });
      setData((d) => ({ ...d, ...r.data }));
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    }
  }, [dirty, pageId]);

  // Filtre değişince tüm sayfa; yapı değişimi için "Önizlemeyi yenile".
  const pageRef = useRef<PageDefinition | null>(null);
  pageRef.current = page;
  const loaded = !!page;
  useEffect(() => {
    if (pageRef.current) run(pageRef.current, values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, loaded, meta?.version]);

  const update = (fn: (p: PageDefinition) => unknown) => {
    if (!page) return;
    try {
      const next = parsePageDefinition(fn(structuredClone(page)));
      setPage(next);
      setDirty(true);
      setMsg(null);
    } catch (e) {
      const issues = e instanceof ReportDefinitionError ? e.issues.join(' · ') : (e as Error).message;
      setMsg({ kind: 'err', text: issues });
    }
  };
  const updateWidget = (id: string, fn: (w: PageWidget) => void) => update((p) => { const w = p.widgets.find((x) => x.id === id); if (w) fn(w); return p; });

  const save = async () => {
    if (!page || !meta) return;
    try {
      const r = await api.updatePage(meta.id, { page, baseVersion: meta.version, visibility: meta.visibility, sharedRoles: meta.shared_roles, letterheadId: letterheadId === 'default' || letterheadId === 'none' ? null : letterheadId });
      setMeta({ ...meta, version: r.version });
      setDirty(false);
      setMsg({ kind: 'ok', text: `Kaydedildi (sürüm ${r.version})` });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiFailure && e.status === 409 ? 'Sayfa başka biri tarafından değiştirildi. Yeniden yükleyin.' : (e as Error).message });
    }
  };

  const pdfBody = () => ({ ...(dirty ? { page } : { pageId }), values, letterheadId: letterheadId === 'none' ? null : letterheadId === 'default' ? undefined : letterheadId });
  const pdfPreview = async () => {
    try {
      const { blob } = await fetchPdf({ ...pdfBody(), inline: true });
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  };
  const pdfDownload = async () => {
    try { const { blob, fileName } = await fetchPdf(pdfBody()); saveBlob(blob, fileName); } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  };

  const layout = useMemo(() => (page ? resolveLayout(page.widgets, bp) : []), [page, bp]);
  const visibleIds = useMemo(() => {
    if (!page) return new Set<string>();
    const tabsWidgets = page.widgets.filter((w): w is Extract<PageWidget, { type: 'tabs' }> => w.type === 'tabs');
    const active = new Set(tabsWidgets.map((t) => activeTab[t.id] ?? t.tabs[0].key));
    return new Set(page.widgets.filter((w) => !w.tab || active.has(w.tab) || editMode).map((w) => w.id));
  }, [page, activeTab, editMode]);

  // --- pointer ile taşı / boyutlandır (yalnız lg düzeni düzenlenir) ---
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; orig: { x: number; y: number; w: number; h: number } } | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    if (!editMode || bp !== 'lg' || !page) return;
    const w = page.widgets.find((x) => x.id === id)!;
    drag.current = { id, mode, sx: e.clientX, sy: e.clientY, orig: { ...w.layout.lg } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !gridRef.current) return;
    const colPx = (gridRef.current.clientWidth + GAP_PX) / GRID_COLUMNS;
    const dc = Math.round((e.clientX - d.sx) / colPx);
    const dr = Math.round((e.clientY - d.sy) / (ROW_PX + GAP_PX));
    const o = d.orig;
    const g = d.mode === 'move'
      ? { x: Math.max(0, Math.min(GRID_COLUMNS - o.w, o.x + dc)), y: Math.max(0, o.y + dr), w: o.w, h: o.h }
      : { x: o.x, y: o.y, w: Math.max(1, Math.min(GRID_COLUMNS - o.x, o.w + dc)), h: Math.max(1, Math.min(40, o.h + dr)) };
    setGhost({ id: d.id, ...g });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && ghost) updateWidget(d.id, (w) => { w.layout.lg = { x: ghost.x, y: ghost.y, w: ghost.w, h: ghost.h }; });
    setGhost(null);
  };
  const nudge = (id: string, e: React.KeyboardEvent) => {
    if (!editMode || bp !== 'lg') return;
    const map: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    updateWidget(id, (w) => {
      const l = w.layout.lg;
      if (e.shiftKey) { l.w = Math.max(1, Math.min(GRID_COLUMNS - l.x, l.w + m[0])); l.h = Math.max(1, l.h + m[1]); }
      else { l.x = Math.max(0, Math.min(GRID_COLUMNS - l.w, l.x + m[0])); l.y = Math.max(0, l.y + m[1]); }
    });
  };

  if (!page || !meta) return <div className="pax-card p-6">{msg ? <p role="alert">{msg.text}</p> : 'Yükleniyor…'}</div>;
  const sel = page.widgets.find((w) => w.id === selected) ?? null;
  const cols = BREAKPOINT_COLUMNS[bp];

  return (
    <div className="space-y-3">
      <header className="pax-card flex flex-wrap items-center gap-2 p-3">
        <button type="button" className="pax-btn" onClick={onBack}>← Sayfalar</button>
        <div className="min-w-0 flex-1">
          {editMode
            ? <input aria-label="Sayfa başlığı" className="pax-input w-full font-semibold" value={page.title} onChange={(e) => update((p) => ({ ...p, title: e.target.value || 'Başlıksız' }))} />
            : <h1 className="truncate text-lg font-semibold">{page.title}</h1>}
          {page.subtitle && !editMode && <p className="text-xs text-[var(--muted)]">{page.subtitle}</p>}
        </div>
        <label className="flex items-center gap-1 text-sm">Departman
          <select className="pax-input" value={String(values.department ?? page.department)} onChange={(e) => setValues((v) => ({ ...v, department: e.target.value }))}>
            {DEPARTMENT_VALUES.map((d) => <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>)}
          </select>
        </label>
        <select aria-label="Antet" className="pax-input" value={letterheadId} onChange={(e) => setLetterheadId(e.target.value)}>
          <option value="default">Varsayılan antet</option>
          <option value="none">Antetsiz</option>
          {letterheads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button type="button" className="pax-btn" onClick={pdfPreview}>Yazdırma önizleme</button>
        <button type="button" className="pax-btn" onClick={pdfDownload}>PDF indir</button>
        {canDesign && meta.can_edit && (
          <button type="button" className={editing ? 'pax-btn pax-btn-primary' : 'pax-btn'} aria-pressed={editing} onClick={() => setEditing((x) => !x)}>
            {editing ? 'Düzenleme açık' : 'Düzenle'}
          </button>
        )}
        {editMode && <button type="button" className="pax-btn pax-btn-primary" disabled={!dirty} onClick={save}>Kaydet</button>}
      </header>

      {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className="text-sm" style={{ color: TOKEN_CSS[msg.kind === 'err' ? 'danger' : 'success'] }}>{msg.text}</p>}

      {page.filters.length > 0 && !page.widgets.some((w) => w.type === 'filter') && (
        <div className="pax-card flex flex-wrap gap-3 p-3">{page.filters.map((f) => <FilterControl key={f.key} filter={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />)}</div>
      )}

      {editMode && (
        <div className="pax-card space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Ekle:</span>
            {NEW_WIDGETS.map((n) => (
              <button key={n.type} type="button" className="pax-btn" disabled={n.type === 'filter' && !page.filters.length}
                onClick={() => update((p) => { const w = makeWidget(p, n.type); if (w) p.widgets.push(w as PageWidget); return p; })}>{n.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Önizleme:</span>
            {(['auto', 'lg', 'md', 'sm'] as const).map((b) => <button key={b} type="button" aria-pressed={preview === b} className={preview === b ? 'pax-btn pax-btn-primary' : 'pax-btn'} onClick={() => setPreview(b)}>{b === 'auto' ? 'Otomatik' : b === 'lg' ? 'Masaüstü' : b === 'md' ? 'Tablet' : 'Mobil'}</button>)}
            <label className="ml-2">Varsayılan departman{' '}
              <select className="pax-input" value={page.department} onChange={(e) => update((p) => ({ ...p, department: e.target.value }))}>
                {DEPARTMENT_VALUES.map((d) => <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>)}
              </select>
            </label>
            <label>Tema{' '}
              <select className="pax-input" value={page.theme.accent} onChange={(e) => update((p) => ({ ...p, theme: { ...p.theme, accent: e.target.value } }))}>
                {COLOR_TOKENS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Yoğunluk{' '}
              <select className="pax-input" value={page.theme.density} onChange={(e) => update((p) => ({ ...p, theme: { ...p.theme, density: e.target.value } }))}>
                <option value="compact">Sıkı</option><option value="normal">Normal</option><option value="comfortable">Rahat</option>
              </select>
            </label>
            <label>PDF yönü{' '}
              <select className="pax-input" value={page.pdf.orientation ?? ''} onChange={(e) => update((p) => ({ ...p, pdf: { ...p.pdf, orientation: e.target.value || undefined } }))}>
                <option value="">Antete göre</option><option value="portrait">Dikey</option><option value="landscape">Yatay</option>
              </select>
            </label>
            <button type="button" className="pax-btn" onClick={() => run(page, values)}>Önizlemeyi yenile</button>
            <button type="button" className="pax-btn" onClick={async () => setVersions((await api.versions(meta.id)).versions)}>Sürümler</button>
            {bp !== 'lg' && <span className="text-xs text-[var(--muted)]">Taşıma/boyutlandırma masaüstü düzeninde yapılır; tablet/mobil otomatik türetilir.</span>}
          </div>
          <PageFiltersEditor page={page} update={update} />
          {versions && (
            <div className="text-sm">
              <ul className="max-h-40 space-y-1 overflow-auto">
                {versions.map((v) => (
                  <li key={v.version} className="flex items-center gap-2">
                    <span className="tabular-nums">v{v.version}</span><span className="truncate">{v.title}</span>
                    <span className="text-xs text-[var(--muted)]">{new Date(v.created_at).toLocaleString('tr-TR')}</span>
                    <button type="button" className="pax-btn ml-auto" onClick={async () => { await api.restore(meta.id, v.version); setVersions(null); await load(); setMsg({ kind: 'ok', text: `v${v.version} geri yüklendi` }); }}>Geri yükle</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className={editMode && sel ? 'grid gap-3 lg:grid-cols-[1fr_320px]' : ''}>
        <div
          ref={gridRef}
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: `${ROW_PX}px`, gap: GAP_PX, maxWidth: preview === 'sm' ? 420 : preview === 'md' ? 820 : undefined, margin: preview === 'sm' || preview === 'md' ? '0 auto' : undefined }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {layout.filter((l) => visibleIds.has(l.id)).map((l) => {
            const w = page.widgets.find((x) => x.id === l.id)!;
            const g = ghost?.id === l.id ? ghost : l;
            const isSel = editMode && selected === w.id;
            return (
              <section
                key={w.id}
                aria-label={w.title || w.type}
                tabIndex={editMode ? 0 : undefined}
                onKeyDown={(e) => nudge(w.id, e)}
                onClick={() => editMode && setSelected(w.id)}
                className="pax-card relative flex min-h-0 flex-col overflow-hidden p-3"
                style={{ gridColumn: `${g.x + 1} / span ${g.w}`, gridRow: `${g.y + 1} / span ${g.h}`, outline: isSel ? `2px solid ${TOKEN_CSS[page.theme.accent]}` : undefined, opacity: ghost?.id === w.id ? 0.85 : 1 }}
              >
                {(editMode || (w.style.showTitle && w.title && w.type !== 'text' && w.type !== 'filter' && w.type !== 'tabs')) && (
                  <div
                    className={`mb-2 flex items-center gap-2 ${editMode && bp === 'lg' ? 'cursor-move select-none' : ''}`}
                    onPointerDown={(e) => onPointerDown(e, w.id, 'move')}
                  >
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{w.title || (editMode ? `(${w.type})` : '')}</h3>
                    {editMode && w.tab && <span className="text-[10px] text-[var(--muted)]">sekme: {w.tab}</span>}
                    {editMode && w.pdf.hideInPdf && <span className="text-[10px] text-[var(--muted)]">PDF’te gizli</span>}
                    {editMode && (
                      <button type="button" aria-label={`${w.title || w.type} sil`} className="pax-btn px-2 py-0 text-xs"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); update((p) => ({ ...p, widgets: p.widgets.filter((x) => x.id !== w.id) })); setSelected(null); }}>✕</button>
                    )}
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-auto">
                  {isDataWidget(w) ? <DataWidgetBody widget={w} data={data[w.id]} />
                    : w.type === 'text' ? <TextBlock variant={w.variant} text={w.text} />
                    : w.type === 'filter' ? (() => { const f = page.filters.find((x) => x.key === w.filterKey); return f ? <FilterControl filter={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} /> : null; })()
                    : (
                      <div role="tablist" className="flex flex-wrap gap-1">
                        {w.tabs.map((t) => {
                          const on = (activeTab[w.id] ?? w.tabs[0].key) === t.key;
                          return <button key={t.key} type="button" role="tab" aria-selected={on} className={on ? 'pax-btn pax-btn-primary' : 'pax-btn'} onClick={() => setActiveTab((s) => ({ ...s, [w.id]: t.key }))}>{t.label}</button>;
                        })}
                      </div>
                    )}
                </div>
                {editMode && bp === 'lg' && (
                  <span aria-hidden onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, w.id, 'resize'); }}
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize" style={{ background: `linear-gradient(135deg, transparent 50%, ${TOKEN_CSS[page.theme.accent]} 50%)` }} />
                )}
              </section>
            );
          })}
        </div>

        {editMode && sel && (
          <WidgetInspector
            key={sel.id}
            widget={sel}
            page={page}
            onChange={(fn) => updateWidget(sel.id, fn)}
            onEditQuery={() => {
              if (!isDataWidget(sel)) return;
              onEditQuery(sel.query, (q) => { updateWidget(sel.id, (w) => { if (isDataWidget(w)) (w as { query: unknown }).query = q; }); });
            }}
            onRefresh={() => run(page, values, [sel.id])}
          />
        )}
      </div>

      {editMode && <p className="text-xs text-[var(--muted)]">İpucu: widget seçiliyken ok tuşları taşır, Shift+ok boyutlandırır.</p>}

      {pdfUrl && (
        <div role="dialog" aria-label="Yazdırma önizleme" className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4">
          <div className="mb-2 flex justify-end gap-2">
            <button type="button" className="pax-btn pax-btn-primary" onClick={pdfDownload}>İndir</button>
            <button type="button" className="pax-btn" onClick={() => { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }}>Kapat</button>
          </div>
          <iframe title="PDF önizleme" src={pdfUrl} className="w-full flex-1 rounded-md bg-white" />
        </div>
      )}
    </div>
  );
}

function FilterControl({ filter, value, onChange }: { filter: PageDefinition['filters'][number]; value: unknown; onChange: (v: unknown) => void }) {
  const current = value ?? filter.defaultValue ?? '';
  if (filter.kind === 'date_range') {
    return (
      <label className="flex items-center gap-1 text-sm">{filter.label}
        <select className="pax-input" value={typeof current === 'string' ? current : ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Tanımdaki</option>
          {RELATIVE_PRESETS.map((p) => <option key={p} value={p}>{PRESET_LABEL[p]}</option>)}
        </select>
      </label>
    );
  }
  if (filter.kind === 'select' && filter.options?.length) {
    return (
      <label className="flex items-center gap-1 text-sm">{filter.label}
        <select className="pax-input" value={String(current)} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Tümü</option>
          {filter.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className="flex items-center gap-1 text-sm">{filter.label}
      <input className="pax-input" defaultValue={String(current)} placeholder="Tümü" onBlur={(e) => onChange(e.target.value.trim() || undefined)} onKeyDown={(e) => { if (e.key === 'Enter') onChange((e.target as HTMLInputElement).value.trim() || undefined); }} />
    </label>
  );
}

function PageFiltersEditor({ page, update }: { page: PageDefinition; update: (fn: (p: PageDefinition) => unknown) => void }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">Sayfa filtreleri ({page.filters.length})</summary>
      <div className="mt-2 space-y-2">
        {page.filters.map((f, i) => (
          <div key={f.key} className="flex flex-wrap items-center gap-2">
            <code className="text-xs">{f.key}</code>
            <input aria-label="Etiket" className="pax-input" value={f.label} onChange={(e) => update((p) => { p.filters[i].label = e.target.value || f.key; return p; })} />
            <select aria-label="Tür" className="pax-input" value={f.kind} onChange={(e) => update((p) => { p.filters[i].kind = e.target.value as never; return p; })}>
              <option value="date_range">Tarih aralığı</option><option value="select">Seçim</option><option value="text">Metin</option>
            </select>
            {f.kind !== 'date_range' && <input aria-label="Alan" className="pax-input" placeholder="alan (ör. owner)" value={f.field ?? ''} onChange={(e) => update((p) => { p.filters[i].field = e.target.value || undefined; return p; })} />}
            {f.kind === 'select' && <input aria-label="Seçenekler" className="pax-input" placeholder="A, B, C" defaultValue={(f.options ?? []).join(', ')} onBlur={(e) => update((p) => { const o = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); p.filters[i].options = o.length ? o : undefined; return p; })} />}
            <button type="button" className="pax-btn" disabled={page.widgets.some((w) => w.type === 'filter' && w.filterKey === f.key)} title="Filtre widget'ı kullanıyorsa önce onu silin"
              onClick={() => update((p) => { p.filters.splice(i, 1); return p; })}>Sil</button>
          </div>
        ))}
        <button type="button" className="pax-btn" disabled={page.filters.length >= 10}
          onClick={() => update((p) => { let n = p.filters.length + 1; while (p.filters.some((f) => f.key === `f${n}`)) n += 1; p.filters.push({ key: `f${n}`, label: `Filtre ${n}`, kind: 'select', field: 'owner' }); return p; })}>+ Filtre</button>
      </div>
    </details>
  );
}

function WidgetInspector({ widget, page, onChange, onEditQuery, onRefresh }: {
  widget: PageWidget; page: PageDefinition; onChange: (fn: (w: PageWidget) => void) => void; onEditQuery: () => void; onRefresh: () => void;
}) {
  const tabKeys = page.widgets.flatMap((w) => (w.type === 'tabs' ? w.tabs : []));
  const data = isDataWidget(widget);
  return (
    <aside className="pax-card space-y-3 p-3 text-sm" aria-label="Widget ayarları">
      <h2 className="font-semibold">Widget: {widget.id}</h2>
      <label className="block">Başlık<input className="pax-input mt-1 w-full" value={widget.title} onChange={(e) => onChange((w) => { w.title = e.target.value; })} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={widget.style.showTitle} onChange={(e) => onChange((w) => { w.style.showTitle = e.target.checked; })} />Başlığı göster</label>
      <div className="grid grid-cols-2 gap-2">
        <label>Renk<select className="pax-input mt-1 w-full" value={widget.style.accent ?? ''} onChange={(e) => onChange((w) => { w.style.accent = (e.target.value || undefined) as never; })}><option value="">Sayfa</option>{COLOR_TOKENS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Yoğunluk<select className="pax-input mt-1 w-full" value={widget.style.density} onChange={(e) => onChange((w) => { w.style.density = e.target.value as never; })}><option value="compact">Sıkı</option><option value="normal">Normal</option><option value="comfortable">Rahat</option></select></label>
      </div>
      {tabKeys.length > 0 && widget.type !== 'tabs' && (
        <label className="block">Sekme<select className="pax-input mt-1 w-full" value={widget.tab ?? ''} onChange={(e) => onChange((w) => { w.tab = e.target.value || undefined; })}><option value="">Her zaman</option>{tabKeys.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
      )}
      <fieldset className="space-y-1">
        <legend className="font-medium">PDF</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={widget.pdf.hideInPdf} onChange={(e) => onChange((w) => { w.pdf.hideInPdf = e.target.checked; })} />PDF’te gizle</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={widget.pdf.pageBreakBefore} onChange={(e) => onChange((w) => { w.pdf.pageBreakBefore = e.target.checked; })} />Öncesinde sayfa sonu</label>
      </fieldset>

      {widget.type === 'text' && (
        <>
          <label className="block">Tür<select className="pax-input mt-1 w-full" value={widget.variant} onChange={(e) => onChange((w) => { if (w.type === 'text') w.variant = e.target.value as never; })}><option value="heading">Başlık</option><option value="paragraph">Paragraf</option><option value="note">Not</option></select></label>
          <label className="block">Metin<textarea className="pax-input mt-1 w-full" rows={4} value={widget.text} onChange={(e) => onChange((w) => { if (w.type === 'text') w.text = e.target.value; })} /></label>
        </>
      )}
      {widget.type === 'filter' && (
        <label className="block">Sayfa filtresi<select className="pax-input mt-1 w-full" value={widget.filterKey} onChange={(e) => onChange((w) => { if (w.type === 'filter') w.filterKey = e.target.value; })}>{page.filters.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
      )}
      {widget.type === 'tabs' && (
        <label className="block">Sekmeler (anahtar:etiket, virgülle)
          <input className="pax-input mt-1 w-full" defaultValue={widget.tabs.map((t) => `${t.key}:${t.label}`).join(', ')}
            onBlur={(e) => onChange((w) => {
              if (w.type !== 'tabs') return;
              const tabs = e.target.value.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [k, ...l] = s.split(':'); return { key: k.trim().toLowerCase(), label: (l.join(':') || k).trim() }; });
              if (tabs.length) w.tabs = tabs;
            })} />
        </label>
      )}

      {data && (
        <>
          <label className="block">Görünüm<select className="pax-input mt-1 w-full" value={widget.type} onChange={(e) => onChange((w) => {
            if (!isDataWidget(w)) return;
            const t = e.target.value as typeof w.type;
            (w as { type: string }).type = t;
            w.query.visualization = { ...w.query.visualization, type: t === 'kpi_strip' ? 'kpi' : t };
          })}>{NEW_WIDGETS.filter((n) => !['text', 'filter', 'tabs'].includes(n.type)).map((n) => <option key={n.type} value={n.type}>{n.label}</option>)}</select></label>
          <label className="block">Sayı formatı<select className="pax-input mt-1 w-full" value={widget.style.numberFormat ?? ''} onChange={(e) => onChange((w) => { w.style.numberFormat = (e.target.value || undefined) as never; })}><option value="">Alan tanımı</option><option value="number">Sayı</option><option value="money">Para</option><option value="percent">Yüzde</option><option value="compact">Kısa (1,2 B)</option></select></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={widget.ignorePageFilters} onChange={(e) => onChange((w) => { if (isDataWidget(w)) w.ignorePageFilters = e.target.checked; })} />Sayfa filtrelerini yok say</label>
          <ConditionalEditor widget={widget} onChange={onChange} />
          <ColumnsEditor widget={widget} onChange={onChange} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pax-btn pax-btn-primary" onClick={onEditQuery}>Sorguyu düzenle</button>
            <button type="button" className="pax-btn" onClick={onRefresh}>Yenile</button>
          </div>
          <p className="text-xs text-[var(--muted)]">Dataset: {widget.query.dataset} · ölçüler: {widget.query.measures.join(', ')}</p>
        </>
      )}
    </aside>
  );
}

function ConditionalEditor({ widget, onChange }: { widget: PageWidget; onChange: (fn: (w: PageWidget) => void) => void }) {
  return (
    <details>
      <summary className="cursor-pointer font-medium">Koşullu biçim ({widget.style.conditional.length})</summary>
      <div className="mt-1 space-y-1">
        {widget.style.conditional.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1">
            <input aria-label="Sütun" className="pax-input w-24" value={r.column} onChange={(e) => onChange((w) => { w.style.conditional[i].column = e.target.value; })} />
            <select aria-label="Koşul" className="pax-input" value={r.op} onChange={(e) => onChange((w) => { w.style.conditional[i].op = e.target.value as never; })}>
              <option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option><option value="eq">=</option><option value="between">arası</option>
            </select>
            <input aria-label="Değer" type="number" className="pax-input w-20" value={r.value} onChange={(e) => onChange((w) => { w.style.conditional[i].value = Number(e.target.value) || 0; })} />
            {r.op === 'between' && <input aria-label="Değer 2" type="number" className="pax-input w-20" value={r.value2 ?? r.value} onChange={(e) => onChange((w) => { w.style.conditional[i].value2 = Number(e.target.value) || 0; })} />}
            <select aria-label="Renk" className="pax-input" value={r.color} onChange={(e) => onChange((w) => { w.style.conditional[i].color = e.target.value as never; })}>{COLOR_TOKENS.map((c) => <option key={c}>{c}</option>)}</select>
            <button type="button" aria-label="Kuralı sil" className="pax-btn px-2" onClick={() => onChange((w) => { w.style.conditional.splice(i, 1); })}>✕</button>
          </div>
        ))}
        <button type="button" className="pax-btn" disabled={widget.style.conditional.length >= 20}
          onClick={() => onChange((w) => { w.style.conditional.push({ column: isDataWidget(w) ? w.query.measures[0] : '', op: 'gt', value: 0, color: 'success' }); })}>+ Kural</button>
      </div>
    </details>
  );
}

function ColumnsEditor({ widget, onChange }: { widget: PageWidget; onChange: (fn: (w: PageWidget) => void) => void }) {
  if (!isDataWidget(widget)) return null;
  const keys = [...widget.query.dimensions.map((d) => d.field), ...widget.query.measures, ...widget.query.calculated.map((c) => c.key)];
  const get = (k: string) => widget.style.columns.find((c) => c.key === k);
  const set = (k: string, patch: Record<string, unknown>) => onChange((w) => {
    const i = w.style.columns.findIndex((c) => c.key === k);
    if (i >= 0) Object.assign(w.style.columns[i], patch); else w.style.columns.push({ key: k, ...patch });
  });
  return (
    <details>
      <summary className="cursor-pointer font-medium">Sütun ayarları</summary>
      <div className="mt-1 space-y-1">
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-1">
            <input type="checkbox" aria-label={`${k} görünür`} checked={!get(k)?.hidden} onChange={(e) => set(k, { hidden: !e.target.checked })} />
            <input aria-label={`${k} etiketi`} className="pax-input min-w-0 flex-1" placeholder={k} value={get(k)?.label ?? ''} onChange={(e) => set(k, { label: e.target.value || undefined })} />
          </div>
        ))}
      </div>
    </details>
  );
}
