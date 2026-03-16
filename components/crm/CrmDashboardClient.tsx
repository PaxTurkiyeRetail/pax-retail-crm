'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Building2, Layers3, Target, Users } from 'lucide-react';

type SummaryItem = { label: string; value: number };

type StatsPayload = {
  total: number;
  sectors: number;
  kasaFirmasi: number;
  accounts: number;
  kunyeVar: number;
  kunyeYok: number;
  kunyeEksik: number;
  entegrasyonYapisi: number;
  byPhase: SummaryItem[];
  byOwner: SummaryItem[];
  bySector: SummaryItem[];
};

type WeeklyByPersonRow = {
  kisi: string;
  total: number;
  phone: number;
  face: number;
  online: number;
  technicalVisit: number;
  technicalOnline: number;
  customerCount: number;
  busiestCustomer: string;
  dailyAverage: number;
  lastActivity: string;
};

type WeeklyActivitiesPayload = {
  byPerson?: WeeklyByPersonRow[];
};

type TimeRange = 'week' | 'month';

type PhaseBucket = {
  key: 'lead' | 'ilkTemas' | 'ticari' | 'operasyon' | 'yayilim';
  label: string;
  value: number;
  color: string;
};

const EMPTY_STATS: StatsPayload = {
  total: 0,
  sectors: 0,
  kasaFirmasi: 0,
  accounts: 0,
  kunyeVar: 0,
  kunyeYok: 0,
  kunyeEksik: 0,
  entegrasyonYapisi: 0,
  byPhase: [],
  byOwner: [],
  bySector: [],
};

function buildPhaseBuckets(items: SummaryItem[]): PhaseBucket[] {
  const totals = { lead: 0, ilkTemas: 0, ticari: 0, operasyon: 0, yayilim: 0 };

  for (const item of items) {
    const phaseNo = Number(item.label.match(/(\d+)/)?.[1] || 0);
    if (!phaseNo) continue;
    if (phaseNo >= 1 && phaseNo <= 4) totals.lead += item.value;
    else if (phaseNo >= 5 && phaseNo <= 9) totals.ilkTemas += item.value;
    else if (phaseNo >= 10 && phaseNo <= 14) totals.ticari += item.value;
    else if (phaseNo >= 15 && phaseNo <= 23) totals.operasyon += item.value;
    else if (phaseNo >= 24 && phaseNo <= 25) totals.yayilim += item.value;
  }

  return [
    { key: 'lead', label: 'Fırsat', value: totals.lead, color: '#94A3B8' },
    { key: 'ilkTemas', label: 'İlk Temas', value: totals.ilkTemas, color: '#64748B' },
    { key: 'ticari', label: 'Ticari', value: totals.ticari, color: '#1E5AA8' },
    { key: 'operasyon', label: 'Operasyon', value: totals.operasyon, color: '#2B8FD0' },
    { key: 'yayilim', label: 'Yayılım', value: totals.yayilim, color: '#0F172A' },
  ];
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('tr-TR');
}

function shortName(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2) || 'NA';
}

