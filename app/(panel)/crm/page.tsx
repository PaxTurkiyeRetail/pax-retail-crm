"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CrmRow = {
  musteri_id: string;
  musteri: string;
  sektor: string | null;
  entegrasyon_tipi: string | null;
  risk: string | null;
  sorumlu: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  pipeline_durum: string | null;
  son_not: string | null;
  kunye_durumu?: string | null;
  kunye_eksik_sayisi?: number | null;
};

type Me = { email: string; full_name: string | null; role: string };
type AllowedUser = { email: string; full_name: string | null; role: string; is_active: boolean };
type ModalMode = "create" | "edit";

const ENTEGRASYON_OPTIONS = ["A2A", "D2D", "D2D+A2A"] as const;

function badgeStyle(status?: string | null) {
  if (status === "Var") return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" };
  if (status === "Eksik") return { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
  return { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" };
}

function badgeIcon(status?: string | null) {
  if (status === "Var") return "✓";
  if (status === "Eksik") return "!";
  return "×";
}

export default function CrmPage() {
  const [rows, setRows] = useState<CrmRow[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [allowed, setAllowed] = useState<AllowedUser[]>([]);
  const [q, setQ] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [fazFilter, setFazFilter] = useState("");
  const [durumFilter, setDurumFilter] = useState("");
  const [kunyeFilter, setKunyeFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>("create");
  const [busySave, setBusySave] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [musteri, setMusteri] = useState("");
  const [sektor, setSektor] = useState("");
  const [entegrasyon, setEntegrasyon] = useState("");
  const [risk, setRisk] = useState("");
  const [sorumlu, setSorumlu] = useState("");

  const displayMeName = useMemo(() => (me?.full_name ?? "").trim(), [me?.full_name]);

  const load = async () => {
    setMsg(null);
    const [meRes, listRes, usersRes] = await Promise.all([fetch("/api/me"), fetch("/api/crm/list"), fetch("/api/allowed-users-lite")]);
    if (!meRes.ok) {
      location.href = "/login";
      return;
    }

    const meJson = await meRes.json().catch(() => ({}));
    setMe(meJson.me);
    if (!["super_admin", "admin", "account_manager", "user"].includes(meJson?.me?.role ?? "")) {
      location.href = "/crm/activities";
      return;
    }

    const listJson = await listRes.json().catch(() => ({}));
    if (!listRes.ok) {
      setMsg(listJson?.message || "Bu ekrana erişim yetkin yok.");
      setRows([]);
    } else {
      setRows(listJson.rows ?? []);
    }

    if (usersRes.ok) {
      const uj = await usersRes.json().catch(() => ({}));
      setAllowed((uj.users ?? []).filter((x: AllowedUser) => (x.full_name ?? "").trim().length > 0));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const riskOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.risk).filter(Boolean) as string[])).sort(), [rows]);
  const fazOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.aktif_faz_adi || (r.aktif_faz_no != null ? String(r.aktif_faz_no) : "")).filter(Boolean))).sort(),
    [rows]
  );
  const durumOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.pipeline_durum).filter(Boolean) as string[])).sort(), [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQ = qq ? [r.musteri, r.sorumlu ?? "", r.son_not ?? ""].join(" ").toLowerCase().includes(qq) : true;
      const matchRisk = riskFilter ? (r.risk ?? "") === riskFilter : true;
      const fazVal = r.aktif_faz_adi || (r.aktif_faz_no != null ? String(r.aktif_faz_no) : "");
      const matchFaz = fazFilter ? fazVal === fazFilter : true;
      const matchDurum = durumFilter ? (r.pipeline_durum ?? "") === durumFilter : true;
      const matchKunye = kunyeFilter ? (r.kunye_durumu ?? "Yok") === kunyeFilter : true;
      return matchQ && matchRisk && matchFaz && matchDurum && matchKunye;
    });
  }, [rows, q, riskFilter, fazFilter, durumFilter, kunyeFilter]);

  const ownerOptions = useMemo(() => {
    const seen = new Set<string>();
    return allowed.map((u) => (u.full_name ?? "").trim()).filter((name) => name && !seen.has(name) && !!seen.add(name));
  }, [allowed]);

  const resetForm = () => {
    setEditingId(null);
    setMusteri("");
    setSektor("");
    setEntegrasyon("");
    setRisk("");
    setSorumlu(displayMeName);
  };

  const openCreate = () => {
    setMode("create");
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: CrmRow) => {
    setMode("edit");
    setEditingId(row.musteri_id);
    setMusteri(row.musteri ?? "");
    setSektor(row.sektor ?? "");
    setEntegrasyon(row.entegrasyon_tipi ?? "");
    setRisk(row.risk ?? "");
    setSorumlu(row.sorumlu ?? displayMeName);
    setMsg(null);
    setOpen(true);
  };

  const saveCustomer = async () => {
    setMsg(null);
    if (!musteri.trim()) return setMsg("Müşteri adı zorunlu.");
    if (!sorumlu.trim()) return setMsg("Sorumlu seçmek zorunlu.");
    if (entegrasyon && !ENTEGRASYON_OPTIONS.includes(entegrasyon as any)) return setMsg("Entegrasyon tipi geçersiz.");

    setBusySave(true);
    try {
      const url = mode === "create" ? "/api/crm/create" : "/api/crm/update";
      const body: Record<string, unknown> = {
        musteri: musteri.trim(),
        sektor: sektor.trim() || null,
        entegrasyon_tipi: entegrasyon.trim() || null,
        risk: risk.trim() || null,
        sorumlu: sorumlu.trim(),
      };
      if (mode === "edit") body.musteriId = editingId;

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(j?.message || "Kayıt kaydedilemedi.");
      setOpen(false);
      await load();
    } finally {
      setBusySave(false);
    }
  };

  return (
    <main style={{ maxWidth: 1180, margin: "30px auto", fontFamily: "system-ui", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>CRM</h1>
          <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>Müşteri listesi, künye durumu ve düzenleme</div>
        </div>
        <button onClick={openCreate} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontSize: 22, cursor: "pointer" }} title="Yeni müşteri">+</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.2fr) repeat(4, minmax(140px, 1fr))", gap: 10, marginTop: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri / sorumlu / son not" style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid #d1d5db" }} />
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={{ padding: 12, fontSize: 14, borderRadius: 10, border: "1px solid #d1d5db" }}>
          <option value="">Risk: Tümü</option>
          {riskOptions.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={fazFilter} onChange={(e) => setFazFilter(e.target.value)} style={{ padding: 12, fontSize: 14, borderRadius: 10, border: "1px solid #d1d5db" }}>
          <option value="">Faz: Tümü</option>
          {fazOptions.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={durumFilter} onChange={(e) => setDurumFilter(e.target.value)} style={{ padding: 12, fontSize: 14, borderRadius: 10, border: "1px solid #d1d5db" }}>
          <option value="">Durum: Tümü</option>
          {durumOptions.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={kunyeFilter} onChange={(e) => setKunyeFilter(e.target.value)} style={{ padding: 12, fontSize: 14, borderRadius: 10, border: "1px solid #d1d5db" }}>
          <option value="">Künye: Tümü</option>
          <option value="Var">Var</option>
          <option value="Eksik">Eksik</option>
          <option value="Yok">Yok</option>
        </select>
      </div>

      <div style={{ overflowX: "auto", marginTop: 12, background: "white", border: "1px solid #e5e7eb", borderRadius: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120 }}>
          <thead>
            <tr>
              {["Müşteri", "Künye", "Sektör", "Sorumlu", "Entegrasyon", "Risk", "Aktif Faz", "Durum", "Son Not", "İşlem"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const badge = badgeStyle(r.kunye_durumu);
              return (
                <tr key={r.musteri_id}>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6", fontWeight: 600 }}>
                    <Link href={`/crm/${r.musteri_id}`} style={{ color: "#111827", textDecoration: "none" }}>{r.musteri}</Link>
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                    <span
                      title={
                        r.kunye_durumu === "Eksik"
                          ? `Künye eksik${(r.kunye_eksik_sayisi ?? 0) > 0 ? ` (${r.kunye_eksik_sayisi} alan)` : ""}`
                          : r.kunye_durumu === "Var"
                            ? "Künye tamam"
                            : "Künye yok"
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        ...badge,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(255,255,255,0.7)",
                          fontSize: 12,
                          lineHeight: 1,
                          fontWeight: 800,
                        }}
                      >
                        {badgeIcon(r.kunye_durumu)}
                      </span>
                      <span>{r.kunye_durumu ?? "Yok"}</span>
                      {r.kunye_durumu === "Eksik" && (r.kunye_eksik_sayisi ?? 0) > 0 ? <span>({r.kunye_eksik_sayisi})</span> : null}
                    </span>
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>{r.sektor ?? ""}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>{r.sorumlu ?? ""}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>{r.entegrasyon_tipi ?? ""}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>{r.risk ?? ""}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>{r.aktif_faz_no ?? "-"} / {r.aktif_faz_adi ?? "-"}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>{r.pipeline_durum ?? ""}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6", maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.son_not ?? ""}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => openEdit(r)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}>Düzenle</button>
                      <Link href={`/crm/${r.musteri_id}`} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "white", textDecoration: "none" }}>Künye</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? <tr><td colSpan={10} style={{ padding: 16, opacity: 0.7 }}>Kayıt bulunamadı.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {open ? (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "grid", placeItems: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "100%", background: "white", borderRadius: 14, border: "1px solid #e5e7eb", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{mode === "create" ? "Yeni Müşteri" : "Müşteri Düzenle"}</div>
              <button onClick={() => setOpen(false)} style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>Kapat</button>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Müşteri adı *<input value={musteri} onChange={(e) => setMusteri(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }} /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Sektör<input value={sektor} onChange={(e) => setSektor(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }} /></label>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Entegrasyon tipi<select value={entegrasyon} onChange={(e) => setEntegrasyon(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}><option value="">Seç...</option>{ENTEGRASYON_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Risk<input value={risk} onChange={(e) => setRisk(e.target.value)} placeholder="örn: düşük / orta / yüksek" style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }} /></label>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Sorumlu<select value={sorumlu} onChange={(e) => setSorumlu(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}><option value="">Seç...</option>{ownerOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
              </div>
              <div style={{ fontSize: 12, color: "#4b5563", background: "#f9fafb", borderRadius: 10, padding: 10 }}>Künye kaydı bu ekrandan değil, müşteri detayından girilir. Müşteri listesinde Var / Eksik / Yok durumu görünür.</div>
              {msg ? <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", padding: 10, borderRadius: 10 }}>{msg}</div> : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button onClick={() => setOpen(false)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", cursor: "pointer" }}>İptal</button>
                <button onClick={saveCustomer} disabled={busySave} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "white", cursor: busySave ? "not-allowed" : "pointer", fontWeight: 700 }}>{busySave ? "..." : "Kaydet"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
