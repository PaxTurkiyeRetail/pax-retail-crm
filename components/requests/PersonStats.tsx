'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type PersonStat = {
  opened:         { total: number; byStatus: Record<string, number> };
  assigned:       { total: number; open: number; resolved: number; breached: number };
  avgResponseMin: number | null;
  avgResolutionHr: number | null;
  slaScore:       number | null;
  weeklyTrend:    { date: string; label: string; opened: number; resolved: number }[];
};

type Person = { user_id: string; full_name: string; role: string };

const STATUS_LABELS: Record<string,string> = {
  open:'Açık', assigned:'Atandı', in_progress:'Devam', waiting:'Bekliyor', resolved:'Çözüldü', closed:'Kapatıldı',
};
const STATUS_COLORS: Record<string,string> = {
  open:'#1d4ed8', assigned:'#0369a1', in_progress:'#b45309', waiting:'#4b5563', resolved:'#166534', closed:'#475569',
};
const STATUS_BG: Record<string,string> = {
  open:'#dbeafe', assigned:'#e0f2fe', in_progress:'#fef3c7', waiting:'#f3f4f6', resolved:'#dcfce7', closed:'#f1f5f9',
};

function fmt(min: number | null) {
  if (min === null) return '—';
  if (min < 60) return `${min}dk`;
  return `${Math.floor(min/60)}s ${min % 60}dk`;
}

const EMPTY: PersonStat = {
  opened:  { total:0, byStatus:{} },
  assigned:{ total:0, open:0, resolved:0, breached:0 },
  avgResponseMin: null, avgResolutionHr: null, slaScore: null,
  weeklyTrend: Array.from({ length:14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return { date: d.toISOString().slice(0,10), label:`${d.getDate()}/${d.getMonth()+1}`, opened:0, resolved:0 };
  }),
};

