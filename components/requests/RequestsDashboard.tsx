'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Stats = {
  kpis: { total:number; open:number; inProg:number; resolved:number; breached:number; atRisk:number; avgResponseMin:number|null; avgResolutionHr:number|null };
  byAssignee: { id:string; name:string; open:number; total:number; breached:number }[];
  byPriority: { priority:string; count:number }[];
  trend: { date:string; label:string; count:number }[];
};

const PRIORITY_COLORS: Record<string,string> = { critical:'#dc2626', high:'#ea580c', medium:'#ca8a04', low:'#16a34a' };
const PRIORITY_LABELS: Record<string,string> = { critical:'Kritik', high:'Yüksek', medium:'Orta', low:'Düşük' };

function formatMinutes(min: number|null) {
  if (min === null) return '—';
  if (min < 60) return `${min}dk`;
  return `${Math.floor(min/60)}s ${min%60}dk`;
}

const EMPTY: Stats = {
  kpis: { total:0, open:0, inProg:0, resolved:0, breached:0, atRisk:0, avgResponseMin:null, avgResolutionHr:null },
  byAssignee: [],
  byPriority: [
    { priority:'critical', count:0 },
    { priority:'high', count:0 },
    { priority:'medium', count:0 },
    { priority:'low', count:0 },
  ],
  trend: Array.from({ length:14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return { date: d.toISOString().slice(0,10), label:`${d.getDate()}/${d.getMonth()+1}`, count:0 };
  }),
};

export default function RequestsDashboard() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/requests/stats', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setStats({
          kpis:        data.kpis       ?? EMPTY.kpis,
          byAssignee:  Array.isArray(data.byAssignee)  ? data.byAssignee  : [],
          byPriority:  Array.isArray(data.byPriority)  ? data.byPriority  : EMPTY.byPriority,
          trend:       Array.isArray(data.trend)        ? data.trend       : EMPTY.trend,
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const { kpis, byAssignee, byPriority, trend } = stats;
  const trendMax   = Math.max(1, ...trend.map(t => t.count));
  const priorityMax = Math.max(1, ...byPriority.map(p => p.count));

  return (
    <main className="pax-page-container">
      <style jsx>{`
        .g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .g2 { display:grid; grid-template-columns:1fr 200px; gap:14px; }
        .card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:20px; box-shadow:var(--shadow-sm); }
        .kicker { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); }
        .arow { display:grid; grid-template-columns:1fr 48px 48px 56px; gap:12px; align-items:center; padding:10px 14px; border-radius:12px; border:1px solid var(--border); background:var(--surface-2); }
        .arow-extra {}
        @media (max-width:900px) { .g2 { grid-template-columns:1fr; } }
        @media (max-width:640px) {
          .g4 { grid-template-columns:1fr 1fr; }
          .arow { grid-template-columns:1fr 48px; }
          .arow-extra { display:none; }
        }
      `}</style>

      {error && <div style={{ padding:'12px 16px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, color:'#b91c1c', fontSize:13 }}>{error}</div>}

      <div className="g4">
        {[
          { label:'Devam Eden', value:kpis.inProg,   color:'#2563eb' },
          { label:'Çözülen',   value:kpis.resolved,  color:'#16a34a' },
          { label:'Riskli SLA',value:kpis.atRisk,    color:'#d97706' },
          { label:'Ort. Çözüm',value: kpis.avgResolutionHr !== null ? `${kpis.avgResolutionHr}s` : '—', color:'#7c3aed' },
        ].map(k => (
          <div key={k.label} className="card">
            <div className="kicker">{k.label}</div>
            <div style={{ fontSize:32, fontWeight:900, color:k.color, marginTop:6, letterSpacing:'-.04em' }}>{loading ? '…' : k.value}</div>
          </div>
        ))}
      </div>

      <div className="g2">
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:14 }}>
            <div>
              <div className="kicker">14 Günlük Talep Trendi</div>
              <div style={{ fontSize:26, fontWeight:900, color:'var(--text)', marginTop:4 }}>{trend.reduce((a,t)=>a+t.count,0)}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${trend.length},1fr)`, gap:3, alignItems:'end', height:80 }}>
            {trend.map(t => (
              <div key={t.date} style={{ display:'grid', gap:3, justifyItems:'center', alignItems:'end' }}>
                {t.count > 0 && <div style={{ fontSize:8, fontWeight:700, color:'var(--text-3)' }}>{t.count}</div>}
                <div style={{ width:'100%', borderRadius:'3px 3px 2px 2px', background: t.count ? 'var(--accent)' : 'var(--border)', height:`${Math.max(4, Math.round((t.count/trendMax)*60))}px`, opacity:.8 }} />
                <div style={{ fontSize:8, fontWeight:700, color:'var(--text-4)', textTransform:'uppercase' }}>{t.label.split('/')[0]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="kicker" style={{ marginBottom:14 }}>Açık · Önceliğe Göre</div>
          <div style={{ display:'grid', gap:12 }}>
            {byPriority.map(p => (
              <div key={p.priority} style={{ display:'grid', gridTemplateColumns:'64px 1fr 26px', gap:8, alignItems:'center' }}>
                <div style={{ fontSize:12, fontWeight:700, color:PRIORITY_COLORS[p.priority]||'var(--text-2)' }}>{PRIORITY_LABELS[p.priority]}</div>
                <div style={{ height:6, borderRadius:999, background:'var(--border)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:999, background:PRIORITY_COLORS[p.priority]||'var(--accent)', width:`${Math.round((p.count/priorityMax)*100)}%`, opacity:.8 }} />
                </div>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', textAlign:'right' }}>{p.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {byAssignee.length > 0 ? (
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div className="kicker">Kişi Bazlı Yük</div>
            <Link href="/requests" style={{ fontSize:12, color:'var(--accent)', textDecoration:'none', fontWeight:700 }}>Tüm talepler →</Link>
          </div>
          <div style={{ display:'grid', gap:8 }}>
            {byAssignee.slice(0,8).map(a => (
              <div key={a.id} className="arow">
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{a.total} toplam</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase' }}>Açık</div>
                  <div style={{ fontSize:20, fontWeight:900, color:'var(--text)' }}>{a.open}</div>
                </div>
                <div className="arow-extra" style={{ textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase' }}>Toplam</div>
                  <div style={{ fontSize:20, fontWeight:900, color:'var(--text)' }}>{a.total}</div>
                </div>
                <div className="arow-extra" style={{ textAlign:'center' }}>
                  <div style={{ fontSize:9, color:a.breached>0?'#b91c1c':'var(--text-3)', fontWeight:700, textTransform:'uppercase' }}>Geciken</div>
                  <div style={{ fontSize:20, fontWeight:900, color:a.breached>0?'#dc2626':'var(--text-4)' }}>{a.breached}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !loading ? (
        <div className="card" style={{ textAlign:'center', padding:40, color:'var(--text-3)', fontSize:13 }}>
          Henüz atanmış talep yok.{' '}
          <Link href="/requests/new" style={{ color:'var(--accent)', fontWeight:700 }}>İlk talebi oluştur →</Link>
        </div>
      ) : null}
    </main>
  );
}
