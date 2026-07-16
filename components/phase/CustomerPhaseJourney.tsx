"use client";
import '@/styles/customer-phase.css';

type Props = {
  activePhaseNo?: number | null;
  activePhaseName?: string | null;
};

type MainPhase = { key: string; label: string; start: number; end: number; tone: string; };

const MAIN_PHASES: MainPhase[] = [
  { key: 'firsat', label: 'Fırsat İlk Temas', start: 1, end: 4, tone: '#7c3aed' },
  { key: 'ilk-temas', label: 'Analiz + Sunumlar', start: 5, end: 9, tone: '#2563eb' },
  { key: 'business', label: 'Business', start: 10, end: 14, tone: '#b45309' },
  { key: 'operasyon', label: 'Operasyon', start: 15, end: 23, tone: '#be185d' },
  { key: 'yayilim', label: 'Yayılım', start: 24, end: 25, tone: '#166534' },
];

function phaseGroup(phaseNo?: number | null) {
  return MAIN_PHASES.find((phase) => phaseNo != null && phaseNo >= phase.start && phaseNo <= phase.end) ?? null;
}

export default function CustomerPhaseJourney({ activePhaseNo, activePhaseName }: Props) {
  const currentGroup = phaseGroup(activePhaseNo);
  const completedMain = MAIN_PHASES.filter((item) => activePhaseNo != null && activePhaseNo > item.end).length;
  const completedSub = activePhaseNo ? Math.max(0, activePhaseNo - 1) : 0;

  return (
    <section className="phase-shell">
      <div className="summary-grid">
        <Stat title="Mevcut Ana Faz" value={currentGroup?.label ?? 'Bağlanacak'} note={activePhaseNo ? `Faz ${activePhaseNo}` : 'Pipeline verisi bekleniyor'} />
        <Stat title="Aktif Alt Faz" value={activePhaseNo ? `Faz ${activePhaseNo}` : '-'} note={activePhaseName || 'Aktif faz adı bağlanacak'} />
        <Stat title="Tamamlanan Faz" value={`${completedSub} / 25`} note={`${completedMain} ana grup tamam`} />
        <Stat title="Tekrar / Log" value="Hazırlık" note="customer_phase_logs tablosu açılınca sayılacak" />
      </div>

      <div className="main-line">
        {MAIN_PHASES.map((phase) => {
          const state = activePhaseNo == null ? 'pending' : activePhaseNo > phase.end ? 'done' : activePhaseNo >= phase.start ? 'active' : 'pending';
          return (
            <div className={`main-card ${state}`} key={phase.key} style={{ ['--tone' as any]: phase.tone }}>
              <div className="main-head">
                <span className="state">{state === 'done' ? 'Tamamlandı' : state === 'active' ? 'Aktif' : 'Bekliyor'}</span>
                <span className="range">Faz {phase.start}-{phase.end}</span>
              </div>
              <div className="name">{phase.label}</div>
            </div>
          );
        })}
      </div>

      <div className="sub-grid">
        {Array.from({ length: 25 }, (_, idx) => idx + 1).map((phaseNo) => {
          const state = activePhaseNo == null ? 'pending' : phaseNo < activePhaseNo ? 'done' : phaseNo === activePhaseNo ? 'active' : 'pending';
          return <div key={phaseNo} className={`sub-card ${state}`}>Faz {phaseNo}</div>;
        })}
      </div>

      <div className="empty-log">
        <div>
          <strong>Faz geçmişi hazırlıkta</strong>
          <p>Detaylı tekrar sayısı, reopened kayıtları ve zaman çizgisi için log tablosu sonradan bağlanacak. Bu alan bilerek görünür bırakıldı; unutulmasın diye stamp ile birlikte takip edilecek.</p>
        </div>
      </div>

    </section>
  );
}

function Stat({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <article className="stat-card">
      <div className="title">{title}</div>
      <div className="value">{value}</div>
      <div className="note">{note}</div>
    </article>
  );
}
