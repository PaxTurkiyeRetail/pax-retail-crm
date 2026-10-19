'use client';
// Antet yönetimi: PNG/JPG veya tek sayfa PDF, A4 dikey/yatay, mm kenar boşluğu + güvenli alan.
import { useState } from 'react';
import { api, type LetterheadLite } from './api';
import { TOKEN_CSS } from './renderers/tokens';

type Settings = Omit<LetterheadLite, 'id' | 'mimeType' | 'byteSize'>;

const EMPTY: Settings = {
  name: '', orientation: 'portrait', margins: { top: 15, right: 15, bottom: 15, left: 15 }, safeArea: { top: 30, bottom: 20 },
  showTitle: true, showDate: true, showPageNumbers: true, footerText: '', isDefault: false,
};

export default function LetterheadManager({ letterheads, canManage, onChanged }: { letterheads: LetterheadLite[]; canManage: boolean; onChanged: () => void }) {
  const [form, setForm] = useState<Settings>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = async () => {
    setMsg(null);
    try {
      if (editId) await api.updateLetterhead(editId, form);
      else {
        if (!file) throw new Error('Dosya seçin (PNG, JPG veya tek sayfa PDF, en çok 5 MB)');
        if (file.size > 5 * 1024 * 1024) throw new Error('Dosya 5 MB’tan büyük');
        const fd = new FormData();
        fd.set('file', file);
        fd.set('settings', JSON.stringify(form));
        await api.uploadLetterhead(fd);
      }
      setMsg({ kind: 'ok', text: 'Kaydedildi' });
      setForm(EMPTY); setEditId(null); setFile(null);
      onChanged();
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  };

  const num = (v: string) => Math.max(0, Math.min(100, Number(v) || 0));

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
      <section className="pax-card p-4" aria-label="Antetler">
        <h2 className="mb-2 font-semibold">Antetler</h2>
        {!letterheads.length ? <p className="pax-empty text-sm">Henüz antet yok. PDF’ler antetsiz üretilir.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {letterheads.map((l) => (
              <li key={l.id} className="rounded-lg border p-2 text-sm" style={{ borderColor: l.isDefault ? TOKEN_CSS.primary : 'var(--border)' }}>
                {l.mimeType !== 'application/pdf'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/api/report-builder/letterheads/${l.id}`} alt={`${l.name} önizleme`} className="mb-2 h-32 w-full rounded object-contain" style={{ background: '#fff' }} />
                  : <div className="mb-2 flex h-32 items-center justify-center rounded text-xs text-[var(--muted)]" style={{ background: 'var(--border)' }}>PDF antet</div>}
                <div className="font-medium">{l.name}{l.isDefault && <span className="ml-1 text-xs" style={{ color: TOKEN_CSS.primary }}>(varsayılan)</span>}</div>
                <div className="text-xs text-[var(--muted)]">A4 {l.orientation === 'portrait' ? 'dikey' : 'yatay'} · kenar {l.margins.top}/{l.margins.right}/{l.margins.bottom}/{l.margins.left} mm · {(l.byteSize / 1024).toFixed(0)} KB</div>
                {canManage && (
                  <div className="mt-2 flex gap-1">
                    <button type="button" className="pax-btn" onClick={() => { setEditId(l.id); setForm({ name: l.name, orientation: l.orientation, margins: l.margins, safeArea: l.safeArea, showTitle: l.showTitle, showDate: l.showDate, showPageNumbers: l.showPageNumbers, footerText: l.footerText, isDefault: l.isDefault }); }}>Düzenle</button>
                    {!l.isDefault && <button type="button" className="pax-btn" onClick={async () => { await api.updateLetterhead(l.id, { ...l, isDefault: true }); onChanged(); }}>Varsayılan yap</button>}
                    <button type="button" className="pax-btn" onClick={async () => { if (confirm(`"${l.name}" pasifleştirilsin mi?`)) { await api.deactivateLetterhead(l.id); onChanged(); } }}>Pasifleştir</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage ? (
        <form className="pax-card space-y-2 p-4 text-sm" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label={editId ? 'Anteti düzenle' : 'Yeni antet'}>
          <h2 className="font-semibold">{editId ? 'Anteti düzenle' : 'Yeni antet'}</h2>
          <label className="block">Ad<input required className="pax-input mt-1 w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          {!editId && <label className="block">Dosya (PNG, JPG, tek sayfa PDF)<input type="file" accept="image/png,image/jpeg,application/pdf" className="mt-1 block w-full" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>}
          <label className="block">Yön
            <select className="pax-input mt-1 w-full" value={form.orientation} onChange={(e) => setForm({ ...form, orientation: e.target.value as never })}><option value="portrait">A4 dikey</option><option value="landscape">A4 yatay</option></select>
          </label>
          <fieldset className="grid grid-cols-4 gap-1">
            <legend className="col-span-4">Kenar boşlukları (mm)</legend>
            {(['top', 'right', 'bottom', 'left'] as const).map((k) => (
              <label key={k} className="text-xs">{{ top: 'Üst', right: 'Sağ', bottom: 'Alt', left: 'Sol' }[k]}
                <input type="number" min={0} max={100} className="pax-input w-full" value={form.margins[k]} onChange={(e) => setForm({ ...form, margins: { ...form.margins, [k]: num(e.target.value) } })} />
              </label>
            ))}
          </fieldset>
          <fieldset className="grid grid-cols-2 gap-1">
            <legend className="col-span-2">Güvenli alan — antet logosu/alt bilgisi için ek boşluk (mm)</legend>
            <label className="text-xs">Üst<input type="number" min={0} max={100} className="pax-input w-full" value={form.safeArea.top} onChange={(e) => setForm({ ...form, safeArea: { ...form.safeArea, top: num(e.target.value) } })} /></label>
            <label className="text-xs">Alt<input type="number" min={0} max={100} className="pax-input w-full" value={form.safeArea.bottom} onChange={(e) => setForm({ ...form, safeArea: { ...form.safeArea, bottom: num(e.target.value) } })} /></label>
          </fieldset>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.showTitle} onChange={(e) => setForm({ ...form, showTitle: e.target.checked })} />Başlık</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.showDate} onChange={(e) => setForm({ ...form, showDate: e.target.checked })} />Tarih</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.showPageNumbers} onChange={(e) => setForm({ ...form, showPageNumbers: e.target.checked })} />Sayfa numarası</label>
          <label className="block">Alt bilgi<input className="pax-input mt-1 w-full" maxLength={200} value={form.footerText} onChange={(e) => setForm({ ...form, footerText: e.target.value })} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />Varsayılan antet</label>
          {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} style={{ color: TOKEN_CSS[msg.kind === 'err' ? 'danger' : 'success'] }}>{msg.text}</p>}
          <div className="flex gap-2">
            <button type="submit" className="pax-btn pax-btn-primary" disabled={!form.name.trim()}>{editId ? 'Güncelle' : 'Yükle'}</button>
            {editId && <button type="button" className="pax-btn" onClick={() => { setEditId(null); setForm(EMPTY); }}>Vazgeç</button>}
          </div>
        </form>
      ) : <p className="pax-card p-4 text-sm text-[var(--muted)]">Antet yüklemek için “report.letterhead.manage” yetkisi gerekir.</p>}
    </div>
  );
}