export default function PersonStats() {
  const [persons, setPersons]   = useState<Person[]>([]);
  const [selected, setSelected] = useState('');
  const [stats, setStats]       = useState<PersonStat>(EMPTY);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    fetch('/api/requests/options', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setPersons(d.users ?? []);
        if (d.users?.length) setSelected(d.users[0].user_id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/requests/stats?userId=${selected}`)
      .then(r => r.json())
      .then(d => setStats({
        opened:          d.opened          ?? EMPTY.opened,
        assigned:        d.assigned        ?? EMPTY.assigned,
        avgResponseMin:  d.avgResponseMin  ?? null,
        avgResolutionHr: d.avgResolutionHr ?? null,
        slaScore:        d.slaScore        ?? null,
        weeklyTrend:     Array.isArray(d.weeklyTrend) ? d.weeklyTrend : EMPTY.weeklyTrend,
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected]);

  const { opened, assigned, avgResponseMin, avgResolutionHr, slaScore, weeklyTrend } = stats;
  const trendMax = Math.max(1, ...weeklyTrend.flatMap(t => [t.opened, t.resolved]));
  const selectedPerson = persons.find(p => p.user_id === selected);

  const statusEntries = Object.entries(opened.byStatus).sort((a,b) => b[1] - a[1]);

  return (
    <main className="pax-page-container">
      <style jsx>{`
        .card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:20px; box-shadow:var(--shadow-sm); }
        .kicker { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); margin-bottom:12px; }
        .big { font-size:36px; font-weight:900; letter-spacing:-.04em; color:var(--text); }
        .sub { font-size:12px; color:var(--text-3); margin-top:4px; }
        .g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .g2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .score-ring { width:88px; height:88px; border-radius:999px; display:grid; place-items:center; flex-shrink:0; }
        @media (max-width:640px) { .g4 { grid-template-columns:1fr 1fr; } .g2 { grid-template-columns:1fr; } }
      `}</style>

      {/* Hero */}
      {/* Person selector */}
      <div className="card" style={{ padding:'14px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em' }}>Kişi seç:</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, flex:1 }}>
            {persons.map(p => (
              <button
                key={p.user_id}
                onClick={() => setSelected(p.user_id)}
                style={{
                  padding:'8px 16px', borderRadius:99, fontSize:13, fontWeight:700, cursor:'pointer',
                  border: selected === p.user_id ? 'none' : '1px solid var(--border)',
                  background: selected === p.user_id ? 'linear-gradient(135deg,#1d4ed8,#2563eb)' : 'var(--surface-2)',
                  color: selected === p.user_id ? '#fff' : 'var(--text-2)',
                  transition:'all .15s',
                }}
              >
                {p.full_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>Yükleniyor...</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="g4">
            <div className="card">
              <div className="kicker">Açık Talepler</div>
              <div className="big" style={{ color:'#2563eb' }}>{assigned.open}</div>
              <div className="sub">Atanmış, çözüm bekliyor</div>
            </div>
            <div className="card">
              <div className="kicker">Çözülen</div>
              <div className="big" style={{ color:'#16a34a' }}>{assigned.resolved}</div>
              <div className="sub">Kapatılmış talepler</div>
            </div>
            <div className="card">
              <div className="kicker">Ort. Çözüm</div>
              <div className="big" style={{ color:'#7c3aed', fontSize:28 }}>{avgResolutionHr !== null ? `${avgResolutionHr}s` : '—'}</div>
              <div className="sub">Talebi kapatma süresi</div>
            </div>
            <div className="card" style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div
                className="score-ring"
                style={{
                  background: slaScore === null ? 'var(--surface-2)'
                    : slaScore >= 80 ? '#dcfce7' : slaScore >= 60 ? '#fef3c7' : '#fee2e2',
                }}
              >
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:900, color: slaScore === null ? 'var(--text-3)' : slaScore >= 80 ? '#166534' : slaScore >= 60 ? '#b45309' : '#b91c1c' }}>
                    {slaScore !== null ? `${slaScore}%` : '—'}
                  </div>
                  <div style={{ fontSize:9, color:'var(--text-3)', textTransform:'uppercase', fontWeight:700 }}>SLA</div>
                </div>
              </div>
              <div>
                <div className="kicker" style={{ marginBottom:4 }}>SLA Performansı</div>
                <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.5 }}>
                  {assigned.resolved > 0 ? `${assigned.resolved} talep kapatıldı, ${assigned.breached} gecikti` : 'Henüz kapatılmış talep yok'}
                </div>
              </div>
            </div>
          </div>

          <div className="g2">
            {/* Açtığı talepler - durum dağılımı */}
            <div className="card">
              <div className="kicker">Açtığı Talepler — Durum Dağılımı</div>
              {statusEntries.length === 0 ? (
                <div style={{ fontSize:13, color:'var(--text-3)', padding:'8px 0' }}>Henüz talep açmamış.</div>
              ) : (
                <div style={{ display:'grid', gap:10 }}>
                  {statusEntries.map(([status, count]) => (
                    <div key={status} style={{ display:'grid', gridTemplateColumns:'100px 1fr 28px', gap:10, alignItems:'center' }}>
                      <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:800, background:STATUS_BG[status]||'#f1f5f9', color:STATUS_COLORS[status]||'#475569' }}>
                        {STATUS_LABELS[status]||status}
                      </span>
                      <div style={{ height:7, borderRadius:999, background:'var(--border)', overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:999, background:STATUS_COLORS[status]||'var(--accent)', width:`${Math.round((count/opened.total)*100)}%`, opacity:.7 }} />
                      </div>
                      <span style={{ fontSize:13, fontWeight:800, color:'var(--text)', textAlign:'right' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                <Link href={`/requests?mine=1`} style={{ fontSize:12, color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>
                  Açılan talepleri gör →
                </Link>
              </div>
            </div>

            {/* Haftalık trend */}
            <div className="card">
              <div className="kicker">14 Günlük Trend</div>
              <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-3)' }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:'var(--accent)', opacity:.8 }} />
                  Açtığı
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-3)' }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:'#16a34a', opacity:.8 }} />
                  Çözdüğü
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${weeklyTrend.length},1fr)`, gap:3, alignItems:'end', height:88 }}>
                {weeklyTrend.map(t => (
                  <div key={t.date} style={{ display:'grid', gap:2, justifyItems:'center', alignItems:'end' }}>
                    <div style={{ width:'100%', display:'grid', gap:1, alignItems:'end' }}>
                      <div style={{ width:'100%', borderRadius:'2px 2px 0 0', background:'var(--accent)', height:`${Math.max(2,Math.round((t.opened/trendMax)*40))}px`, opacity:.8 }} />
                      <div style={{ width:'100%', borderRadius:'0 0 2px 2px', background:'#16a34a', height:`${Math.max(2,Math.round((t.resolved/trendMax)*40))}px`, opacity:.8 }} />
                    </div>
                    <div style={{ fontSize:8, fontWeight:700, color:'var(--text-4)', textTransform:'uppercase' }}>{t.label.split('/')[0]}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, fontSize:12, color:'var(--text-3)' }}>
                <span>Toplam açtığı: <strong style={{ color:'var(--text)' }}>{weeklyTrend.reduce((a,t)=>a+t.opened,0)}</strong></span>
                <span>Toplam çözdüğü: <strong style={{ color:'#16a34a' }}>{weeklyTrend.reduce((a,t)=>a+t.resolved,0)}</strong></span>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
