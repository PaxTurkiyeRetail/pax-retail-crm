'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { isAdminLike } from '@/lib/roles';

type Request = {
  id: string; title: string; status: string; priority: string; sla_status: string;
  requester_name: string; assignee_name?: string; assignee_id?: string;
  created_at: string; due_at?: string; channel: string;
  request_categories?: { name: string; color: string };
};
type Options = {
  categories: { id: string; name: string; color: string }[];
  users: { user_id: string; full_name: string; role: string }[];
};

const STATUS_LABELS: Record<string,string> = { open:'Açık', assigned:'Atandı', in_progress:'Devam', waiting:'Bekliyor', resolved:'Çözüldü', closed:'Kapatıldı' };
const PRIORITY_COLORS: Record<string,string> = { critical:'#b91c1c', high:'#c2410c', medium:'#a16207', low:'#15803d' };
const PRIORITY_BG: Record<string,string>     = { critical:'#fee2e2', high:'#ffedd5', medium:'#fef9c3', low:'#f0fdf4' };
const SLA_COLORS: Record<string,string>  = { on_time:'#166534', at_risk:'#b45309', breached:'#b91c1c', na:'#64748b' };
const SLA_BG: Record<string,string>     = { on_time:'#dcfce7', at_risk:'#fef3c7', breached:'#fee2e2', na:'#f1f5f9' };
const SLA_LABELS: Record<string,string> = { on_time:'Zamanında', at_risk:'Riskli', breached:'Gecikti', na:'—' };
const STATUS_BG: Record<string,string>  = { open:'#dbeafe', assigned:'#e0f2fe', in_progress:'#fef3c7', waiting:'#f3f4f6', resolved:'#dcfce7', closed:'#f1f5f9' };
const STATUS_COLOR: Record<string,string> = { open:'#1d4ed8', assigned:'#0369a1', in_progress:'#b45309', waiting:'#4b5563', resolved:'#166534', closed:'#475569' };

function Pill({ label, bg, color }: { label:string; bg:string; color:string }) {
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 9px', borderRadius:999, fontSize:11, fontWeight:800, background:bg, color }}>{label}</span>;
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'Az önce';
  if (d < 3600) return `${Math.floor(d/60)}dk`;
  if (d < 86400) return `${Math.floor(d/3600)}s`;
  return `${Math.floor(d/86400)}g`;
}

