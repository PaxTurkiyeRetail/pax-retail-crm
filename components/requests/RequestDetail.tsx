'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canManageRequests } from '@/lib/roles';

type RequestDetail = {
  id: string; title: string; body: string; status: string; priority: string;
  sla_status: string; sla_hours?: number; channel: string;
  requester_name: string; assignee_id?: string; assignee_name?: string;
  created_at: string; due_at?: string; first_response_at?: string; resolved_at?: string;
  request_categories?: { name: string; color: string };
};
type Event = { id: string; event_type: string; actor_name?: string; payload: Record<string, unknown>; created_at: string; };
type Options = { users: { user_id: string; full_name: string }[] };

const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'waiting', 'resolved', 'closed'];
const STATUS_LABELS: Record<string, string> = { open: 'Açık', assigned: 'Atandı', in_progress: 'Devam Ediyor', waiting: 'Bekliyor', resolved: 'Çözüldü', closed: 'Kapatıldı' };

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'Az önce';
  if (d < 3600) return `${Math.floor(d / 60)}dk önce`;
  if (d < 86400) return `${Math.floor(d / 3600)}s önce`;
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function evDesc(ev: Event) {
  const p = ev.payload;
  if (ev.event_type === 'created') return 'Talep oluşturuldu';
  if (ev.event_type === 'assigned') return `${p.to_name || 'birine'} atandı`;
  if (ev.event_type === 'reassigned') return `${p.to_name || 'birine'} yeniden atandı`;
  if (ev.event_type === 'status_changed') return `Durum: ${STATUS_LABELS[p.from as string] || p.from} → ${STATUS_LABELS[p.to as string] || p.to}`;
  if (ev.event_type === 'priority_changed') return `Öncelik: ${p.from} → ${p.to}`;
  if (ev.event_type === 'comment') return p.comment as string;
  return ev.event_type;
}

function evIcon(type: string) {
  if (type === 'created') return { bg: '#dbeafe', color: '#1d4ed8', icon: '✦' };
  if (type === 'comment') return { bg: '#f0fdf4', color: '#166534', icon: '💬' };
  if (type === 'status_changed') return { bg: '#fef3c7', color: '#b45309', icon: '→' };
  if (type.includes('assign')) return { bg: '#ede9fe', color: '#6d28d9', icon: '👤' };
  return { bg: 'var(--surface-2)', color: 'var(--text-3)', icon: '·' };
}