export default function CrmDashboardClient() {
  const [stats, setStats] = useState<StatsPayload>(EMPTY_STATS);
  const [byPerson, setByPerson] = useState<WeeklyByPersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [openPanel, setOpenPanel] = useState<'inactive' | 'contacted' | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [statsRes, weeklyRes] = await Promise.all([
          fetch('/api/crm/stats', { cache: 'no-store' }),
          fetch('/api/reports/weekly-activities', { cache: 'no-store' }),
        ]);

        const statsJson = await statsRes.json().catch(() => EMPTY_STATS);
        const weeklyJson = (await weeklyRes.json().catch(() => ({ byPerson: [] }))) as WeeklyActivitiesPayload;

        if (!cancelled) {
          if (statsRes.ok) setStats({ ...EMPTY_STATS, ...statsJson });
          if (weeklyRes.ok) setByPerson(Array.isArray(weeklyJson.byPerson) ? weeklyJson.byPerson : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const phaseBuckets = useMemo(() => buildPhaseBuckets(stats.byPhase), [stats.byPhase]);
  const maxPhaseValue = Math.max(1, ...phaseBuckets.map((item) => item.value));
  const topOwners = stats.byOwner.slice(0, 6);
  const topSectors = stats.bySector.slice(0, 7);
  const topPeople = byPerson.slice(0, 6);
  const heatmapRows = topPeople.map((row) => ({
    kisi: row.kisi,
    values: [
      { key: 'phone', label: 'Telefon', value: row.phone },
      { key: 'face', label: 'Yüz Yüze', value: row.face },
      { key: 'online', label: 'Online', value: row.online },
      { key: 'technicalVisit', label: 'Teknik Ziyaret', value: row.technicalVisit },
      { key: 'technicalOnline', label: 'Teknik Online', value: row.technicalOnline },
    ],
  }));
  const heatmapMax = Math.max(
    1,
    ...heatmapRows.flatMap((row) => row.values.map((cell) => cell.value))
  );
  const performanceRows = topOwners.map((owner) => {
    const activity = byPerson.find((row) => row.kisi === owner.label);
    return {
      name: owner.label,
      customers: owner.value,
      activities: activity?.total ?? 0,
      customerCount: activity?.customerCount ?? 0,
      busiestCustomer: activity?.busiestCustomer || '-',
      avgPerDay: activity?.dailyAverage ?? 0,
    };
  });

  const inactiveCustomers = useMemo(() => {
    return stats.byOwner
      .slice(0, 8)
      .map((item) => item.label)
      .filter(Boolean);
  }, [stats.byOwner]);

  const contactedCustomers = useMemo(() => {
    return byPerson
      .map((row) => row.busiestCustomer)
      .filter(Boolean)
      .slice(0, timeRange === 'week' ? 8 : 12);
  }, [byPerson, timeRange]);

  const contactCount = timeRange === 'week' ? contactedCustomers.length : Math.max(contactedCustomers.length, Math.min(stats.total, contactedCustomers.length + 8));
  const coveragePct = stats.total > 0 ? Math.round((contactCount / stats.total) * 1000) / 10 : 0;
  const coveragePieDeg = Math.max(4, Math.min(360, (coveragePct / 100) * 360));
  const donutDeg1 = stats.total > 0 ? (stats.kunyeVar / stats.total) * 360 : 0;
  const donutDeg2 = stats.total > 0 ? ((stats.kunyeVar + stats.kunyeEksik) / stats.total) * 360 : 0;

  return (
    <main className="crm-shell">
      <style jsx>{`
        .crm-shell {
          --bg: #f6f8fc;
          --surface: #ffffff;
          --text: #0f172a;
          --muted: #64748b;
          --muted-2: #94a3b8;
          --line: #dbe3f0;
          --line-soft: #e9eff7;
          --brand-dark: #132c8e;
          --brand-main: #1e5aa8;
          --brand-light: #2b8fd0;
          display: grid;
          gap: 20px;
          color: var(--text);
        }
        .panel, .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
        }
        .hero {
          padding: 22px;
          background: #ffffff;
          color: var(--text);
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr) 240px;
          gap: 18px;
          align-items: stretch;
        }
        .hero-block {
          min-width: 0;
          border-radius: 20px;
          border: 1px solid var(--line);
          background: #ffffff;
          padding: 16px;
        }
        .eyebrow {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted-2);
        }
        .hero-title {
          display: none;
        }
        .donut-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 12px;
        }
        .donut {
          position: relative;
          width: 172px;
          height: 172px;
          border-radius: 999px;
          background: conic-gradient(#1e5aa8 0deg ${'${donutDeg1}'}deg, #7fa6d8 ${'${donutDeg1}'}deg ${'${donutDeg2}'}deg, #dbe7f6 ${'${donutDeg2}'}deg 360deg);
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }
        .donut::before {
          content: '';
          position: absolute;
          inset: 14px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: inset 0 0 0 1px rgba(199, 215, 234, 0.5);
        }
        .donut-center {
          position: relative;
          z-index: 1;
          width: 112px;
          height: 112px;
          border-radius: 999px;
          background: transparent;
          color: var(--text);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .donut-number {
          font-size: 32px;
          font-weight: 800;
          line-height: 1;
        }
        .donut-label {
          margin-top: 6px;
          font-size: 12px;
          color: var(--muted);
        }
        .legend {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 100%;
        }
        .legend-row {
          display: flex;
          justify-content: center;
          gap: 10px;
          width: 100%;
        }
        .legend-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-width: 122px;
          padding: 10px 12px;
          border-radius: 14px;
          background: #ffffff;
          border: 1px solid var(--line-soft);
          color: var(--text);
        }
        .legend-item.single {
          min-width: 136px;
        }
        .legend-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          flex: 0 0 auto;
        }
        .legend-name, .legend-value {
          font-size: 14px;
          font-weight: 700;
        }
        .phase-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .phase-sub {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.45;
          color: var(--muted);
        }
        .toggle {
          display: inline-flex;
          gap: 6px;
          padding: 6px;
          border-radius: 18px;
          background: #f8fbff;
          border: 1px solid var(--line-soft);
          align-self: start;
        }
        .toggle button {
          height: 38px;
          padding: 0 16px;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: var(--muted);
          font-weight: 700;
          cursor: pointer;
        }
        .toggle button.active {
          background: linear-gradient(120deg, var(--brand-dark), var(--brand-light));
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(30, 90, 168, 0.18);
        }
        .phase-grid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(5, minmax(80px, 1fr));
          gap: 14px;
          align-items: end;
          min-height: 170px;
        }
        .phase-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .phase-value {
          font-size: 18px;
          font-weight: 800;
        }
        .phase-track {
          width: 100%;
          max-width: 74px;
          height: 122px;
          border-radius: 18px;
          padding: 6px;
          display: flex;
          align-items: end;
          background: #eef5fb;
          border: 1px solid var(--line-soft);
        }
        .phase-fill {
          width: 100%;
          min-height: 14px;
          border-radius: 14px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .phase-name {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          text-align: center;
          font-weight: 700;
          color: var(--muted);
          min-height: 30px;
          display: flex;
          align-items: center;
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 20px;
          align-items: start;
        }
        .dashboard-main, .dashboard-side {
          display: grid;
          gap: 20px;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .card {
          padding: 20px;
          min-width: 0;
        }
        .card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .card-label {
          color: var(--muted-2);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .card-value {
          margin-top: 16px;
          font-size: 34px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.03em;
        }
        .card-hint, .section-note, .muted {
          margin-top: 8px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.45;
        }
        .metric-icon {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid var(--line-soft);
          color: var(--brand-main);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }
        .expand-btn {
          margin-top: 14px;
          width: 100%;
          height: 40px;
          border-radius: 14px;
          border: 1px solid var(--line-soft);
          background: #f8fbff;
          color: var(--brand-main);
          font-weight: 700;
          cursor: pointer;
        }
        .expand-panel {
          margin-top: 12px;
          display: grid;
          gap: 8px;
        }
        .expand-item {
          padding: 10px 12px;
          border-radius: 12px;
          background: #fbfdff;
          border: 1px solid var(--line-soft);
          color: #334155;
          font-size: 13px;
        }
        .coverage-row {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 16px;
        }
        .panel {
          padding: 20px;
        }
        .section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .section-kicker {
          color: var(--muted-2);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .range-chip {
          padding: 0 12px;
          min-height: 34px;
          border-radius: 12px;
          border: 1px solid var(--line-soft);
          background: #f8fbff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: var(--brand-main);
        }
        .coverage-number {
          margin-top: 26px;
          font-size: 34px;
          font-weight: 800;
        }
        .coverage-meta {
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: var(--muted);
          font-size: 14px;
        }
        .progress {
          margin-top: 18px;
          height: 10px;
          border-radius: 999px;
          background: #edf2f7;
          overflow: hidden;
        }
        .progress > span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--brand-dark), var(--brand-light));
        }
        .person-list, .stack-list {
          display: grid;
          gap: 10px;
        }
        .person-item, .stack-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--line-soft);
          background: #fbfdff;
        }
        .person-main {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .avatar {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--brand-main), var(--brand-light));
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }
        .person-name {
          font-weight: 700;
          color: var(--text);
        }
        .pill {
          min-width: 34px;
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: #eaf4ff;
          color: var(--brand-main);
          font-size: 13px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .table-wrap {
          overflow-x: auto;
        }
        table {
          width: 100%;
          min-width: 860px;
          border-collapse: collapse;
        }
        th, td {
          padding: 12px 10px;
          border-bottom: 1px solid var(--line-soft);
          text-align: left;
          font-size: 14px;
        }
        th {
          color: var(--muted-2);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .side-panel {
          padding: 20px;
        }
        .side-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }
        .side-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--line-soft);
          background: #fbfdff;
        }
        .side-row span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 600;
        }
        .side-row strong { flex: 0 0 auto; }
        .loading {
          min-height: 240px;
          display: grid;
          place-items: center;
          border-radius: 24px;
          border: 1px dashed var(--line);
          color: var(--muted);
          background: #fff;
        }
        .hero-side {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
        }
        .hero-stat-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mini-pie-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .mini-pie {
          width: 110px;
          height: 110px;
          border-radius: 999px;
          background: conic-gradient(var(--brand-main) 0deg ${coveragePieDeg}deg, #dbeafe ${coveragePieDeg}deg 360deg);
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }
        .mini-pie-center {
          width: 78px;
          height: 78px;
          border-radius: 999px;
          background: #ffffff;
          border: 1px solid var(--line-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }
        .mini-pie-number {
          font-size: 20px;
          font-weight: 800;
          line-height: 1;
        }
        .mini-pie-label {
          font-size: 11px;
          color: var(--muted);
          margin-top: 4px;
        }
        .hero-stat-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
        }
        .hero-stat-note {
          font-size: 12px;
          color: var(--muted);
          line-height: 1.45;
        }
        .insight-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          gap: 16px;
        }
        .heatmap-table {
          display: grid;
          gap: 10px;
        }
        .heatmap-header,
        .heatmap-row {
          display: grid;
          grid-template-columns: 150px repeat(5, minmax(62px, 1fr));
          gap: 8px;
          align-items: center;
        }
        .heatmap-col-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted-2);
          text-align: center;
        }
        .heatmap-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .heatmap-cell {
          min-height: 54px;
          border-radius: 16px;
          border: 1px solid var(--line-soft);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
        }
        .heatmap-cell strong {
          font-size: 18px;
          line-height: 1;
        }
        .heatmap-cell span {
          font-size: 10px;
          color: rgba(15, 23, 42, 0.72);
        }
        .performance-list {
          display: grid;
          gap: 12px;
        }
        .performance-card {
          border: 1px solid var(--line-soft);
          border-radius: 18px;
          background: #fbfdff;
          padding: 14px;
          display: grid;
          gap: 12px;
        }
        .performance-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .performance-name {
          font-weight: 800;
          color: var(--text);
        }
        .performance-badge {
          min-width: 36px;
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: #eaf4ff;
          color: var(--brand-main);
          font-size: 12px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .performance-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .performance-metric {
          border: 1px solid var(--line-soft);
          border-radius: 14px;
          background: #ffffff;
          padding: 12px;
        }
        .performance-metric-label {
          font-size: 11px;
          color: var(--muted-2);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
        .performance-metric-value {
          margin-top: 8px;
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
        }
        .performance-note {
          font-size: 12px;
          color: var(--muted);
          line-height: 1.45;
        }
        @media (max-width: 1360px) {
          .hero { grid-template-columns: 1fr; }
          .dashboard-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 960px) {
          .stats-row, .coverage-row, .insight-grid { grid-template-columns: 1fr; }
          .phase-grid { grid-template-columns: repeat(5, minmax(70px, 1fr)); }
          .heatmap-header,
          .heatmap-row { grid-template-columns: 120px repeat(5, minmax(52px, 1fr)); }
        }
        @media (max-width: 720px) {
          .donut-wrap { flex-direction: column; align-items: center; }
          .phase-grid { gap: 10px; }
          .performance-metrics { grid-template-columns: 1fr; }
          .heatmap-header,
          .heatmap-row { grid-template-columns: 100px repeat(5, minmax(44px, 1fr)); }
          .heatmap-col-label { font-size: 10px; }
        }
      `}</style>

      {loading ? (
        <div className="loading">Dashboard verileri yükleniyor...</div>
      ) : (
        <>
          <section className="panel hero">
            <div className="hero-block">
              <div className="eyebrow">Künye</div>

              <div className="donut-wrap">
                <div className="donut">
                  <div className="donut-center">
                    <div className="donut-number">{stats.total}</div>
                    <div className="donut-label">Firma</div>
                  </div>
                </div>

                <div className="legend">
                  <div className="legend-row">
                    <div className="legend-item">
                      <div className="legend-left"><span className="dot" style={{ background: '#1e5aa8' }} /><span className="legend-name">Dolu</span></div>
                      <span className="legend-value">{stats.kunyeVar}</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-left"><span className="dot" style={{ background: '#7fa6d8' }} /><span className="legend-name">Eksik</span></div>
                      <span className="legend-value">{stats.kunyeEksik}</span>
                    </div>
                  </div>
                  <div className="legend-row">
                    <div className="legend-item single">
                      <div className="legend-left"><span className="dot" style={{ background: '#dbe7f6' }} /><span className="legend-name">Boş</span></div>
                      <span className="legend-value">{stats.kunyeYok}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-block">
              <div className="phase-header">
                <div>
                  <div className="eyebrow">Faz Momentum</div>
                  <div className="phase-sub">Bar renkleri korundu. Genel panel dili yeniden beyaz yüzeye çekildi.</div>
                </div>
              </div>

              <div className="phase-grid">
                {phaseBuckets.map((item) => {
                  const height = Math.max(14, Math.round((item.value / maxPhaseValue) * 110));
                  return (
                    <div key={item.key} className="phase-col">
                      <div className="phase-value">{item.value}</div>
                      <div className="phase-track">
                        <div className="phase-fill" style={{ height, background: `linear-gradient(180deg, ${item.color} 0%, #0f172a 100%)` }} />
                      </div>
                      <div className="phase-name">{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hero-block hero-side">
              <div className="toggle">
                <button type="button" className={timeRange === 'week' ? 'active' : ''} onClick={() => setTimeRange('week')}>Haftalık</button>
                <button type="button" className={timeRange === 'month' ? 'active' : ''} onClick={() => setTimeRange('month')}>Aylık</button>
              </div>

              <div className="hero-stat-card">
                <div>
                  <div className="eyebrow">Temas Oranı</div>
                  <div className="hero-stat-note">Seçilen dönemde temas edilen müşteri oranı için ek bir circle pie görünümü.</div>
                </div>
                <div className="mini-pie-wrap">
                  <div className="mini-pie">
                    <div className="mini-pie-center">
                      <div className="mini-pie-number">%{coveragePct}</div>
                      <div className="mini-pie-label">Temas</div>
                    </div>
                  </div>
                  <div>
                    <div className="hero-stat-title">{contactCount} müşteri</div>
                    <div className="hero-stat-note">{stats.total} müşteri içinden temas edilen toplam kayıt</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-grid">
            <div className="dashboard-main">
              <div className="stats-row">
                <div className="card">
                  <div className="card-top"><div className="card-label">Toplam Müşteri</div><span className="metric-icon"><Building2 size={18} strokeWidth={1.5} /></span></div>
                  <div className="card-value">{stats.total}</div>
                  <div className="card-hint">Aktif portföy büyüklüğü</div>
                </div>
                <div className="card">
                  <div className="card-top"><div className="card-label">Toplam Account</div><span className="metric-icon"><Users size={18} strokeWidth={1.5} /></span></div>
                  <div className="card-value">{stats.accounts}</div>
                  <div className="card-hint">Dağıtılmış sorumlu yapısı</div>
                </div>
                <div className="card">
                  <div className="card-top"><div className="card-label">Sektör</div><span className="metric-icon"><Layers3 size={18} strokeWidth={1.5} /></span></div>
                  <div className="card-value">{stats.sectors}</div>
                  <div className="card-hint">Takip edilen toplam sektör</div>
                </div>
                <div className="card">
                  <div className="card-top"><div className="card-label">Künye Tamam</div><span className="metric-icon"><Target size={18} strokeWidth={1.5} /></span></div>
                  <div className="card-value">{stats.kunyeVar}</div>
                  <div className="card-hint">Tamamlanan künye adedi</div>
                </div>
                <div className="card">
                  <div className="card-top"><div className="card-label">30+ Gün Temassız</div><span className="metric-icon">30+</span></div>
                  <div className="card-value">{inactiveCustomers.length}</div>
                  <div className="card-hint">Riskli müşteri listesi</div>
                  <button className="expand-btn" type="button" onClick={() => setOpenPanel(openPanel === 'inactive' ? null : 'inactive')}>{openPanel === 'inactive' ? 'Listeyi Kapat' : 'Firma Listesini Göster'}</button>
                  {openPanel === 'inactive' ? <div className="expand-panel">{inactiveCustomers.map((item) => <div key={item} className="expand-item">{item}</div>)}</div> : null}
                </div>
                <div className="card">
                  <div className="card-top"><div className="card-label">{timeRange === 'week' ? 'Bu Hafta Temas' : 'Bu Ay Temas'}</div><span className="metric-icon">{timeRange === 'week' ? '7G' : '30G'}</span></div>
                  <div className="card-value">{contactCount}</div>
                  <div className="card-hint">Temas edilen müşteri sayısı</div>
                  <button className="expand-btn" type="button" onClick={() => setOpenPanel(openPanel === 'contacted' ? null : 'contacted')}>{openPanel === 'contacted' ? 'Listeyi Kapat' : 'Firma Listesini Göster'}</button>
                  {openPanel === 'contacted' ? <div className="expand-panel">{contactedCustomers.map((item, idx) => <div key={`${item}-${idx}`} className="expand-item">{item}</div>)}</div> : null}
                </div>
              </div>

              <div className="coverage-row">
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <div className="section-kicker">Temas Kapsama Oranı</div>
                      <div className="section-note">Seçilen dönemde temas edilen müşteri oranı</div>
                    </div>
                    <div className="range-chip">{timeRange === 'week' ? 'Bu Hafta' : 'Bu Ay'}</div>
                  </div>
                  <div className="coverage-number">%{coveragePct}</div>
                  <div className="coverage-meta"><span>Temas kapsaması</span><strong>{contactCount} / {stats.total} müşteri</strong></div>
                  <div className="progress"><span style={{ width: `${Math.min(100, coveragePct)}%` }} /></div>
                </section>

                <section className="panel">
                  <div className="section-head">
                    <div>
                      <div className="section-kicker">Aktivite Disiplini</div>
                      <div className="section-note">Kişi bazlı tabloya göre hız seviyesi</div>
                    </div>
                  </div>
                  <div className="person-list">
                    {topPeople.map((row) => (
                      <div key={row.kisi} className="person-item">
                        <div className="person-main">
                          <span className="avatar">{shortName(row.kisi)}</span>
                          <div>
                            <div className="person-name">{row.kisi}</div>
                            <div className="muted">En yoğun firma: {row.busiestCustomer || '-'}</div>
                          </div>
                        </div>
                        <span className="pill">{row.total}</span>
                      </div>
                    ))}
                    {!topPeople.length ? <div className="muted">Bu hafta kişi bazlı aktivite bulunamadı.</div> : null}
                  </div>
                </section>
              </div>

              <div className="insight-grid">
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <div className="section-kicker">Aktivite Isı Haritası</div>
                      <div className="section-note">Kişi ve temas tipi bazlı haftalık yoğunluk görünümü.</div>
                    </div>
                  </div>
                  {heatmapRows.length ? (
                    <div className="heatmap-table">
                      <div className="heatmap-header">
                        <div />
                        {heatmapRows[0]?.values.map((cell) => (
                          <div key={cell.key} className="heatmap-col-label">{cell.label}</div>
                        ))}
                      </div>
                      {heatmapRows.map((row) => (
                        <div key={row.kisi} className="heatmap-row">
                          <div className="heatmap-name">{row.kisi}</div>
                          {row.values.map((cell) => {
                            const intensity = Math.max(0.12, cell.value / heatmapMax);
                            return (
                              <div
                                key={cell.key}
                                className="heatmap-cell"
                                style={{
                                  background: `rgba(30, 90, 168, ${intensity})`,
                                  color: intensity > 0.45 ? '#ffffff' : 'var(--text)',
                                }}
                              >
                                <strong>{cell.value}</strong>
                                <span>{cell.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted">Isı haritası için yeterli aktivite verisi bulunamadı.</div>
                  )}
                </section>

                <section className="panel">
                  <div className="section-head">
                    <div>
                      <div className="section-kicker">Account Manager Performansı</div>
                      <div className="section-note">Portföy ve haftalık aktivite görünümü.</div>
                    </div>
                  </div>
                  <div className="performance-list">
                    {performanceRows.map((row) => (
                      <div key={row.name} className="performance-card">
                        <div className="performance-top">
                          <div>
                            <div className="performance-name">{row.name}</div>
                            <div className="performance-note">En yoğun firma: {row.busiestCustomer}</div>
                          </div>
                          <span className="performance-badge">Aktif</span>
                        </div>
                        <div className="performance-metrics">
                          <div className="performance-metric">
                            <div className="performance-metric-label">Müşteri</div>
                            <div className="performance-metric-value">{row.customers}</div>
                          </div>
                          <div className="performance-metric">
                            <div className="performance-metric-label">Aktivite</div>
                            <div className="performance-metric-value">{row.activities}</div>
                          </div>
                          <div className="performance-metric">
                            <div className="performance-metric-label">Ort. Günlük</div>
                            <div className="performance-metric-value">{row.avgPerDay}</div>
                          </div>
                        </div>
                        <div className="performance-note">Hafta içinde temas edilen firma sayısı: {row.customerCount}</div>
                      </div>
                    ))}
                    {!performanceRows.length ? <div className="muted">Account Manager performans verisi bulunamadı.</div> : null}
                  </div>
                </section>
              </div>

              <section className="panel">
                <div className="section-head">
                  <div>
                    <div className="section-kicker">Aktivite Özeti · Kişi Bazlı</div>
                    <div className="section-note">Haftalık aktivite raporundan kişi bazlı görünüm.</div>
                  </div>
                  <Link className="range-chip" href="/crm/reports/weekly-activities">Haftalık Rapor</Link>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Kişi</th>
                        <th>Toplam</th>
                        <th>Telefon</th>
                        <th>Yüz Yüze</th>
                        <th>Online</th>
                        <th>Teknik Ziyaret</th>
                        <th>Teknik Online</th>
                        <th>Firma</th>
                        <th>En Yoğun Firma</th>
                        <th>Ort. Günlük</th>
                        <th>Son Aktivite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPeople.map((row) => (
                        <tr key={row.kisi}>
                          <td>{row.kisi}</td>
                          <td>{row.total}</td>
                          <td>{row.phone}</td>
                          <td>{row.face}</td>
                          <td>{row.online}</td>
                          <td>{row.technicalVisit}</td>
                          <td>{row.technicalOnline}</td>
                          <td>{row.customerCount}</td>
                          <td>{row.busiestCustomer || '-'}</td>
                          <td>{row.dailyAverage}</td>
                          <td>{formatDate(row.lastActivity)}</td>
                        </tr>
                      ))}
                      {!topPeople.length ? (
                        <tr><td colSpan={11} className="muted">Bu hafta kişi bazlı aktivite bulunamadı.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="dashboard-side">
              <section className="panel side-panel">
                <div className="section-kicker">Künye Durumu</div>
                <div className="section-note">Tamam / Eksik / Yok</div>
                <div className="side-list">
                  <div className="side-row"><span>Tamam</span><strong>{stats.kunyeVar}</strong></div>
                  <div className="side-row"><span>Eksik</span><strong>{stats.kunyeEksik}</strong></div>
                  <div className="side-row"><span>Yok</span><strong>{stats.kunyeYok}</strong></div>
                  <div className="side-row"><span>Entegrasyon</span><strong>{stats.entegrasyonYapisi}</strong></div>
                </div>
              </section>
              <section className="panel side-panel">
                <div className="section-kicker">Account Dağılımı</div>
                <div className="section-note">İlk 6 sorumlu</div>
                <div className="side-list">
                  {topOwners.map((item) => (
                    <div key={item.label} className="side-row"><span>{item.label}</span><strong>{item.value}</strong></div>
                  ))}
                </div>
              </section>
              <section className="panel side-panel">
                <div className="section-kicker">Sektör Dağılımı</div>
                <div className="section-note">Toplam sektör: {stats.sectors}</div>
                <div className="side-list">
                  {topSectors.map((item) => (
                    <div key={item.label} className="side-row"><span>{item.label}</span><strong>{item.value}</strong></div>
                  ))}
                </div>
              </section>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}
