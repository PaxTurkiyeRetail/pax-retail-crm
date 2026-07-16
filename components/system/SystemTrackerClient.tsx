"use client";
import '@/styles/system-tracker.css';

import { SYSTEM_REQUIREMENT_LIST } from "@/lib/system-requirements";

const statusLabel = {
  mock: "Mock Mode",
  db: "DB Bağlantısı",
  automation: "Otomasyon",
  ready: "Hazır",
  schema: "Schema Check",
} as const;

const statusTone = {
  mock: { text: "#0369a1", border: "#bae6fd", bg: "#f0f9ff" },
  db: { text: "#b91c1c", border: "#fecaca", bg: "#fef2f2" },
  automation: { text: "#6d28d9", border: "#ddd6fe", bg: "#f5f3ff" },
  ready: { text: "#166534", border: "#bbf7d0", bg: "#f0fdf4" },
  schema: { text: "#b45309", border: "#fde68a", bg: "#fffbeb" },
} as const;

export default function SystemTrackerClient() {
  return (
    <main className="tracker-page">
      <section className="pax-hero">
        <div>
          <p className="eyebrow">Sistem Hafızası</p>
          <h1>Sistem Gereksinimleri</h1>
          <p className="sub">Hangi ekranda hangi DB, backend veya otomasyon işi kaldığını tek yerden takip edin.</p>
        </div>
      </section>

      <section className="grid">
        {SYSTEM_REQUIREMENT_LIST.map((item) => {
          const tone = statusTone[item.status];
          return (
            <article className="card" key={item.key}>
              <div className="card-top">
                <div className="card-head-copy">
                  <div className="module">{item.module}</div>
                  <h3>{item.title}</h3>
                </div>
                <span className="badge" style={{ color: tone.text, borderColor: tone.border, background: tone.bg }}>
                  {statusLabel[item.status]}
                </span>
              </div>

              <p className="summary">{item.summary}</p>

              <div className="meta-stack">
                <Meta title="DB" items={item.db} />
                <Meta title="Backend" items={item.backend} />
                <Meta title="UI" items={item.ui} />
                <Meta title="Not" items={item.notes} />
              </div>

              <div className="card-foot">Son durum: plan takibinde</div>
            </article>
          );
        })}
      </section>

    </main>
  );
}

function Meta({ title, items }: { title: string; items?: string[] }) {
  const values = items?.length ? items : ["Bekleyen madde yok."];

  return (
    <div className="meta">
      <div className="meta-title">{title}</div>
      <ul>
        {values.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
