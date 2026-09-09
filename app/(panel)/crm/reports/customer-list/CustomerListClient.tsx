'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  CUSTOMER_LIST_CATEGORIES,
  categoryLabel,
  cellItems,
  cleanFirmName,
  countsByCategory,
  countsByOwner,
  filterItems,
  findOwner,
  normalizeName,
  siraBefore,
  type CustomerListCategory,
  type CustomerListItem,
  type CustomerListOwner,
  type CustomerListPayload,
} from '@/lib/reports/customer-list-shared';
import '@/styles/customer-list.css';

// Müşteri Listesi (H/F/L/K) — Sinan, 09.09.2026.
//   * Çağdaş Bey'in Excel'i: kolon = kişi, tablo = kategori (H Hunter · F Farmer · L Lead · K Kasa Firması).
//   * Herkes görür; yalnız canManage (admin, super_admin) düzenler: firma çipi sürüklenip başka
//     kişiye / kategoriye bırakılır ("hold-drag"), aynı hücrede sıra değiştirilir; çip menüsünden
//     Taşı… (klavye/dokunmatik yolu), Yeniden adlandır, Not, Kaldır; kolon altından yeni firma.
//   * Dört tablo aynı sayfada üst üste durur; sekmelerle tek kategoriye daraltılabilir. Kategoriler
//     arası taşıma için sürükleme sırasında her kolon başlığında (yapışkan) 4 kategori rozeti hedef
//     olur — tek hamlede kişi + kategori; uzun tablolarda 2500 px sürüklemek gerekmez.
//     Arama yalnız görünümü filtreler, sayaçlar filtresiz kalır.
//   * API: GET/POST /api/reports/customer-list · PATCH/DELETE /api/reports/customer-list/:id.

type CategoryFilter = 'all' | CustomerListCategory;
type DropTarget = { owner: string; category: CustomerListCategory; beforeId: string | null };
type ChipMenu = { id: string; x: number; y: number };
type MoveDialog = { item: CustomerListItem; owner: string; category: CustomerListCategory };
type EditState = { id: string; firma: string; note: string };

const CATEGORY_TONE: Record<CustomerListCategory, string> = { H: 'indigo', F: 'green', L: 'gold', K: 'violet' };

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => ({}));
  return (json?.message as string) || fallback;
}

