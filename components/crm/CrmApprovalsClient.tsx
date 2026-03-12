'use client';

import { useEffect, useState } from 'react';

type PendingRequest = {
  id: string;
  musteri: string;
  current_account: string | null;
  requested_account: string;
  requested_by: string;
  created_at: string;
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('tr-TR');
}

export default function CrmApprovalsClient() {
  const [rows, setRows] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/account-change-requests', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.message || 'Onay kayıtları alınamadı.');
        setRows([]);
        return;
      }
      setRows(json.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRows(); }, []);

  async function handleAction(requestId: string, action: 'approve' | 'reject') {
    setBusyId(requestId);
    setMsg(null);
    try {
      const res = await fetch('/api/crm/account-change-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.message || 'İşlem tamamlanamadı.');
        return;
      }
      setMsg(action === 'approve' ? 'Talep onaylandı.' : 'Talep reddedildi.');
      await loadRows();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page">
      <style jsx>{`
        .page { display:grid; gap:16px; }
        .hero, .surface, .row { border: 1px solid #dbe4ef; background: rgba(255,255,255,.96); border-radius: 24px; box-shadow: 0 18px 40px rgba(15,23,42,.05); }
        .hero, .surface { padding: 18px; }
        .hero { display:grid; gap:8px; background: linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(246,249,253,.94) 100%); }
        .eyebrow { display:inline-flex; min-height:32px; align-items:center; padding:0 12px; border-radius:999px; background:#fff1f2; color:#be123c; border:1px solid #fecdd3; font-size:12px; font-weight:900; width:fit-content; }
        .title { margin:0; color:#0f172a; font-size:clamp(28px,4vw,42px); line-height:1.04; font-weight:950; }
        .sub { color:#64748b; font-size:14px; max-width:760px; }
        .summary { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:10px; }
        .card { border:1px solid #e2e8f0; border-radius:18px; background:#fff; padding:14px; }
        .card-label { color:#64748b; font-size:12px; }
        .card-value { margin-top:6px; color:#0f172a; font-size:24px; font-weight:900; }
        .list { display:grid; gap:12px; }
        .row { padding:16px; display:grid; gap:10px; }
        .row-top { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .name { font-size:16px; font-weight:900; color:#0f172a; }
        .meta { color:#64748b; font-size:13px; }
        .badge { display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; background:#fff1f2; border:1px solid #fecdd3; color:#be123c; font-size:11px; font-weight:900; }
        .actions { display:flex; gap:8px; flex-wrap:wrap; }
        .primary, .secondary { min-height:42px; border-radius:14px; padding:0 16px; font-size:14px; font-weight:900; cursor:pointer; }
        .primary { border:1px solid #991b1b; background: linear-gradient(180deg, #d61f26 0%, #b91c1c 100%); color:#fff; }
        .secondary { border:1px solid #d7e0ea; background:#fff; color:#0f172a; }
        .empty { padding:20px; border:1px dashed #d7e0ea; border-radius:18px; color:#64748b; text-align:center; }
        .message { color: #166534; background: #ecfdf3; border: 1px solid #bbf7d0; padding: 11px 13px; border-radius: 14px; font-size: 13px; }
        @media (max-width: 1100px) { .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 700px) { .summary { grid-template-columns: 1fr; } }
      `}</style>

      <section className="hero">
        <span className="eyebrow">Onay Yönetimi</span>
        <h1 className="title">Account Değişiklik Onayları</h1>
        <div className="sub">Müşteri sorumlusu değişiklik talepleri sadece bu ekrandan onaylanır veya reddedilir.</div>
      </section>

      <section className="summary">
        <div className="card"><div className="card-label">Bekleyen Talep</div><div className="card-value">{rows.length}</div></div>
        <div className="card"><div className="card-label">İşlem Tipi</div><div className="card-value">Account</div></div>
        <div className="card"><div className="card-label">Onay Yetkisi</div><div className="card-value">Admin</div></div>
        <div className="card"><div className="card-label">Durum</div><div className="card-value">Aktif</div></div>
      </section>

      {msg ? <div className="message">{msg}</div> : null}

      <section className="surface">
        <div className="list">
          {loading ? <div className="empty">Onay kayıtları yükleniyor...</div> : null}
          {!loading && !rows.length ? <div className="empty">Bekleyen account değişiklik talebi bulunmuyor.</div> : null}
          {!loading ? rows.map((row) => (
            <div key={row.id} className="row">
              <div className="row-top">
                <div>
                  <div className="name">{row.musteri}</div>
                  <div className="meta">Talep eden: {row.requested_by} · {formatDate(row.created_at)}</div>
                </div>
                <span className="badge">Bekleyen Onay</span>
              </div>
              <div className="meta">Mevcut sorumlu: <strong>{row.current_account || '-'}</strong></div>
              <div className="meta">Talep edilen sorumlu: <strong>{row.requested_account}</strong></div>
              <div className="actions">
                <button className="primary" disabled={busyId === row.id} onClick={() => handleAction(row.id, 'approve')}>Onayla</button>
                <button className="secondary" disabled={busyId === row.id} onClick={() => handleAction(row.id, 'reject')}>Reddet</button>
              </div>
            </div>
          )) : null}
        </div>
      </section>
    </main>
  );
}