export default function RequestsClient({ userRole, userId, onNewRequest }: { userRole: string; userId: string; onNewRequest?: () => void }) {
  const isAdmin = isAdminLike(userRole);
  const [rows, setRows]     = useState<Request[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Options>({ categories: [], users: [] });
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [q, setQ]               = useState('');
  const [debouncedQ, setDQ]     = useState('');
  const [statusFilter, setStatus] = useState('');
  const [priorityFilter, setPri]  = useState('');
  const [slaFilter, setSla]       = useState('');
  const [assigneeFilter, setAss]  = useState('');
  const [mineOnly, setMine]       = useState(!isAdmin);

  useEffect(() => { const t = setTimeout(() => setDQ(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [debouncedQ, statusFilter, priorityFilter, slaFilter, assigneeFilter, mineOnly]);
  useEffect(() => { fetch('/api/requests/options').then(r => r.json()).then(setOptions).catch(()=>{}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedQ)      p.set('q', debouncedQ);
      if (statusFilter)    p.set('status', statusFilter);
      if (priorityFilter)  p.set('priority', priorityFilter);
      if (slaFilter)       p.set('sla', slaFilter);
      if (assigneeFilter)  p.set('assignee', assigneeFilter);
      if (mineOnly)        p.set('mine', '1');
      const res  = await fetch(`/api/requests/list?${p}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  }, [page, pageSize, debouncedQ, statusFilter, priorityFilter, slaFilter, assigneeFilter, mineOnly]);

  useEffect(() => { void load(); }, [load]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="pax-page-container">
      <style jsx>{`
        .filters { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:14px 16px; display:grid; gap:10px; }
        .filter-row { display:grid; grid-template-columns:1fr auto auto auto auto auto; gap:8px; align-items:center; }
        .sel { padding:10px 12px; border:1px solid var(--border); border-radius:12px; font-size:12px; background:var(--surface); color:var(--text); outline:none; cursor:pointer; }
        .search-wrap { position:relative; }
        .search-wrap input { width:100%; padding:10px 12px 10px 34px; border:1px solid var(--border); border-radius:12px; font-size:13px; background:var(--surface); color:var(--text); outline:none; }
        .search-icon { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--text-4); font-size:15px; pointer-events:none; }
        .new-btn { display:inline-flex; align-items:center; gap:5px; padding:10px 16px; background:linear-gradient(135deg,#1d4ed8,#2563eb); color:#fff; border-radius:12px; font-size:13px; font-weight:700; text-decoration:none; white-space:nowrap; }

        /* Card list (mobile-first) */
        .req-list { display:grid; gap:8px; }
        .req-card { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:14px 16px; display:grid; gap:8px; text-decoration:none; transition:box-shadow .15s; }
        .req-card:hover { box-shadow:var(--shadow-md); border-color:var(--accent-border); }
        .req-card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
        .req-title { font-size:14px; font-weight:700; color:var(--text); line-height:1.4; }
        .req-meta  { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
        .req-footer { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .req-who   { font-size:11px; color:var(--text-3); }

        .pager { display:flex; justify-content:center; gap:6px; flex-wrap:wrap; }
        .pager-btn { padding:8px 14px; border:1px solid var(--border); border-radius:10px; font-size:12px; background:var(--surface); color:var(--text); cursor:pointer; font-weight:600; }
        .pager-btn.active { background:linear-gradient(135deg,#1d4ed8,#2563eb); color:#fff; border-color:transparent; }
        .pager-btn:disabled { opacity:.4; cursor:default; }

        @media (max-width:640px) {
          .filter-row { grid-template-columns:1fr auto; }
          .filter-extras { display:none; }
        }
      `}</style>

      {/* Filters */}
      <div className="filters">
        <div className="filter-row">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Talep ara..." />
          </div>
          <select className="sel" value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">Tüm durumlar</option>
            {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="sel filter-extras" value={priorityFilter} onChange={e => setPri(e.target.value)}>
            <option value="">Öncelik</option>
            {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="sel filter-extras" value={slaFilter} onChange={e => setSla(e.target.value)}>
            <option value="">SLA</option>
            {Object.entries(SLA_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {isAdmin && (
            <select className="sel filter-extras" value={assigneeFilter} onChange={e => setAss(e.target.value)}>
              <option value="">Tüm atananlar</option>
              {options.users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
            </select>
          )}
          <button onClick={() => onNewRequest?.()} className="new-btn" style={{ border:'none', cursor:'pointer' }}>+ Yeni</button>
        </div>
        {!isAdmin && (
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text-2)', cursor:'pointer' }}>
            <input type="checkbox" checked={mineOnly} onChange={e => setMine(e.target.checked)} />
            Sadece benim taleplerim
          </label>
        )}
      </div>

      {/* List header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'2px 4px' }}>
        <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>{total} kayıt · sayfa {page}/{totalPages}</span>
        {isAdmin && <Link href="/requests/dashboard" style={{ fontSize:12, color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>Dashboard →</Link>}
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>Yükleniyor...</div>
      ) : rows.length === 0 ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text-3)', fontSize:13, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20 }}>
          Talep bulunamadı. <Link href="/requests/new" style={{ color:'var(--accent)', fontWeight:700 }}>Yeni talep oluştur →</Link>
        </div>
      ) : (
        <div className="req-list">
          {rows.map(r => (
            <Link key={r.id} href={`/requests/${r.id}`} className="req-card">
              <div className="req-card-top">
                <div className="req-title">{r.title}</div>
                <Pill label={SLA_LABELS[r.sla_status]||r.sla_status} bg={SLA_BG[r.sla_status]||'#f1f5f9'} color={SLA_COLORS[r.sla_status]||'#475569'} />
              </div>
              <div className="req-meta">
                <Pill label={STATUS_LABELS[r.status]||r.status} bg={STATUS_BG[r.status]||'#f1f5f9'} color={STATUS_COLOR[r.status]||'#475569'} />
                <Pill label={r.priority} bg={PRIORITY_BG[r.priority]||'#f1f5f9'} color={PRIORITY_COLORS[r.priority]||'#475569'} />
                {r.request_categories && (
                  <Pill label={r.request_categories.name} bg={r.request_categories.color+'22'} color={r.request_categories.color} />
                )}
              </div>
              <div className="req-footer">
                <span className="req-who">{r.requester_name} → {r.assignee_name || 'Atanmamış'}</span>
                <span style={{ fontSize:11, color:'var(--text-4)' }}>{timeAgo(r.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pager">
          <button className="pager-btn" disabled={page<=1} onClick={() => setPage(p=>p-1)}>←</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pg = totalPages <= 5 ? i+1 : page <= 3 ? i+1 : page >= totalPages-2 ? totalPages-4+i : page-2+i;
            return <button key={pg} className={`pager-btn${pg===page?' active':''}`} onClick={() => setPage(pg)}>{pg}</button>;
          })}
          <button className="pager-btn" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}>→</button>
        </div>
      )}
    </main>
  );
}
