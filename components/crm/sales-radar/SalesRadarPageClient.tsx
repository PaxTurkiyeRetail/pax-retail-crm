"use client";
import '@/styles/sales-radar.css';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';

type CrmRow = {
  musteri_id: string;
  musteri: string;
  sektor?: string | null;
  sorumlu?: string | null;
  aktif_faz_adi?: string | null;
  aktif_faz_no?: number | null;
  il?: string | null;
  kunye_durumu?: string | null;
};

type ActivityRow = {
  customer: string;
  created_at: string;
  created_by: string;
  channel: string;
  phase: string;
  phase_no: number | null;
  waiting: string;
  status: string;
  notes: string;
};

type RadarRow = {
  id: string;
  customerName: string;
  city: string;
  sector: string;
  ownerName: string;
  phaseLabel: string;
  phaseKey: 'Lead' | 'Contact' | 'Opportunity' | 'Pilot' | 'Rollout';
  lastActivityDate: string;
  lastActivityType: string;
  nextAction: string;
  targetDate: string;
  risk: 'Düşük' | 'Orta' | 'Yüksek';
  score: number;
  kunyeStatus: string;
};

type Filters = {
  search: string;
  phase: string;
  owner: string;
  sector: string;
  risk: string;
};

const EMPTY_FILTERS: Filters = {
  search: '',
  phase: 'all',
  owner: 'all',
  sector: 'all',
  risk: 'all',
};