export default function RequestDetail({ id, userRole }: { id: string; userRole: string }) {
  const router = useRouter();
  const canAssign = canManageRequests(userRole);
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [options, setOptions] = useState<Options>({ users: [] });
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [dr, or] = await Promise.all([
        fetch(`/api/requests/detail?id=${id}`, { cache: 'no-store' }),
        fetch('/api/requests/options', { cache: 'no-store' }),
      ]);

      const d = await dr.json();
      const o = await or.json();

      if (!dr.ok) throw new Error(d.message || 'Talep detayı alınamadı');
      if (!or.ok) throw new Error(o.message || 'Talep seçenekleri alınamadı');
      if (!d.request) throw new Error('Talep bulunamadı');

      setRequest(d.request);
      setEvents(d.events ?? []);
      setOptions(o);
      setMsg('');
    } catch (e: any) {
      setRequest(null);
      setEvents([]);
      setMsg(e.message || 'Talep yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const action = async (body: object) => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/requests/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    await action({ action: 'comment', comment });
    setComment('');
  };

  if (loading) {
    return (
      <main className="pax-page-container">
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>Yükleniyor...</div>
      </main>
    );
  }

  if (!request) {
    return (
      <main className="pax-page-container">
        <div style={{ display: 'grid', gap: 12, maxWidth: 640, margin: '0 auto', paddingTop: 24 }}>
          <div style={{ padding: '18px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#b91c1c', fontSize: 14 }}>{msg || 'Talep yüklenemedi.'}</div>
          <button onClick={() => router.push('/requests')} style={{ justifySelf: 'start', padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>← Listeye dön</button>
        </div>
      </main>
    );
  }

  const cat = request.request_categories;
  const slaDeadline = request.sla_hours ? new Date(new Date(request.created_at).getTime() + request.sla_hours * 3600000) : null;
  const slaRemainHr = slaDeadline ? Math.round((slaDeadline.getTime() - Date.now()) / 3600000 * 10) / 10 : null;

  return (
    <main className="pax-page-container">
      <style jsx>{`
        .layout { display:grid; grid-template-columns:1fr 300px; gap:16px; align-items:start; }
        .card   { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:20px; }
        .kicker { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); margin-bottom:10px; }
        .info-row { display:flex; justify-content:space-between; gap:12px; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px; }
        .info-row:last-child { border-bottom:none; }
        .sel-action { width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:10px; font-size:13px; background:var(--surface); color:var(--text); outline:none; cursor:pointer; }
        .ev-row { display:grid; grid-template-columns:32px 1fr; gap:10px; align-items:start; }
        .ev-icon { width:32px; height:32px; border-radius:999px; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
        @media (max-width:720px) { .layout { grid-template-columns:1fr; } }
      `}</style>

      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Talep Detayı</span>
        <h1 className="pax-hero-title">{request.title}</h1>
        <p className="pax-hero-description">{request.requester_name} · {timeAgo(request.created_at)}</p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Durum</div><div className="pax-hero-stat-value" style={{ fontSize: 15, paddingTop: 6 }}>{STATUS_LABELS[request.status]}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Öncelik</div><div className="pax-hero-stat-value" style={{ fontSize: 15, paddingTop: 6 }}>{request.priority}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">SLA</div><div className="pax-hero-stat-value" style={{ fontSize: 15, paddingTop: 6 }}>{request.sla_status === 'breached' ? 'Gecikti' : request.sla_status === 'at_risk' ? 'Riskli' : 'Zamanında'}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Kalan</div><div className="pax-hero-stat-value" style={{ fontSize: 15, paddingTop: 6 }}>{slaRemainHr !== null ? (slaRemainHr > 0 ? `${slaRemainHr}s` : 'Geçti') : '—'}</div></div>
        </div>
      </div>

      {msg && <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{msg}</div>}

      <div className="layout">
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card">
            <div className="kicker">Talep İçeriği</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {request.body || <em style={{ color: 'var(--text-4)' }}>Açıklama girilmedi.</em>}
            </p>
          </div>

          <div className="card">
            <div className="kicker">Zaman Çizelgesi</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {events.map(ev => {
                const { bg, color, icon } = evIcon(ev.event_type);
                return (
                  <div key={ev.id} className="ev-row">
                    <div className="ev-icon" style={{ background: bg }}><span style={{ color }}>{icon}</span></div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{evDesc(ev)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{ev.actor_name || 'Sistem'} · {timeAgo(ev.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'grid', gap: 8 }}>
              <textarea
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Yorum ekle..." rows={3}
                style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', width: '100%' }}
              />
              <button onClick={sendComment} disabled={busy || !comment.trim()}
                style={{ alignSelf: 'end', justifySelf: 'end', padding: '9px 18px', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busy || !comment.trim() ? .6 : 1 }}>
                {busy ? '...' : 'Yorum Ekle'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card">
            <div className="kicker">Durum Güncelle</div>
            <select defaultValue={request.status} onChange={e => action({ action: 'status', status: e.target.value })} disabled={busy} className="sel-action">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          {canAssign && (
            <div className="card">
              <div className="kicker">Atama</div>
              <select defaultValue={request.assignee_id || ''} onChange={e => action({ action: 'assign', assignee_id: e.target.value || null })} disabled={busy} className="sel-action">
                <option value="">Atanmamış</option>
                {options.users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
              </select>
            </div>
          )}

          {canAssign && (
            <div className="card">
              <div className="kicker">Öncelik</div>
              <select defaultValue={request.priority} onChange={e => action({ action: 'priority', priority: e.target.value })} disabled={busy} className="sel-action">
                {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          <div className="card">
            <div className="kicker">Bilgiler</div>
            {cat && <div className="info-row"><span style={{ color: 'var(--text-3)' }}>Kategori</span><span style={{ color: cat.color, fontWeight: 700 }}>{cat.name}</span></div>}
            <div className="info-row"><span style={{ color: 'var(--text-3)' }}>Talep Eden</span><span style={{ fontWeight: 600 }}>{request.requester_name}</span></div>
            <div className="info-row"><span style={{ color: 'var(--text-3)' }}>Atanan</span><span style={{ fontWeight: 600 }}>{request.assignee_name || '—'}</span></div>
            <div className="info-row"><span style={{ color: 'var(--text-3)' }}>Kanal</span><span style={{ fontWeight: 600 }}>{request.channel}</span></div>
            <div className="info-row"><span style={{ color: 'var(--text-3)' }}>Oluşturma</span><span style={{ fontWeight: 600 }}>{new Date(request.created_at).toLocaleDateString('tr-TR')}</span></div>
            {slaDeadline && <div className="info-row"><span style={{ color: 'var(--text-3)' }}>SLA Sonu</span><span style={{ fontWeight: 600 }}>{slaDeadline.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>}
          </div>

          <button onClick={() => router.push('/requests')} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            ← Listeye Dön
          </button>
        </div>
      </div>
    </main>
  );
}
