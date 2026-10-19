'use client';
// Rapor Merkezi kabuğu: galeri (hazır raporlar, raporlarım, panolar) → sihirbaz / pano / antetler / uzman ekranı.
import { useCallback, useEffect, useState } from 'react';
import styles from './ReportCenter.module.css';
import { Search, RefreshCw, ChevronRight, FileStack, LayoutDashboard, Plus, Sparkles, Stamp, Wrench } from 'lucide-react';
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import type { ReportDefinitionInput } from '@/lib/report-builder/types';
import { api, type LetterheadLite, type SavedDefinitionLite, type SavedPageLite } from './api';
import ReportStudio from './ReportStudio';
import { friendlyError, QUICK_REPORTS, TEMPLATE_DESC, uiFor } from './friendly';
import LetterheadManager from './LetterheadManager';
import QueryBuilder from './QueryBuilder';
import ReportWizard from './ReportWizard';
import { TOKEN_CSS, TOKEN_SOFT } from './renderers/tokens';

type View =
  | { kind: 'hub' }
  | { kind: 'wizard'; initial?: { def: ReportDefinitionInput; title?: string; saved?: SavedDefinitionLite | null; step?: 1 | 2 | 3 } }
  | { kind: 'page'; id: string; edit?: boolean; live?: boolean }
  | { kind: 'studio' }
  | { kind: 'letterheads' }
  | { kind: 'expert' };

const VIS_LABEL: Record<string, string> = { private: 'Yalnız ben', roles: 'Rollerle paylaşılan', everyone: 'Herkesle paylaşılan' };

function setParam(k: string, v: string | null) {
  const url = new URL(window.location.href);
  ['page', 'report'].forEach((x) => url.searchParams.delete(x));
  if (v) url.searchParams.set(k, v);
  window.history.replaceState(null, '', url);
}

