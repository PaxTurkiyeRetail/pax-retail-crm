"use client";

import { useEffect, useMemo, useState } from "react";

type ReportRow = {
  musteri: string;
  sektor: string;
  entegrasyon_tipi: string;
  mevcut_faz: string;
  son_aksiyon: string;
  sorumlu: string;
  risk_durumu: string;
  sonraki_adim: string;
  bekleyen_taraf: string;
};

function buildCsv(rows: Array<ReportRow & { no: number }>) {
  const headers = [
    "No",
    "Müşteri",
    "Sektör",
    "Entegrasyon Tipi",
    "Mevcut Faz",
    "Son Aksiyon",
    "Sorumlu",
    "Risk Durumu",
    "Sonraki Adım",
    "Bekleyen Taraf",
  ];

  const escapeCell = (value: string | number) => {
    const s = String(value ?? "");
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(
      [
        row.no,
        row.musteri,
        row.sektor,
        row.entegrasyon_tipi,
        row.mevcut_faz,
        row.son_aksiyon,
        row.sorumlu,
        row.risk_durumu,
        row.sonraki_adim,
        row.bekleyen_taraf,
      ]
        .map(escapeCell)
        .join(";"),
    );
  }
  return "\uFEFF" + lines.join("\n");
}

export default function ManagementReportPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reports/management", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(j?.message || "Rapor yüklenemedi.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mapped = useMemo(() => {
    return rows.map((r, idx) => ({
      no: idx + 1,
      musteri: r.musteri || "-",
      sektor: r.sektor || "-",
      entegrasyon_tipi: r.entegrasyon_tipi || "-",
      mevcut_faz: r.mevcut_faz || "-",
      son_aksiyon: r.son_aksiyon || "-",
      sorumlu: r.sorumlu || "-",
      risk_durumu: r.risk_durumu || "-",
      sonraki_adim: r.sonraki_adim || "-",
      bekleyen_taraf: r.bekleyen_taraf || "-",
    }));
  }, [rows]);

  const downloadExcelLikeCsv = () => {
    const csv = buildCsv(mapped);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `yonetim-raporu-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ maxWidth: 1460, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <section
        style={{
          background: "#fff",
          border: "1px solid #d7dfec",
          borderRadius: 20,
          boxShadow: "0 8px 28px rgba(15,23,42,0.05)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, color: "#0f172a" }}>Yönetim Raporu</h1>
            <div style={{ color: "#64748b", marginTop: 8, fontSize: 14 }}>
              Mevcut faz, müşteri sorumlusu, son not ve bekleyen taraf bilgileri tek ekranda listelenir.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={load}
              disabled={loading}
              style={{
                padding: "11px 14px",
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {loading ? "Yükleniyor..." : "Yenile"}
            </button>
            <button
              onClick={downloadExcelLikeCsv}
              style={{
                padding: "11px 14px",
                borderRadius: 12,
                border: "1px solid #0f172a",
                background: "#0f172a",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Excel İndir
            </button>
          </div>
        </div>

        {msg ? (
          <div style={{ marginTop: 14, fontSize: 14, color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 12, border: "1px solid #fecaca" }}>
            {msg}
          </div>
        ) : null}

        <div style={{ overflowX: "auto", marginTop: 16, border: "1px solid #d7dfec", borderRadius: 18, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1220 }}>
            <thead>
              <tr style={{ background: "#123d70", color: "#fff" }}>
                {[
                  "No",
                  "Müşteri",
                  "Sektör",
                  "Entegrasyon Tipi",
                  "Mevcut Faz",
                  "Son Aksiyon",
                  "Sorumlu",
                  "Risk Durumu",
                  "Sonraki Adım",
                  "Bekleyen Taraf",
                ].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: 14, fontWeight: 800, borderBottom: "1px solid #0f3058" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {mapped.map((r) => (
                <tr key={`${r.no}-${r.musteri}`} style={{ background: r.no % 2 === 1 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6" }}>{r.no}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6", fontWeight: 700, color: "#0f172a" }}>{r.musteri}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6" }}>{r.sektor}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6" }}>{r.entegrasyon_tipi}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6" }}>{r.mevcut_faz}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6" }}>{r.son_aksiyon}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6" }}>{r.sorumlu}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6" }}>{r.risk_durumu}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6" }}>{r.sonraki_adim}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #e6edf6" }}>{r.bekleyen_taraf}</td>
                </tr>
              ))}

              {mapped.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 18, opacity: 0.7 }}>
                    Kayıt yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
