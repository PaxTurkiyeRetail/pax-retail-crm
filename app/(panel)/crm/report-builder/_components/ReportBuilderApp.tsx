'use client';
// Rapor Geliştirme Aracı kabuğu: Sayfalar / Rapor oluştur / Antetler.
import { useCallback, useEffect, useState } from 'react';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import type { ReportDefinitionInput } from '@/lib/report-builder/types';
import { api, type LetterheadLite, type SavedPageLite } from './api';
import PageDesigner from './designer/PageDesigner';
import LetterheadManager from './LetterheadManager';
import QueryBuilder from './QueryBuilder';
import { TOKEN_CSS } from './renderers/tokens';

type Tab = 'pages' | 'query' | 'letterheads';

export default function ReportBuilderApp({ canDesign, canManageLetterheads }: { canDesign: boolean; canManageLetterheads: boolean }) {
  const [tab, setTab] = useState<Tab>('pages');
  const [datasets, setDatasets] = useState<DatasetCatalogEntry[]>([]);
  const [pages, setPages] = useState<SavedPageLite[]>([]);
  const [templates, setTemplates] = useState<{ key: string; label: string }[]>([]);
  const [letterheads, setLetterheads] = useState<LetterheadLite[]>([]);
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [queryEdit, setQueryEdit] = useState<{ query: ReportDefinitionInput; apply: (q: ReportDefinitionInput) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [templateKey, setTemplateKey] = useState('');

  const reload = useCallback(async () => {
    try {
      const [d, p, l] = await Promise.all([api.datasets(), api.pages(), api.letterheads()]);
      setDatasets(d.datasets); setPages(p.pages); setTemplates(p.templates); setLetterheads(l.letterheads);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // URL ?page=<id> → sayfa doğrudan açılır (paylaşılabilir bağlantı).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('page');
    if (id) setOpenPage(id);
  }, []);
  const open = (id: string | null) => {
    setOpenPage(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('page', id); else url.searchParams.delete('page');
    window.history.replaceState(null, '', url);
  };

  const create = async () => {
    try {
      const title = newTitle.trim() || 'Yeni sayfa';
      const r = await api.createPage(templateKey
        ? { templateKey }
        : { page: { version: 1, title, widgets: [{ id: 'h1', type: 'text', variant: 'heading', text: title, layout: { lg: { x: 0, y: 0, w: 12, h: 1 } } }] } });
      setNewTitle(''); setTemplateKey('');
      await reload();
      open(r.id);
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="pax-page-container space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Rapor Geliştirme</h1>
        <div role="tablist" aria-label="Bölümler" className="flex gap-1">
          {([['pages', 'Sayfalar'], ['query', 'Rapor oluştur'], ['letterheads', 'Antetler']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'pax-btn pax-btn-primary' : 'pax-btn'} onClick={() => { setTab(k); setQueryEdit(null); }}>{l}</button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="text-sm" style={{ color: TOKEN_CSS.danger }}>{error}</p>}

      {queryEdit && (
        <div role="dialog" aria-label="Widget sorgusu" className="fixed inset-0 z-40 overflow-auto bg-black/50 p-4">
          <div className="mx-auto max-w-7xl rounded-xl p-2" style={{ background: 'var(--surface)' }}>
            <QueryBuilder datasets={datasets} initial={queryEdit.query} onApply={(q) => { queryEdit.apply(q); setQueryEdit(null); }} onCancel={() => setQueryEdit(null)} />
          </div>
        </div>
      )}

      {tab === 'pages' && (openPage ? (
        <PageDesigner
          key={openPage}
          pageId={openPage}
          canDesign={canDesign}
          letterheads={letterheads}
          onBack={() => { open(null); reload(); }}
          onEditQuery={(query, apply) => setQueryEdit({ query, apply })}
        />
      ) : (
        <div className="space-y-3">
          {canDesign && (
            <form className="pax-card flex flex-wrap items-end gap-2 p-3 text-sm" onSubmit={(e) => { e.preventDefault(); create(); }}>
              <label>Başlık<input className="pax-input mt-1 block" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Yeni sayfa" /></label>
              <label>Şablon
                <select className="pax-input mt-1 block" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                  <option value="">Boş sayfa</option>
                  {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <button type="submit" className="pax-btn pax-btn-primary">Oluştur</button>
            </form>
          )}
          {!pages.length ? <p className="pax-card pax-empty p-6 text-sm">Görebildiğiniz sayfa yok.</p> : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pages.map((p) => (
                <li key={p.id}>
                  <button type="button" className="pax-card block w-full p-4 text-left hover:shadow-md" onClick={() => open(p.id)}>
                    <div className="font-semibold">{p.title}{p.is_template && <span className="ml-1 text-xs text-[var(--muted)]">(şablon)</span>}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {p.owner_name ?? '—'} · {p.visibility === 'private' ? 'Özel' : p.visibility === 'roles' ? 'Rollerle paylaşılan' : 'Herkes'} · v{p.version} · {new Date(p.updated_at).toLocaleDateString('tr-TR')}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {tab === 'query' && (datasets.length ? <QueryBuilder datasets={datasets} /> : <p className="pax-card p-4 text-sm">Yükleniyor…</p>)}

      {tab === 'letterheads' && <LetterheadManager letterheads={letterheads} canManage={canManageLetterheads} onChanged={reload} />}
    </div>
  );
}