export default function ReportBuilderApp({ canDesign, canManageLetterheads }: { canDesign: boolean; canManageLetterheads: boolean }) {
  const [view, setView] = useState<View>({ kind: 'hub' });
  const [datasets, setDatasets] = useState<DatasetCatalogEntry[]>([]);
  const [pages, setPages] = useState<SavedPageLite[]>([]);
  const [templates, setTemplates] = useState<{ key: string; label: string }[]>([{ key: 'retail_operasyon', label: 'Retail Operasyon Paneli' }]);
  const [defs, setDefs] = useState<SavedDefinitionLite[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [letterheads, setLetterheads] = useState<LetterheadLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    const results = await Promise.allSettled([api.datasets(), api.pages(), api.letterheads(), api.definitions()]);
    const [d, p, l, r] = results;
    if (d.status === 'fulfilled') setDatasets(d.value.datasets);
    if (p.status === 'fulfilled') { setPages(p.value.pages); setTemplates([{ key: 'retail_operasyon', label: 'Retail Operasyon Paneli' }, ...p.value.templates.filter((template) => template.key !== 'retail_operasyon')]); }
    if (l.status === 'fulfilled') setLetterheads(l.value.letterheads);
    if (r.status === 'fulfilled') { setDefs(r.value.definitions); setUserId(r.value.userId); }
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') setError(friendlyError(failed.reason));
    setLoaded(true);
    setRefreshing(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // Paylaşılabilir bağlantılar: ?page=<id> pano, ?report=<id> kayıtlı rapor.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('page');
    if (id) setView({ kind: 'page', id, live: q.get('view')==='live' });
  }, []);
  useEffect(() => {
    const rid = new URLSearchParams(window.location.search).get('report');
    if (!rid || !defs.length) return;
    const s = defs.find((d) => d.id === rid);
    if (s) setView({ kind: 'wizard', initial: { def: s.definition, title: s.title, saved: s, step: 3 } });
  }, [defs]);

  const go = (v: View) => {
    setView(v); setError(null);
    if (v.kind === 'page') setParam('page', v.id);
    else if (v.kind === 'wizard' && v.initial?.saved) setParam('report', v.initial.saved.id);
    else setParam('page', null);
  };
  const back = () => { go({ kind: 'hub' }); reload(); };

  const openTemplate = async (key: string, label: string) => {
    if (key === 'retail_operasyon') { window.location.assign('/crm/reports/retail-operasyon'); return; }
    if (busy) return;
    const existing = pages.find((p) => p.template_key === key || p.title === label);
    if (existing) { go({ kind: 'page', id: existing.id }); return; }
    if (!canDesign) { setError('Bu hazır pano henüz kurulmamış. Kurulum için rapor tasarım yetkisi olan birine başvur.'); return; }
    setBusy(key);
    try { const r = await api.createPage({ templateKey: key }); await reload(); go({ kind: 'page', id: r.id }); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(null); }
  };

  const createFromKit = async (templateKey: string) => {
    if (busy) return;
    setBusy(templateKey);
    try {
      const r = await api.createPage({ templateKey });
      await reload(); go({ kind: 'page', id: r.id, edit: true });
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(null); }
  };

  if (view.kind === 'wizard') {
    return (
      <div className="pax-page-container">
        {loaded && <ReportWizard key={view.initial?.saved?.id ?? 'new'} datasets={datasets} letterheads={letterheads} initial={view.initial} onClose={back} onSaved={reload} />}
      </div>
    );
  }
  if (view.kind === 'page' || view.kind === 'studio') {
    return (
      <ReportStudio liveView={view.kind==='page'&&view.live} key={view.kind === 'page' ? view.id : 'new-studio'} pageId={view.kind === 'page' ? view.id : undefined} datasets={datasets} letterheads={letterheads} canDesign={canDesign} onClose={back} onSaved={reload} />
    );
  }
  if (view.kind === 'letterheads' || view.kind === 'expert') {
    return (
      <div className="pax-page-container space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="pax-btn" onClick={back}>← Rapor Merkezi</button>
          <h1 className="text-xl font-semibold">{view.kind === 'letterheads' ? 'PDF antetleri' : 'Alan bazlı rapor oluşturucu'}</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">{view.kind === 'letterheads' ? 'PDF çıktılarında kullanılacak antetli kâğıtları yönet.' : 'Tüm seçenekler tek ekranda: veri kümesi, kırılım, filtre, formül. Günlük kullanım için “+ Yeni rapor” sihirbazı daha hızlıdır.'}</p>
        {view.kind === 'letterheads'
          ? <LetterheadManager letterheads={letterheads} canManage={canManageLetterheads} onChanged={reload} />
          : datasets.length ? <QueryBuilder datasets={datasets} /> : <p className="pax-card p-4 text-sm">Yükleniyor…</p>}
      </div>
    );
  }

  const matches = (value: string) => value.toLocaleLowerCase('tr-TR').includes(search.trim().toLocaleLowerCase('tr-TR'));
  const mine = defs.filter((d) => d.owner_user_id === userId && matches(d.title));
  const shared = defs.filter((d) => d.owner_user_id !== userId && matches(d.title));
  const templatePages = new Set(templates.map((t) => t.label));
  const boards = pages.filter((p) => !p.is_template && matches(p.title));
  const visibleTemplates = templates.filter((t) => !['retail_custom', 'kasapos_monthly'].includes(t.key) && (category === 'all' || category === 'boards') && matches(t.label + ' ' + (TEMPLATE_DESC[t.key] ?? '')));
  const visibleQuickReports = QUICK_REPORTS.filter((q) => datasets.some((d) => d.key === q.def.dataset) && (category === 'all' || category === q.def.dataset) && matches(q.title + ' ' + q.desc));

  return (
    <div className={`${styles.center} pax-page-container space-y-6`}>
      <section className={`${styles.hero} pax-card flex flex-col gap-4 p-5 md:flex-row md:items-center`}>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold">Rapor Merkezi</h1>
          <p className="text-sm text-[var(--muted)]">Kendi yönetim raporunu tasarla: farklı kaynaklardan tablolar, aylık matrisler, grafikler ve özet kartları tek raporda birleştir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canDesign && <button type="button" className="pax-btn pax-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-base" disabled={!loaded || !datasets.length} onClick={() => go({ kind: 'studio' })}><LayoutDashboard size={18} aria-hidden />Özel rapor tasarla</button>}
          <button type="button" className="pax-btn inline-flex items-center gap-2 px-4 py-2.5" disabled={!loaded || !datasets.length} onClick={() => go({ kind: 'wizard' })}><Plus size={18} aria-hidden />Hızlı rapor</button>
        </div>
      </section>

      {error && <p role="alert" className="rounded-lg p-3 text-sm" style={{ background: TOKEN_SOFT.danger, color: TOKEN_CSS.danger }}>{error} <button type="button" className="pax-btn" disabled={refreshing} onClick={reload}><RefreshCw size={14} aria-hidden />Tekrar dene</button></p>}

      {canDesign && <section className={styles.createSection} aria-labelledby="h-create">
        <div className={styles.sectionIntro}><div><span className={styles.eyebrow}>SENİN VERİN, SENİN DÜZENİN</span><h2 id="h-create">Nasıl bir rapor hazırlamak istiyorsun?</h2><p>Boş bir tuvalle başla veya örnek yapıyı kendine göre değiştir. Her bölümün kaynağını, alanlarını, hesabını ve görünümünü sen seç.</p></div><span className={styles.capability}>{datasets.length} veri kaynağı · Çok bölümlü tasarım · Antetli PDF</span></div>
        <div className={styles.createGrid}>
          <button className={styles.createCard} disabled={!loaded || !datasets.length} onClick={() => go({ kind: 'studio' })}><span className={styles.createIcon}><Plus size={22} /></span><strong>Sıfırdan özel rapor</strong><span>Satış, model, müşteri, Forecast veya fatura verilerini ayrı bölümlerle istediğin düzende kullan.</span><b>Rapor Stüdyosu’nu aç <ChevronRight size={15} /></b></button>
          <button className={styles.createCard} disabled={!!busy || !templates.some((t) => t.key === 'kasapos_monthly') || !datasets.some((d) => d.key === 'service_invoice_items')} onClick={() => void createFromKit('kasapos_monthly')}><span className={styles.createIcon}><FileStack size={22} /></span><strong>KasaPOS aylık yönetim raporu</strong><span>Firma × ay adet ve tutar tabloları, toplamlar ve gelir grafiği. Alanları ve dönemleri değiştir.</span><b>{busy === 'kasapos_monthly' ? 'Hazırlanıyor…' : 'Özelleştirerek başla'} <ChevronRight size={15} /></b></button>
          <button className={styles.createCard} disabled={!!busy || !templates.some((t) => t.key === 'retail_custom') || !datasets.some((d) => d.key === 'sales')} onClick={() => void createFromKit('retail_custom')}><span className={styles.createIcon}><LayoutDashboard size={22} /></span><strong>Retail yönetim raporu</strong><span>Satış, fırsat, model dağılımı ve müşteri havuzu bölümlerinden kendi yönetim ekranını üret.</span><b>{busy === 'retail_custom' ? 'Hazırlanıyor…' : 'Özelleştirerek başla'} <ChevronRight size={15} /></b></button>
        </div><p className={styles.scopeNote}>Her bölüm kendi veri kaynağında hesaplanır. Farklı kaynakları aynı raporda birlikte gösterebilir, her bölüm için ayrı filtre ve formül tanımlayabilirsin.</p>
      </section>}

      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={18} aria-hidden /><input aria-label="Rapor ve pano ara" placeholder="Rapor veya pano ara…" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="Aramayı temizle" onClick={() => setSearch('')}>×</button>}</label>
        <button type="button" className="pax-btn" disabled={refreshing} onClick={reload}><RefreshCw size={16} aria-hidden />{refreshing ? 'Yenileniyor…' : 'Yenile'}</button>
      </div>
      <section className="space-y-3" aria-labelledby="h-quick" aria-busy={refreshing}>
        <div><h2 id="h-quick" className="flex items-center gap-2 text-lg font-semibold"><Sparkles size={18} aria-hidden style={{ color: TOKEN_CSS.warning }} />Hazır raporlar</h2>
          <p className="text-xs text-[var(--muted)]">“Aç”a bas, rapor anında çalışsın. İstersen içinde değiştirip kendi raporun olarak kaydedebilirsin.</p></div>
        <div className={styles.filters} role="group" aria-label="Hazır rapor kategorisi">{[['all', 'Tümü'], ['boards', 'Panolar'], ...datasets.filter((d) => QUICK_REPORTS.some((q) => q.def.dataset === d.key)).map((d) => [d.key, uiFor(d.key).title])].map(([key, label]) => <button type="button" key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>{label}</button>)}</div>
        {!loaded && <p role="status" className="pax-card p-5">Raporlar yükleniyor…</p>}
        {loaded && !visibleTemplates.length && !visibleQuickReports.length && <p role="status" className="pax-card p-5 text-sm">Bu seçimle eşleşen hazır rapor yok. Aramayı veya kategoriyi değiştirebilirsin.</p>}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleTemplates.map((t) => (
            <li key={t.key}>
              <Card icon={<LayoutDashboard size={20} aria-hidden />} tone="primary" title={t.label} desc={TEMPLATE_DESC[t.key] ?? 'Çok kartlı hazır pano.'} badge="Pano"
                disabled={!!busy} action={busy === t.key ? 'Hazırlanıyor…' : 'Panoyu aç'} onClick={() => openTemplate(t.key, t.label)} />
            </li>
          ))}
          {visibleQuickReports.map((q) => {
            const u = uiFor(q.def.dataset); const Icon = u.icon;
            return (
              <li key={q.key}>
                <Card icon={<Icon size={20} aria-hidden />} tone={u.tone} title={q.title} desc={q.desc} badge={u.title}
                  action="Aç" onClick={() => go({ kind: 'wizard', initial: { def: q.def, title: q.title, step: 3 } })} />
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ReportList title="Raporlarım" loaded={loaded} searching={!!search.trim()} empty="Henüz kaydettiğin rapor yok. “+ Yeni rapor” ile başla, 3. adımda “Kaydet”e bas." items={mine}
          onOpen={(s) => go({ kind: 'wizard', initial: { def: s.definition, title: s.title, saved: s, step: 3 } })} />
        <ReportList title="Benimle paylaşılanlar" loaded={loaded} searching={!!search.trim()} empty="Seninle paylaşılan rapor yok." items={shared}
          onOpen={(s) => go({ kind: 'wizard', initial: { def: s.definition, title: s.title, saved: s.owner_user_id === userId ? s : null, step: 3 } })} />
      </div>

      <section className="space-y-3" aria-labelledby="h-boards">
        <div><h2 id="h-boards" className="flex items-center gap-2 text-lg font-semibold"><LayoutDashboard size={18} aria-hidden style={{ color: TOKEN_CSS.primary }} />Çok bölümlü özel raporlar</h2>
          <p className="text-xs text-[var(--muted)]">Kaydettiğin yönetim raporlarını aç, düzenle veya antetli PDF olarak indir.</p></div>
        {!boards.length ? <p className="pax-card pax-empty p-5 text-sm">{loaded ? `Henüz görebildiğin çok bölümlü rapor yok.${canDesign ? ' “Özel rapor tasarla” ile ilk raporunu oluştur.' : ''}` : 'Yükleniyor…'}</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {boards.map((p) => (
              <li key={p.id}>
                <button type="button" className="pax-card block h-full w-full p-4 text-left transition hover:shadow-md" onClick={() => go({ kind: 'page', id: p.id })}>
                  <div className="font-semibold">{p.title}{templatePages.has(p.title) && <span className="ml-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: TOKEN_SOFT.primary, color: TOKEN_CSS.primary }}>hazır</span>}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{p.owner_name ?? '—'} · {VIS_LABEL[p.visibility]} · {new Date(p.updated_at).toLocaleDateString('tr-TR')}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex flex-wrap gap-2 border-t pt-4 text-sm" style={{ borderColor: 'var(--border)' }}>
        <button type="button" className="pax-btn inline-flex items-center gap-1" onClick={() => go({ kind: 'letterheads' })}><Stamp size={16} aria-hidden />PDF antetleri</button>
        <button type="button" className="pax-btn inline-flex items-center gap-1" onClick={() => go({ kind: 'expert' })}><Wrench size={16} aria-hidden />Alan bazlı rapor oluşturucu</button>
      </footer>
    </div>
  );
}

function Card({ icon, tone, title, desc, badge, action, onClick, disabled }: { icon: React.ReactNode; tone: keyof typeof TOKEN_CSS; title: string; desc: string; badge: string; action: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="pax-card flex h-full w-full flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: TOKEN_SOFT[tone], color: TOKEN_CSS[tone] }}>{icon}</span>
        <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] text-[var(--muted)]" style={{ border: '1px solid var(--border)' }}>{badge}</span>
      </div>
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-[var(--muted)]">{desc}</span>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold" style={{ color: TOKEN_CSS.primary }}>{action}<ChevronRight size={14} aria-hidden /></span>
    </button>
  );
}

function ReportList({ title, empty, items, onOpen, loaded, searching }: { title: string; empty: string; items: SavedDefinitionLite[]; loaded: boolean; searching: boolean; onOpen: (s: SavedDefinitionLite) => void }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><FileStack size={18} aria-hidden style={{ color: TOKEN_CSS.accent }} />{title} <span className="text-sm font-normal text-[var(--muted)]">({items.length})</span></h2>
      {!items.length ? <p className="pax-card pax-empty p-5 text-sm">{loaded ? searching ? 'Aramana uygun rapor bulunamadı.' : empty : 'Raporlar yükleniyor…'}</p> : (
        <ul className="pax-card divide-y p-0" style={{ borderColor: 'var(--border)' }}>
          {items.map((s) => {
            const u = uiFor(s.definition.dataset); const Icon = u.icon;
            return (
              <li key={s.id}>
                <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/5" onClick={() => onOpen(s)}>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: TOKEN_SOFT[u.tone], color: TOKEN_CSS[u.tone] }}><Icon size={16} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">{u.title || s.definition.dataset} · {s.owner_name ?? '—'} · {VIS_LABEL[s.visibility] ?? s.visibility} · {new Date(s.updated_at).toLocaleDateString('tr-TR')}</span>
                  </span>
                  <ChevronRight size={16} aria-hidden className="text-[var(--muted)]" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