export default function SalesRadarPageClient() {
  const [rows, setRows] = useState<RadarRow[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [crmRes, actRes] = await Promise.all([
          fetch('/api/crm/list?lite=1&pageSize=500', { cache: 'no-store' }),
          fetch('/api/reports/weekly-activities', { cache: 'no-store' }),
        ]);
        const crmJson = await crmRes.json().catch(() => ({ rows: [] }));
        const actJson = await actRes.json().catch(() => ({ list: [] }));
        if (cancelled) return;

        const crmRows = Array.isArray(crmJson.rows) ? crmJson.rows as CrmRow[] : [];
        const activityRows = Array.isArray(actJson.list) ? actJson.list as ActivityRow[] : [];
        const built = buildRadarRows(crmRows, activityRows);
        setRows(built);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    let result = [...rows];
    if (filters.search.trim()) {
      const q = filters.search.toLocaleLowerCase('tr');
      result = result.filter((row) =>
        [row.customerName, row.city, row.sector, row.ownerName, row.nextAction]
          .join(' ')
          .toLocaleLowerCase('tr')
          .includes(q)
      );
    }
    if (filters.phase !== 'all') result = result.filter((row) => row.phaseKey === filters.phase);
    if (filters.owner !== 'all') result = result.filter((row) => row.ownerName === filters.owner);
    if (filters.sector !== 'all') result = result.filter((row) => row.sector === filters.sector);
    if (filters.risk !== 'all') result = result.filter((row) => row.risk === filters.risk);
    return result;
  }, [rows, filters]);

  const kpis = useMemo(() => {
    return {
      trackedCustomers: rows.length,
      waitingActions: rows.filter((row) => row.nextAction !== '-').length,
      stale7Days: rows.filter((row) => isOlderThan7Days(row.lastActivityDate)).length,
      criticalPhases: rows.filter((row) => row.phaseKey === 'Opportunity' || row.phaseKey === 'Pilot').length,
      closingThisWeek: rows.filter((row) => isWithinThisWeek(row.targetDate)).length,
    };
  }, [rows]);

  const owners = useMemo(() => unique(rows.map((row) => row.ownerName)).filter(Boolean), [rows]);
  const sectors = useMemo(() => unique(rows.map((row) => row.sector)).filter(Boolean), [rows]);

  return (
    <main className="radar-shell">

      <section className="pax-hero hero">
        <div>
          <span className="eyebrow">Kurumsal CRM</span>
          <h1 className="title">Sales Radar</h1>
          <div className="sub">Müşteri fazları, sahiplik, son temas ve sıradaki aksiyonların operasyonel görünümü. Mevcut tasarım çizgisi korunarak radar ekranı eklendi.</div>
        </div>
        <div className="hero-actions">
          <Link className="secondary" href="/crm/reports">Rapor Merkezine Dön</Link>
          <Link className="primary" href="/crm/customers">Müşterilere Git</Link>
        </div>
      </section>

      <section className="stats-row">
        <div className="surface card"><div className="kicker">İzlenen Müşteri</div><div className="value">{kpis.trackedCustomers}</div><div className="hint">Radar kapsamındaki portföy</div></div>
        <div className="surface card"><div className="kicker">Aksiyon Bekleyen</div><div className="value">{kpis.waitingActions}</div><div className="hint">Sıradaki adımı tanımlı kayıt</div></div>
        <div className="surface card"><div className="kicker">7+ Gün Temassız</div><div className="value">{kpis.stale7Days}</div><div className="hint">Takip riski taşıyan müşteri</div></div>
        <div className="surface card"><div className="kicker">Kritik Fazlar</div><div className="value">{kpis.criticalPhases}</div><div className="hint">Opportunity ve Pilot yoğunluğu</div></div>
        <div className="surface card"><div className="kicker">Bu Hafta Kapanma</div><div className="value">{kpis.closingThisWeek}</div><div className="hint">Kısa vadeli sonuç potansiyeli</div></div>
      </section>

      <section className="surface filters">
        <div>
          <div className="kicker">Akıllı Filtreler</div>
          <div className="hint">Faz, sorumlu, sektör ve risk durumuna göre radar görünümünü daraltın.</div>
        </div>
        <div className="filters-grid">
          <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Müşteri, şehir, sektör veya sorumlu ara" />
          <select value={filters.phase} onChange={(e) => setFilters((prev) => ({ ...prev, phase: e.target.value }))}>
            <option value="all">Tüm Fazlar</option>
            <option value="Lead">Lead</option>
            <option value="Contact">Contact</option>
            <option value="Opportunity">Opportunity</option>
            <option value="Pilot">Pilot</option>
            <option value="Rollout">Rollout</option>
          </select>
          <select value={filters.owner} onChange={(e) => setFilters((prev) => ({ ...prev, owner: e.target.value }))}>
            <option value="all">Tüm Sorumlular</option>
            {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
          </select>
          <select value={filters.sector} onChange={(e) => setFilters((prev) => ({ ...prev, sector: e.target.value }))}>
            <option value="all">Tüm Sektörler</option>
            {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
          </select>
          <select value={filters.risk} onChange={(e) => setFilters((prev) => ({ ...prev, risk: e.target.value }))}>
            <option value="all">Tüm Riskler</option>
            <option value="Düşük">Düşük</option>
            <option value="Orta">Orta</option>
            <option value="Yüksek">Yüksek</option>
          </select>
        </div>
      </section>

      {loading ? <div className="loading">Sales Radar verileri yükleniyor...</div> : (
        <section className="layout">
          <section className="surface table-card">
            <div className="table-head">
              <div className="kicker">Radar Tablosu</div>
              <div className="hint">Faz, sahiplik, son temas ve sıradaki aksiyona göre operasyonel görünüm.</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Müşteri</th>
                    <th>Faz</th>
                    <th>Sorumlu</th>
                    <th>Sektör</th>
                    <th>Son Aktivite</th>
                    <th>Aktivite Tipi</th>
                    <th>Sıradaki Aksiyon</th>
                    <th>Hedef Tarih</th>
                    <th>Risk</th>
                    <th>Skor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="customer">
                          <strong>{row.customerName}</strong>
                          <span className="subtle">{[row.sector, row.city].filter(Boolean).join(' · ') || 'Müşteri kaydı'}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${row.phaseKey.toLowerCase()}`}>{row.phaseKey}</span></td>
                      <td>{row.ownerName}</td>
                      <td>{row.sector || '-'}</td>
                      <td><div className="customer"><strong>{formatDate(row.lastActivityDate)}</strong><span className="subtle">{fromNowLabel(row.lastActivityDate)}</span></div></td>
                      <td>{row.lastActivityType || '-'}</td>
                      <td>{row.nextAction || '-'}</td>
                      <td>{row.targetDate ? formatDate(row.targetDate) : '-'}</td>
                      <td><span className={`badge ${row.risk === 'Yüksek' ? 'risk-high' : row.risk === 'Orta' ? 'risk-mid' : 'risk-low'}`}>{row.risk}</span></td>
                      <td>
                        <div className="score">
                          <strong>{row.score}</strong>
                          <div className="score-line"><span style={{ width: `${row.score}%` }} /></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredRows.length ? <tr><td colSpan={10} className="subtle">Filtrelere uygun kayıt bulunamadı.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="side">
            <section className="surface mini">
              <div className="kicker">Faz Bazlı Yoğunluk</div>
              <div className="mini-list">
                {phaseCounts(rows).map((item) => <div key={item.label} className="mini-item"><span>{item.label}</span><strong>{item.value}</strong></div>)}
              </div>
            </section>
            <section className="surface mini">
              <div className="kicker">Risk Özeti</div>
              <div className="mini-list">
                {riskCounts(rows).map((item) => <div key={item.label} className="mini-item"><span>{item.label}</span><strong>{item.value}</strong></div>)}
              </div>
            </section>
            <section className="surface mini">
              <div className="kicker">Temassız Portföy</div>
              <div className="mini-list">
                {ownerStaleCounts(rows).map((item) => <div key={item.label} className="mini-item"><span>{item.label}</span><strong>{item.value}</strong></div>)}
              </div>
            </section>
          </aside>
        </section>
      )}
    </main>
  );
}

function buildRadarRows(crmRows: CrmRow[], activities: ActivityRow[]): RadarRow[] {
  const byCustomer = new Map<string, ActivityRow[]>();
  for (const item of activities) {
    const key = String(item.customer || '').trim();
    if (!key) continue;
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key)!.push(item);
  }

  return crmRows.map((row) => {
    const customerActivities = [...(byCustomer.get(row.musteri) ?? [])].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    const latest = customerActivities[0];
    const phase = phaseKeyFromNo(row.aktif_faz_no);
    const risk = deriveRisk(latest?.created_at ?? undefined, phase, row.kunye_durumu ?? undefined);
    const score = deriveScore(latest?.created_at ?? undefined, phase, row.kunye_durumu ?? undefined, latest?.channel ?? undefined);
    return {
      id: row.musteri_id,
      customerName: row.musteri,
      city: String(row.il ?? '').trim(),
      sector: String(row.sektor ?? '').trim(),
      ownerName: String(row.sorumlu ?? '').trim() || '-',
      phaseLabel: String(row.aktif_faz_adi ?? '').trim() || phase,
      phaseKey: phase,
      lastActivityDate: latest?.created_at ?? '',
      lastActivityType: latest?.channel ?? '-',
      nextAction: String(latest?.notes ?? '').trim() || defaultNextAction(phase),
      targetDate: suggestTargetDate(latest?.created_at ?? undefined),
      risk,
      score,
      kunyeStatus: String(row.kunye_durumu ?? '').trim(),
    };
  }).sort((a, b) => b.score - a.score);
}

function phaseKeyFromNo(phaseNo?: number | null): RadarRow['phaseKey'] {
  const value = Number(phaseNo || 0);
  if (value >= 1 && value <= 4) return 'Lead';
  if (value >= 5 && value <= 9) return 'Contact';
  if (value >= 10 && value <= 14) return 'Opportunity';
  if (value >= 15 && value <= 23) return 'Pilot';
  return 'Rollout';
}

function deriveRisk(date?: string, phase?: RadarRow['phaseKey'], kunyeStatus?: string): RadarRow['risk'] {
  if (!date) return 'Yüksek';
  const stale = isOlderThan7Days(date);
  if (stale && (phase === 'Opportunity' || phase === 'Pilot')) return 'Yüksek';
  if (stale || String(kunyeStatus || '').toLowerCase().includes('eksik')) return 'Orta';
  return 'Düşük';
}

function deriveScore(date?: string, phase?: RadarRow['phaseKey'], kunyeStatus?: string, channel?: string) {
  let score = 45;
  if (!date) score -= 15; else if (!isOlderThan7Days(date)) score += 20;
  if (phase === 'Opportunity') score += 15;
  if (phase === 'Pilot') score += 20;
  if (phase === 'Rollout') score += 10;
  if (String(kunyeStatus || '').toLowerCase().includes('var')) score += 10;
  if (channel === 'Yerinde Ziyaret') score += 10;
  return Math.max(18, Math.min(96, score));
}

function defaultNextAction(phase: RadarRow['phaseKey']) {
  if (phase === 'Lead') return 'İlk temas planlanacak';
  if (phase === 'Contact') return 'İkinci toplantı organize edilecek';
  if (phase === 'Opportunity') return 'Teklif paylaşılacak';
  if (phase === 'Pilot') return 'Pilot scope netleşecek';
  return 'Rollout takibi yapılacak';
}

function suggestTargetDate(date?: string) {
  const base = date ? new Date(date) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + 5);
  return base.toISOString();
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'tr'));
}

function isOlderThan7Days(value?: string | null) {
  if (!value) return true;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return true;
  const diff = Date.now() - d.getTime();
  return diff > 7 * 24 * 60 * 60 * 1000;
}

function isWithinThisWeek(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const diff = d.getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}


function fromNowLabel(value?: string | null) {
  if (!value) return 'Aktivite yok';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Aktivite yok';
  const diff = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diff <= 0) return 'Bugün';
  if (diff === 1) return '1 gün önce';
  return `${diff} gün önce`;
}

function phaseCounts(rows: RadarRow[]) {
  return ['Lead', 'Contact', 'Opportunity', 'Pilot', 'Rollout'].map((label) => ({
    label,
    value: rows.filter((row) => row.phaseKey === label).length,
  }));
}

function riskCounts(rows: RadarRow[]) {
  return ['Yüksek', 'Orta', 'Düşük'].map((label) => ({
    label,
    value: rows.filter((row) => row.risk === label).length,
  }));
}

function ownerStaleCounts(rows: RadarRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!isOlderThan7Days(row.lastActivityDate)) continue;
    map.set(row.ownerName, (map.get(row.ownerName) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}
