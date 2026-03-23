"use client";
import '@/styles/system-stamp.css';

import { useMemo, useState } from "react";
import { SYSTEM_REQUIREMENTS } from "@/lib/system-requirements";

type RequirementKey = keyof typeof SYSTEM_REQUIREMENTS;

type StampProps = {
  pageKey?: RequirementKey;
  moduleKey?: RequirementKey;
  compact?: boolean;
};

const toneMap = {
  mock:       { badge: "#e0f2fe", text: "Mock Mode",    accent: "#0369a1" },
  db:         { badge: "#fee2e2", text: "DB Gerekli",   accent: "#b91c1c" },
  automation: { badge: "#ede9fe", text: "Otomasyon",    accent: "#6d28d9" },
  ready:      { badge: "#dcfce7", text: "Hazır",        accent: "#166534" },
  schema:     { badge: "#fef3c7", text: "Schema Check", accent: "#b45309" },
} as const;

export default function SystemRequirementStamp({ pageKey, moduleKey, compact = false }: StampProps) {
  const [open, setOpen] = useState(false);
  const resolvedKey = (pageKey ?? moduleKey ?? "systemTracker") as RequirementKey;
  const item = SYSTEM_REQUIREMENTS[resolvedKey] ?? SYSTEM_REQUIREMENTS.systemTracker;
  const tone = useMemo(() => toneMap[item.status] ?? toneMap.ready, [item.status]);

  return (
    <>
      <button
        className={`req-stamp${compact ? " compact" : ""}`}
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: tone.badge, color: tone.accent }}
      >
        <span className="req-dot" style={{ background: tone.accent }} />
        <span>{tone.text}</span>
      </button>

      {open ? (
        <div className="req-overlay" onClick={() => setOpen(false)}>
          <aside className="req-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="req-head">
              <div>
                <div className="req-kicker" style={{ color: tone.accent }}>Yapılması Gerekenler</div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
              </div>
              <button className="req-close" onClick={() => setOpen(false)}>Kapat</button>
            </div>
            {item.db?.length ? <Section title="DB / Şema" items={item.db} /> : null}
            {item.backend?.length ? <Section title="Backend / Otomasyon" items={item.backend} /> : null}
            {item.ui?.length ? <Section title="UI / Görünüm" items={item.ui} /> : null}
            {item.notes?.length ? <Section title="Notlar" items={item.notes} /> : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="req-section">
      <h4>{title}</h4>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}