function formatStamp(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CustomerListClient() {
  const [payload, setPayload] = useState<CustomerListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<ChipMenu | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [move, setMove] = useState<MoveDialog | null>(null);
  const [adding, setAdding] = useState<{ owner: string; category: CustomerListCategory; value: string } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/customer-list', { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(await readError(res, 'Müşteri listesi yüklenemedi.'));
      setPayload((await res.json()) as CustomerListPayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Müşteri listesi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Çip menüsü: dışarı tıklama / Esc kapatır.
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu(null);
    };
    const esc = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const items = useMemo(() => payload?.items ?? [], [payload]);
  const owners = useMemo(() => payload?.owners ?? [], [payload]);
  const canManage = Boolean(payload?.canManage);
  const totals = useMemo(() => countsByCategory(items), [items]);
  const perOwner = useMemo(() => countsByOwner(items), [items]);
  const visibleItems = useMemo(() => filterItems(items, query), [items, query]);
  const visibleOwners = useMemo(
    () => (ownerFilter ? owners.filter((owner) => normalizeName(owner.name) === normalizeName(ownerFilter)) : owners),
    [owners, ownerFilter],
  );
  const categories = useMemo(
    () => (category === 'all' ? CUSTOMER_LIST_CATEGORIES : CUSTOMER_LIST_CATEGORIES.filter((c) => c.key === category)),
    [category],
  );
  const lastUpdate = useMemo(() => {
    let best: CustomerListItem | null = null;
    for (const item of items) if (item.updatedAt && (!best || item.updatedAt > (best.updatedAt ?? ''))) best = item;
    return best;
  }, [items]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  /* --- yerel güncelleme yardımcıları -------------------------------------- */
  const replaceItem = useCallback((next: CustomerListItem) => {
    setPayload((prev) => prev ? { ...prev, items: prev.items.map((item) => (item.id === next.id ? next : item)) } : prev);
  }, []);
  const removeItem = useCallback((id: string) => {
    setPayload((prev) => prev ? { ...prev, items: prev.items.filter((item) => item.id !== id) } : prev);
  }, []);
  const mark = useCallback((id: string, on: boolean) => {
    setBusy((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });
  }, []);

  /* --- API çağrıları -------------------------------------------------------- */
  // Başarı/hata bildirimi: AppToaster her mutasyon için otomatik toast gösterir ("İşlem tamamlandı" /
  // sunucu hata mesajı); burada ikinci bir toast üretmiyoruz.
  const patchItem = useCallback(async (id: string, body: Record<string, unknown>) => {
    mark(id, true);
    try {
      const res = await fetch(`/api/reports/customer-list/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res, 'Kayıt güncellenemedi.'));
      const json = (await res.json()) as { item: CustomerListItem };
      replaceItem(json.item);
      return true;
    } catch {
      // Hata bildirimi AppToaster'ın fetch sarmalayıcısından gelir (sunucu mesajıyla);
      // burada yalnız iyimser değişikliği geri alıyoruz.
      await load();
      return false;
    } finally {
      mark(id, false);
    }
  }, [load, mark, replaceItem]);

  const moveItem = useCallback(async (item: CustomerListItem, target: DropTarget) => {
    const targetOwner = findOwner(owners, target.owner);
    const sameCell = item.category === target.category && normalizeName(item.owner) === normalizeName(target.owner);
    if (sameCell && (target.beforeId === item.id)) return;
    if (sameCell) {
      // Aynı hücrede yalnız sıra değişiyor: hedef zaten hemen sonraki kayıtsa işlem yok.
      const cell = cellItems(items, item.owner, item.category);
      const index = cell.findIndex((row) => row.id === item.id);
      const nextId = cell[index + 1]?.id ?? null;
      if (nextId === target.beforeId) return;
    }
    // İyimser: yerel listede taşı (sıra yaklaşık; sunucu kesin değeri döner).
    const cell = cellItems(items, target.owner, target.category).filter((row) => row.id !== item.id);
    const placed = siraBefore(cell, target.beforeId);
    // Yeniden numaralama gerekiyorsa çakışan sıranın hemen önüne (kesirli) yerleştir; sunucu kesin değeri döner.
    replaceItem({ ...item, category: target.category, owner: targetOwner?.name ?? target.owner, ownerUserId: targetOwner?.id ?? null, sira: placed.renumber ? placed.sira - 0.5 : placed.sira });
    const ok = await patchItem(item.id, {
      category: target.category,
      ...(targetOwner?.id ? { ownerUserId: targetOwner.id } : { owner: target.owner }),
      beforeId: target.beforeId,
    });
    if (!ok) return;
    if (placed.renumber) await load(); // yeniden numaralanan hücreyi tazele
  }, [items, load, owners, patchItem, replaceItem]);

  const createItem = useCallback(async (owner: string, cat: CustomerListCategory, value: string) => {
    const firma = cleanFirmName(value);
    if (!firma) return false;
    const target = findOwner(owners, owner);
    const key = `new:${owner}:${cat}`;
    mark(key, true);
    try {
      const res = await fetch('/api/reports/customer-list', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, firma, ...(target?.id ? { ownerUserId: target.id } : { owner }) }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Firma eklenemedi.'));
      const json = (await res.json()) as { item: CustomerListItem };
      setPayload((prev) => prev ? { ...prev, items: [...prev.items, json.item] } : prev);
      return true;
    } catch {
      return false; // hata toast'ı AppToaster'dan
    } finally {
      mark(key, false);
    }
  }, [mark, owners]);

  const deleteItem = useCallback(async (item: CustomerListItem) => {
    if (!window.confirm(`"${item.firma}" ${item.owner} · ${categoryLabel(item.category)} listesinden kaldırılsın mı?\n(Kayıt silinmez, pasife alınır; işlem denetim kaydına yazılır.)`)) return;
    mark(item.id, true);
    try {
      const res = await fetch(`/api/reports/customer-list/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res, 'Kayıt kaldırılamadı.'));
      removeItem(item.id);
    } catch {
      // hata toast'ı AppToaster'dan
    } finally {
      mark(item.id, false);
    }
  }, [mark, removeItem]);

  /* --- sürükle-bırak -------------------------------------------------------- */
  const onDragStart = (event: DragEvent<HTMLLIElement>, item: CustomerListItem) => {
    if (!canManage) { event.preventDefault(); return; }
    event.dataTransfer.setData('text/plain', item.id);
    event.dataTransfer.effectAllowed = 'move';
    setDragId(item.id);
    setMenu(null);
  };
  const onDragEnd = () => { setDragId(null); setDropTarget(null); };
  const onDragOverChip = (event: DragEvent<HTMLLIElement>, owner: string, cat: CustomerListCategory, item: CustomerListItem) => {
    if (!dragId || !canManage) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    // Çipin üst yarısı → önüne; alt yarısı → sonrasına (bir sonraki çipin önüne).
    const rect = event.currentTarget.getBoundingClientRect();
    const lower = event.clientY > rect.top + rect.height / 2;
    let beforeId: string | null = item.id;
    if (lower) {
      const cell = cellItems(items, owner, cat);
      const index = cell.findIndex((row) => row.id === item.id);
      beforeId = cell[index + 1]?.id ?? null;
    }
    setDropTarget((prev) => (prev && prev.owner === owner && prev.category === cat && prev.beforeId === beforeId ? prev : { owner, category: cat, beforeId }));
  };
  const onDragOverColumn = (event: DragEvent<HTMLDivElement>, owner: string, cat: CustomerListCategory) => {
    if (!dragId || !canManage) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget((prev) => (prev && prev.owner === owner && prev.category === cat && prev.beforeId === null ? prev : { owner, category: cat, beforeId: null }));
  };
  // Kolon başlığındaki kategori rozetleri (sürükleme sırasında görünür): tek hamlede kişi + kategori.
  const onDragOverTarget = (event: DragEvent<HTMLDivElement>, owner: string, cat: CustomerListCategory) => {
    if (!dragId || !canManage) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget((prev) => (prev && prev.owner === owner && prev.category === cat && prev.beforeId === null ? prev : { owner, category: cat, beforeId: null }));
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || dragId;
    const target = dropTarget;
    setDragId(null);
    setDropTarget(null);
    if (!id || !target) return;
    const item = itemById.get(id);
    if (!item) return;
    void moveItem(item, target);
  };

  /* --- çip menüsü ------------------------------------------------------------ */
  const openMenu = (event: ReactMouseEvent<HTMLButtonElement>, item: CustomerListItem) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ id: item.id, x: Math.min(rect.left, window.innerWidth - 240), y: rect.bottom + 6 });
  };
  const onChipKey = (event: KeyboardEvent<HTMLLIElement>, item: CustomerListItem) => {
    if (!canManage) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setMove({ item, owner: item.owner, category: item.category });
    }
  };

  const menuItem = menu ? itemById.get(menu.id) ?? null : null;
  const dragItem = dragId ? itemById.get(dragId) ?? null : null;

  /* --- render ----------------------------------------------------------------- */
  return (
    <div
      className="cl-shell"
      // Kolon/rozet dışında sürüklenirken (hero, boşluk) hedef vurgusunu kaldır: çocuk hedefler
      // dragover'ı preventDefault ile işaretler, buraya işaretsiz gelen olay "hedef yok" demektir.
      onDragOver={(event) => { if (dragId && !event.defaultPrevented) setDropTarget((prev) => (prev ? null : prev)); }}
    >
      <section className="cl-hero">
        <div className="cl-hero-copy">
          <span className="cl-eyebrow">Raporlar · Müşteri Listesi</span>
          <h1>Müşteri Listesi (H/F/L/K)</h1>
          <p>
            Satış yönetiminin kişi bazlı firma dağılımı — kolon kişi, tablo kategori.
            <b> H</b> Hunter · <b>F</b> Farmer · <b>L</b> Lead · <b>K</b> Kasa Firması.
            {canManage
              ? ' Düzenleme açık: bir firmayı tutup başka kişiye ya da kategoriye bırakın; çip menüsünden taşı, yeniden adlandır, kaldır.'
              : ' Salt okunur görünüm — düzenleme yetkisi Admin ve Super Admin rollerinde.'}
          </p>
        </div>
        <div className="cl-hero-actions">
          <input
            className="cl-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Firma ara…"
            aria-label="Firma ara"
          />
          <select className="cl-select" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} aria-label="Kişi seçimi">
            <option value="">Tüm kişiler</option>
            {owners.map((owner) => <option key={owner.name} value={owner.name}>{owner.name}</option>)}
          </select>
          <button type="button" className="cl-btn light" onClick={() => void load()} disabled={loading}>{loading ? 'Yükleniyor…' : 'Yenile'}</button>
        </div>
      </section>

      <section className="cl-kpis" aria-label="Özet">
        <div className="cl-kpi total">
          <div className="cl-kpi-value">{totals.total.toLocaleString('tr-TR')}</div>
          <div className="cl-kpi-label">Toplam firma</div>
          <div className="cl-kpi-hint">{owners.length} kişi · {lastUpdate?.updatedAt ? `son değişiklik ${formatStamp(lastUpdate.updatedAt)}${lastUpdate.updatedBy ? ` · ${lastUpdate.updatedBy.replace(/^migration:.*/, 'ilk yükleme')}` : ''}` : 'henüz kayıt yok'}</div>
        </div>
        {CUSTOMER_LIST_CATEGORIES.map((cat) => (
          <button
            type="button"
            key={cat.key}
            className={`cl-kpi tone-${CATEGORY_TONE[cat.key]} ${category === cat.key ? 'active' : ''}`}
            onClick={() => setCategory((prev) => (prev === cat.key ? 'all' : cat.key))}
            title={category === cat.key ? 'Tüm tabloları göster' : `Yalnız ${cat.label} tablosunu göster`}
          >
            <div className="cl-kpi-value"><span className={`cl-cat-badge ${CATEGORY_TONE[cat.key]}`}>{cat.key}</span>{totals[cat.key].toLocaleString('tr-TR')}</div>
            <div className="cl-kpi-label">{cat.label}</div>
            <div className="cl-kpi-hint">{cat.hint}</div>
          </button>
        ))}
      </section>

      <div className="cl-tabs" role="tablist" aria-label="Kategori">
        <button type="button" role="tab" aria-selected={category === 'all'} className={`cl-tab ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>Tümü · 4 tablo</button>
        {CUSTOMER_LIST_CATEGORIES.map((cat) => (
          <button type="button" role="tab" key={cat.key} aria-selected={category === cat.key} className={`cl-tab ${category === cat.key ? 'active' : ''}`} onClick={() => setCategory(cat.key)}>
            <span className={`cl-cat-badge ${CATEGORY_TONE[cat.key]}`}>{cat.key}</span>{cat.label}
          </button>
        ))}
        {query ? <span className="cl-filter-note">“{query}” için {visibleItems.length} firma</span> : null}
      </div>

      {error ? <div className="cl-state error">{error}</div> : null}
      {!error && loading && !payload ? <div className="cl-state">Yükleniyor…</div> : null}
      {!error && payload && !items.length ? (
        <div className="cl-state">Liste boş. {canManage ? 'Kolon altındaki "+ Firma ekle" ile başlayın.' : 'Henüz kayıt girilmemiş.'}</div>
      ) : null}

      {payload && items.length ? categories.map((cat) => {
        const catItems = visibleItems.filter((item) => item.category === cat.key);
        const catTotal = totals[cat.key];
        return (
          <section className={`cl-table tone-${CATEGORY_TONE[cat.key]}`} key={cat.key} aria-label={`${cat.label} tablosu`}>
            <header className="cl-table-head">
              <span className={`cl-cat-badge big ${CATEGORY_TONE[cat.key]}`}>{cat.key}</span>
              <div className="cl-table-title">
                <h2>{cat.label}</h2>
                <span>{cat.hint}</span>
              </div>
              <strong className="cl-table-count">{catTotal.toLocaleString('tr-TR')} firma{query && catItems.length !== catTotal ? ` · ${catItems.length} eşleşme` : ''}</strong>
            </header>
            <div className="cl-grid" style={{ ['--cl-cols' as string]: String(Math.max(1, visibleOwners.length)) }}>
              {visibleOwners.map((owner) => {
                const cell = cellItems(catItems, owner.name, cat.key);
                const fullCount = perOwner.get(normalizeName(owner.name))?.[cat.key] ?? 0;
                const isTarget = Boolean(dropTarget && dropTarget.category === cat.key && normalizeName(dropTarget.owner) === normalizeName(owner.name));
                const isAdding = adding && adding.category === cat.key && normalizeName(adding.owner) === normalizeName(owner.name);
                return (
                  <div
                    className={`cl-col ${isTarget ? 'drop' : ''} ${dragId ? 'dragging' : ''}`}
                    key={owner.name}
                    onDragOver={(event) => onDragOverColumn(event, owner.name, cat.key)}
                    onDragEnter={(event) => onDragOverColumn(event, owner.name, cat.key)}
                    onDrop={onDrop}
                    onDragLeave={(event) => {
                      // Chromium çocuk elemanlar arasında geçişte relatedTarget=null verir; o durumda temizleme
                      // (aksi hâlde vurgu titrer). Gerçek çıkış kök .cl-shell'in onDragOver'ında yakalanır.
                      const related = event.relatedTarget as Node | null;
                      if (related && !event.currentTarget.contains(related)) setDropTarget((prev) => (prev && prev.category === cat.key && normalizeName(prev.owner) === normalizeName(owner.name) ? null : prev));
                    }}
                  >
                    <div className="cl-col-head">
                      <b>{owner.name}</b>
                      {dragItem ? (
                        // Sürükleme sırasında: bu kişinin 4 kategorisi hedef olur (mevcut hücre hariç).
                        // Başlık yapışkan (sticky) — uzun kolonlarda (Erdi 42 firma) hedef hep görünür.
                        <div className="cl-col-targets" aria-label={`${owner.name} · kategoriye bırak`}>
                          {CUSTOMER_LIST_CATEGORIES.filter((c) => !(c.key === dragItem.category && normalizeName(dragItem.owner) === normalizeName(owner.name))).map((c) => {
                            const active = Boolean(dropTarget && dropTarget.beforeId === null && dropTarget.category === c.key && normalizeName(dropTarget.owner) === normalizeName(owner.name));
                            return (
                              <div
                                key={c.key}
                                className={`cl-cat-badge target ${CATEGORY_TONE[c.key]} ${active ? 'drop' : ''}`}
                                title={`${owner.name} · ${c.label}`}
                                onDragOver={(event) => { event.stopPropagation(); onDragOverTarget(event, owner.name, c.key); }}
                                onDragEnter={(event) => { event.stopPropagation(); onDragOverTarget(event, owner.name, c.key); }}
                                onDrop={(event) => { event.stopPropagation(); onDrop(event); }}
                              >
                                {c.key}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span title={query ? `${cell.length} eşleşme / ${fullCount} firma` : `${fullCount} firma`}>{fullCount}</span>
                      )}
                    </div>
                    <ul className="cl-list" aria-label={`${owner.name} · ${cat.label}`}>
                      {cell.map((item) => {
                        const isEditing = edit?.id === item.id;
                        const before = isTarget && dropTarget?.beforeId === item.id;
                        return (
                          <li
                            key={item.id}
                            className={`cl-chip ${dragId === item.id ? 'lifted' : ''} ${before ? 'before' : ''} ${busy.has(item.id) ? 'busy' : ''} ${canManage ? 'grab' : ''}`}
                            draggable={canManage && !isEditing}
                            onDragStart={(event) => onDragStart(event, item)}
                            onDragEnd={onDragEnd}
                            onDragOver={(event) => onDragOverChip(event, owner.name, cat.key, item)}
                            onDragEnter={(event) => onDragOverChip(event, owner.name, cat.key, item)}
                            tabIndex={canManage ? 0 : -1}
                            onKeyDown={(event) => onChipKey(event, item)}
                            title={item.note ? `${item.firma} — ${item.note}` : item.firma}
                          >
                            {isEditing && edit ? (
                              <form
                                className="cl-edit"
                                onSubmit={async (event) => {
                                  event.preventDefault();
                                  const firma = cleanFirmName(edit.firma);
                                  if (!firma) return;
                                  const body: Record<string, unknown> = {};
                                  if (firma !== item.firma) body.firma = firma;
                                  const note = edit.note.trim() || null;
                                  if (note !== (item.note ?? null)) body.note = note;
                                  setEdit(null);
                                  if (Object.keys(body).length) await patchItem(item.id, body);
                                }}
                              >
                                <input autoFocus value={edit.firma} onChange={(event) => setEdit({ ...edit, firma: event.target.value })} aria-label="Firma adı" maxLength={160} />
                                <input value={edit.note} onChange={(event) => setEdit({ ...edit, note: event.target.value })} aria-label="Not" placeholder="Not (isteğe bağlı)" maxLength={500} />
                                <div className="cl-edit-actions">
                                  <button type="submit" className="cl-btn primary sm">Kaydet</button>
                                  <button type="button" className="cl-btn sm" onClick={() => setEdit(null)}>Vazgeç</button>
                                </div>
                              </form>
                            ) : (
                              <>
                                {canManage ? <span className="cl-handle" aria-hidden="true">⋮⋮</span> : null}
                                <span className="cl-chip-name">{item.firma}</span>
                                {item.note ? <span className="cl-chip-note" title={item.note}>✎</span> : null}
                                {canManage ? (
                                  <button type="button" className="cl-chip-menu" aria-label={`${item.firma} işlemleri`} aria-haspopup="menu" onClick={(event) => openMenu(event, item)}>⋯</button>
                                ) : null}
                              </>
                            )}
                          </li>
                        );
                      })}
                      {!cell.length ? <li className="cl-empty">{query ? 'eşleşme yok' : '—'}</li> : null}
                    </ul>
                    {canManage ? (
                      isAdding && adding ? (
                        <form
                          className="cl-add"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            const ok = await createItem(owner.name, cat.key, adding.value);
                            if (ok) setAdding({ owner: owner.name, category: cat.key, value: '' });
                          }}
                        >
                          <input
                            autoFocus
                            value={adding.value}
                            onChange={(event) => setAdding({ ...adding, value: event.target.value })}
                            onKeyDown={(event) => { if (event.key === 'Escape') setAdding(null); }}
                            placeholder="Firma adı"
                            aria-label={`${owner.name} · ${cat.label} yeni firma`}
                            maxLength={160}
                          />
                          <button type="submit" className="cl-btn primary sm" disabled={busy.has(`new:${owner.name}:${cat.key}`) || !adding.value.trim()}>Ekle</button>
                          <button type="button" className="cl-btn sm" onClick={() => setAdding(null)}>Kapat</button>
                        </form>
                      ) : (
                        <button type="button" className="cl-add-btn" onClick={() => setAdding({ owner: owner.name, category: cat.key, value: '' })}>+ Firma ekle</button>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      }) : null}

      {menu && menuItem ? (
        <div className="cl-menu" ref={menuRef} role="menu" style={{ left: menu.x, top: menu.y }}>
          <div className="cl-menu-title">{menuItem.firma}<small>{menuItem.owner} · {categoryLabel(menuItem.category)}</small></div>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); setMove({ item: menuItem, owner: menuItem.owner, category: menuItem.category }); }}>Taşı…</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); setEdit({ id: menuItem.id, firma: menuItem.firma, note: menuItem.note ?? '' }); }}>Yeniden adlandır / not</button>
          <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); void deleteItem(menuItem); }}>Kaldır</button>
        </div>
      ) : null}

      {move ? (
        <div className="cl-modal-backdrop" onClick={() => setMove(null)} role="presentation">
          <div className="cl-modal" role="dialog" aria-modal="true" aria-labelledby="cl-move-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="cl-move-title">Taşı: {move.item.firma}</h3>
            <p>Şu an <b>{move.item.owner}</b> · <b>{categoryLabel(move.item.category)}</b>. Yeni yerini seçin; kayıt hedef listenin sonuna eklenir.</p>
            <label className="cl-field">
              <span>Kişi</span>
              <select value={move.owner} onChange={(event) => setMove({ ...move, owner: event.target.value })}>
                {owners.map((owner: CustomerListOwner) => <option key={owner.name} value={owner.name}>{owner.name}</option>)}
              </select>
            </label>
            <label className="cl-field">
              <span>Kategori</span>
              <select value={move.category} onChange={(event) => setMove({ ...move, category: event.target.value as CustomerListCategory })}>
                {CUSTOMER_LIST_CATEGORIES.map((cat) => <option key={cat.key} value={cat.key}>{cat.key} · {cat.label}</option>)}
              </select>
            </label>
            <div className="cl-modal-actions">
              <button type="button" className="cl-btn" onClick={() => setMove(null)}>Vazgeç</button>
              <button
                type="button"
                className="cl-btn primary"
                disabled={normalizeName(move.owner) === normalizeName(move.item.owner) && move.category === move.item.category}
                onClick={async () => {
                  const target = move;
                  setMove(null);
                  await moveItem(target.item, { owner: target.owner, category: target.category, beforeId: null });
                }}
              >
                Taşı
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
