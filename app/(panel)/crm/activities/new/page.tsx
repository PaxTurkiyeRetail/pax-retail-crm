"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
};

type FazRow = { faz_no: number; asama_adi: string };
type Me = { email: string; full_name: string | null; role: string };
type RecentRow = {
  id: string;
  faz_no: number | null;
  event_type: string | null;
  durum: string | null;
  aksiyon: string | null;
  owner: string | null;
  partner_owner: string | null;
  notlar: string | null;
  created_at: string;
  hedef_tarihi: string | null;
};

const AKTIVITELER = ["Online Toplantı", "Yerinde Ziyaret", "Telefon", "E-posta", "Diğer"] as const;
const FAZ_DURUM_OPTIONS = [
  { label: "Devam ediyor", value: "Devam Ediyor" },
  { label: "Tamamlandı", value: "Tamamlandı" },
  { label: "İhtiyaç duyulmadı", value: "İhtiyaç Duyulmadı" },
  { label: "Başlamadı", value: "Başlamadı" },
] as const;
const BEKLEYEN_TARAFLAR = ["Müşteri", "Müşteri IT", "Müşteri (Finance Owner)", "PAX RS(Support)"] as const;

export default function NewActivityPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [customers, setCustomers] = useState<CrmRow[]>([]);
  const [fazlar, setFazlar] = useState<FazRow[]>([]);
  const [recentRows, setRecentRows] = useState<RecentRow[]>([]);

  const [musteriId, setMusteriId] = useState("");
  const [musteriQuery, setMusteriQuery] = useState("");
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const customerBoxRef = useRef<HTMLDivElement | null>(null);
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const selected = useMemo(() => customers.find((c) => c.musteri_id === musteriId) ?? null, [customers, musteriId]);
  const fazMap = useMemo(() => Object.fromEntries(fazlar.map((f) => [String(f.faz_no), f.asama_adi])), [fazlar]);

  const [kanal, setKanal] = useState<(typeof AKTIVITELER)[number]>("Online Toplantı");
  const [notlar, setNotlar] = useState("");
  const [fazNo, setFazNo] = useState<number | null>(null);
  const [fazDurum, setFazDurum] = useState<(typeof FAZ_DURUM_OPTIONS)[number]["value"]>("Devam Ediyor");
  const [bekleyenTaraf, setBekleyenTaraf] = useState<(typeof BEKLEYEN_TARAFLAR)[number] | "">("");

  const [planEnabled, setPlanEnabled] = useState(false);
  const [planTarih, setPlanTarih] = useState("");
  const [planAktivite, setPlanAktivite] = useState<(typeof AKTIVITELER)[number]>("Online Toplantı");
  const [planNot, setPlanNot] = useState("");
  const [planHedefFazNo, setPlanHedefFazNo] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [phaseMetaBusy, setPhaseMetaBusy] = useState(false);
  const [recentBusy, setRecentBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const currentFazLabel = selected ? (selected.aktif_faz_no ?? '-') + (selected.aktif_faz_adi ? ` / ${selected.aktif_faz_adi}` : '') : '-';

  const filteredCustomers = useMemo(() => {
    const q = musteriQuery.trim().toLocaleLowerCase("tr");
    if (!q) return customers.slice(0, 12);
    const starts = customers.filter((c) => c.musteri.toLocaleLowerCase("tr").startsWith(q));
    const contains = customers.filter((c) => !c.musteri.toLocaleLowerCase("tr").startsWith(q) && c.musteri.toLocaleLowerCase("tr").includes(q));
    return [...starts, ...contains].slice(0, 14);
  }, [customers, musteriQuery]);

  const load = async () => {
    setMsg(null);
    const [meRes, cRes, fRes] = await Promise.all([fetch("/api/me"), fetch("/api/crm/list?lite=1"), fetch("/api/faz/list")]);
    if (!meRes.ok) {
      location.href = "/login";
      return;
    }
    setMe((await meRes.json()).me);
    const cj = await cRes.json().catch(() => ({}));
    if (cRes.ok) setCustomers(cj.rows ?? []);
    const fj = await fRes.json().catch(() => ({}));
    if (fRes.ok) setFazlar((fj.fazlar ?? []).sort((a: FazRow, b: FazRow) => a.faz_no - b.faz_no));
    if (!fRes.ok) setMsg(fj?.message || "Faz listesi alınamadı.");
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (!customerBoxRef.current) return;
      if (!customerBoxRef.current.contains(event.target as Node)) setCustomerMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  useEffect(() => {
    if (selected) setMusteriQuery(selected.musteri);
  }, [selected?.musteri_id]);

  useEffect(() => {
    if (!selected) return;
    const current = selected.aktif_faz_no ?? null;
    setFazNo(current);
    setPlanEnabled(false);
    setPlanTarih("");
    setPlanNot("");
    setBekleyenTaraf("");
    setPlanAktivite("Online Toplantı");
    setPlanHedefFazNo(current);
    setFazDurum("Devam Ediyor");
    setNotlar("");
  }, [selected?.musteri_id]);

  useEffect(() => {
    if (fazNo == null) return;
    setPlanHedefFazNo(fazNo);
  }, [fazNo]);

  useEffect(() => {
    if (!planEnabled) return;
    setPlanAktivite(kanal);
    if (!planTarih.trim()) {
      const d = new Date();
      setPlanTarih(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }, [planEnabled, kanal]);

  useEffect(() => {
    const run = async () => {
      if (!musteriId || fazNo == null) return;
      setPhaseMetaBusy(true);
      try {
        const res = await fetch(`/api/activities/meta?musteri_id=${musteriId}&faz_no=${fazNo}`, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (j?.durum && FAZ_DURUM_OPTIONS.some((o) => o.value === j.durum)) setFazDurum(j.durum);
        if (j?.partner_owner && BEKLEYEN_TARAFLAR.includes(j.partner_owner)) setBekleyenTaraf(j.partner_owner);
      } finally {
        setPhaseMetaBusy(false);
      }
    };
    run();
  }, [musteriId, fazNo]);

  useEffect(() => {
    const loadRecent = async () => {
      if (!musteriId) {
        setRecentRows([]);
        setHistoryOpen(false);
        return;
      }
      setRecentBusy(true);
      setHistoryOpen(true);
      try {
        const res = await fetch(`/api/activities/customer?musteri_id=${musteriId}`, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (res.ok) setRecentRows(j.rows ?? []);
      } finally {
        setRecentBusy(false);
      }
    };
    loadRecent();
  }, [musteriId]);

  const chooseCustomer = (customer: CrmRow) => {
    setMusteriId(customer.musteri_id);
    setMusteriQuery(customer.musteri);
    setCustomerMenuOpen(false);
  };

  const clearCustomer = () => {
    setMusteriId("");
    setMusteriQuery("");
    setCustomerMenuOpen(true);
    setFazNo(null);
    setPlanHedefFazNo(null);
    setRecentRows([]);
    window.setTimeout(() => customerInputRef.current?.focus(), 0);
  };

  const applyRecentPhase = (row: RecentRow) => {
    if (row.faz_no != null) setFazNo(row.faz_no);
    if (row.durum && FAZ_DURUM_OPTIONS.some((o) => o.value === row.durum)) setFazDurum(row.durum as any);
    if (row.partner_owner && BEKLEYEN_TARAFLAR.includes(row.partner_owner as any)) setBekleyenTaraf(row.partner_owner as any);
  };

  const submit = async () => {
    setMsg(null);
    if (!musteriId) return setMsg("Müşteri seçmelisin.");
    if (fazNo == null) return setMsg("İşlem yapılan fazı seçmelisin.");
    if (!bekleyenTaraf) return setMsg("Bekleyen Taraf seçmelisin.");
    if (planEnabled && !planTarih.trim()) return setMsg("Sonraki aktivite için tarih zorunlu.");

    setBusy(true);
    try {
      const plan = planEnabled ? { hedef_tarihi: planTarih.trim(), hedef_aktivite: planAktivite, hedef_not: planNot.trim(), hedef_faz_no: planHedefFazNo } : null;
      const res = await fetch("/api/activities/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ musteri_id: musteriId, kanal, notlar: notlar.trim() || null, faz_no: fazNo, faz_durum: fazDurum, bekleyen_taraf: bekleyenTaraf || null, plan }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(j?.message || "Kaydedilemedi");
      location.href = "/crm/activities";
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <style jsx>{`
        .page { display: grid; gap: 18px; }
        .header { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        .title { margin: 0; font-size: clamp(30px, 3vw, 42px); line-height: 1.05; color: #0f172a; }
        .back { text-decoration: none; color: #0f172a; border: 1px solid #cbd5e1; background: #fff; border-radius: 14px; padding: 11px 15px; font-weight: 900; }
        .surface { background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%); border: 1px solid #dbe3ee; border-radius: 24px; box-shadow: 0 18px 36px rgba(15,23,42,0.05); padding: 22px; display: grid; gap: 16px; }
        .grid-two { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
        .field-wrap { display: grid; gap: 6px; min-width: 0; }
        .field-label { font-size: 12px; font-weight: 900; color: #334155; }
        .field, .select, .search-input, .textarea { width: 100%; min-height: 48px; border-radius: 14px; border: 1px solid #c7d4e3; background: #fff; color: #0f172a; padding: 0 14px; }
        .textarea { padding: 14px; min-height: 128px; resize: vertical; }
        .customer-search { position: relative; }
        .search-input { padding-right: 42px; }
        .search-toggle { position: absolute; right: 10px; top: 10px; width: 28px; height: 28px; border-radius: 10px; border: none; background: transparent; cursor: pointer; color: #475569; }
        .customer-menu { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 8px); background: #fff; border: 1px solid #d8e3ef; border-radius: 18px; box-shadow: 0 18px 36px rgba(15,23,42,0.12); max-height: 340px; overflow: auto; }
        .customer-option { width: 100%; border: none; background: transparent; display: grid; gap: 4px; text-align: left; padding: 14px 16px; cursor: pointer; }
        .customer-option:hover { background: #f8fbff; }
        .customer-name { font-weight: 900; color: #0f172a; }
        .customer-meta, .field-help, .muted { font-size: 12px; color: #64748b; }
        .selected-customer, .summary-card { display: flex; justify-content: space-between; gap: 16px; align-items: center; border: 1px solid #dbe3ee; border-radius: 20px; background: #f8fbff; padding: 16px; }
        .selected-main, .summary-main { display: grid; gap: 6px; }
        .selected-title, .summary-value { font-size: 18px; font-weight: 900; color: #0f172a; }
        .summary-value { font-size: 22px; }
        .secondary-btn, .toggle-btn, .primary-btn, .use-btn { min-height: 44px; border-radius: 14px; font-weight: 900; cursor: pointer; }
        .secondary-btn { border: 1px solid #cbd5e1; background: #fff; padding: 0 16px; }
        .toggle-btn { border: 1px solid #0f172a; background: #fff; color: #0f172a; padding: 0 16px; }
        .toggle-btn.active { background: #0f172a; color: #fff; }
        .primary-btn { border: 1px solid #0f172a; background: linear-gradient(135deg,#0f172a 0%,#1e293b 100%); color: #fff; padding: 0 20px; }
        .recent-table { overflow: auto; border: 1px solid #e2e8f0; border-radius: 18px; background: #fff; }
        table { width: 100%; border-collapse: collapse; min-width: 920px; }
        th { text-align: left; padding: 12px 14px; font-size: 12px; color: #475569; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 14px; border-bottom: 1px solid #eef2f7; vertical-align: top; color: #0f172a; }
        .phase-pill, .status-pill, .plan-pill { display: inline-flex; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 900; }
        .phase-pill { background: #ecfdf5; color: #166534; }
        .status-pill { background: #eff6ff; color: #1d4ed8; }
        .plan-pill { background: #fef3c7; color: #b45309; }
        .history-box { display: grid; gap: 10px; }
        .history-toggle { display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 100%; min-height: 54px; border-radius: 16px; border: 1px solid #dbe3ee; background: linear-gradient(180deg,#ffffff 0%,#f8fbff 100%); color: #0f172a; padding: 0 16px; font-weight: 900; cursor: pointer; }
        .history-count { color: #475569; font-size: 12px; font-weight: 800; }
        .chev { color: #64748b; font-size: 18px; line-height: 1; }
        .plan-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .plan-title { margin: 0; font-size: 28px; color: #0f172a; }
        .plan-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
        .message { color: #b91c1c; background: #fff1f2; border: 1px solid #fecdd3; padding: 12px 14px; border-radius: 14px; }
        .actions { display: flex; justify-content: flex-end; }
        .empty { padding: 18px; color: #64748b; }
        @media (max-width: 920px) { .grid-two, .plan-grid { grid-template-columns: 1fr; } .selected-customer, .summary-card, .header, .plan-header { align-items: stretch; } .actions { justify-content: stretch; } .primary-btn, .secondary-btn, .toggle-btn { width: 100%; } }
      `}</style>

      <div className="header">
        <h1 className="title">Aktivite Gir</h1>
        <Link href="/crm/activities" className="back">Geri dön</Link>
      </div>

      <section className="surface">
        <div className="field-wrap" ref={customerBoxRef}>
          <div className="field-label">Müşteri</div>
          {selected ? (
            <div className="selected-customer">
              <div className="selected-main">
                <div className="selected-title">{selected.musteri}</div>
                <div className="customer-meta">Mevcut faz: {selected.aktif_faz_no ?? "-"}{selected.aktif_faz_adi ? ` - ${selected.aktif_faz_adi}` : ""}</div>
                {selected.sorumlu ? <div className="customer-meta">Sorumlu: {selected.sorumlu}</div> : null}
                {phaseMetaBusy ? <div className="customer-meta">Faz bilgisi yükleniyor…</div> : null}
              </div>
              <button type="button" className="secondary-btn" onClick={clearCustomer}>Değiştir</button>
            </div>
          ) : (
            <div className="customer-search">
              <input ref={customerInputRef} className="search-input" value={musteriQuery} onFocus={() => setCustomerMenuOpen(true)} onChange={(e) => { setMusteriQuery(e.target.value); setCustomerMenuOpen(true); if (musteriId) setMusteriId(""); }} placeholder="Müşteri adıyla ara..." autoComplete="off" />
              <button type="button" className="search-toggle" onClick={() => setCustomerMenuOpen((v) => !v)}>▾</button>
              {customerMenuOpen ? (
                <div className="customer-menu">
                  {filteredCustomers.length ? filteredCustomers.map((c) => (
                    <button key={c.musteri_id} type="button" className="customer-option" onClick={() => chooseCustomer(c)}>
                      <span className="customer-name">{c.musteri}</span>
                      <span className="customer-meta">{c.aktif_faz_no ?? "-"}{c.aktif_faz_adi ? ` - ${c.aktif_faz_adi}` : ""}</span>
                    </button>
                  )) : <div className="empty">Sonuç bulunamadı.</div>}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {selected ? (
          <div className="summary-card">
            <div className="summary-main">
              <div className="customer-meta">Mevcut Faz</div>
              <div className="summary-value">{currentFazLabel}</div>
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="history-box">
            <button type="button" className="history-toggle" onClick={() => setHistoryOpen((v) => !v)}>
              <span>Önceki Aktiviteler <span className="history-count">({recentRows.length} kayıt)</span></span>
              <span className="chev">{historyOpen ? "▴" : "▾"}</span>
            </button>
            {historyOpen ? (
              <div className="recent-table">
                <table>
                  <thead>
                    <tr>
                      <th>Tarih</th><th>Faz</th><th>Aktivite</th><th>Not</th><th>Durum</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRows.map((row) => {
                      const phaseName = row.faz_no != null ? fazMap[String(row.faz_no)] : "";
                      const detail = String(row.aksiyon ?? "-").replace(/^AKTIVITE:/, "");
                      const effectiveStatus = row.durum ?? "-";
                      const dueDate = row.hedef_tarihi;
                      return (
                        <tr key={row.id}>
                          <td>{new Date(row.created_at).toLocaleString("tr-TR")}{dueDate ? <div className="muted">Hedef: {dueDate}</div> : null}</td>
                          <td><span className="phase-pill">{row.faz_no ?? "-"}{phaseName ? ` · ${phaseName}` : ""}</span></td>
                          <td><span className="status-pill">{detail || "Kayıt"}</span></td>
                          <td>{row.notlar ?? "-"}</td>
                          <td>{effectiveStatus}</td>
                          <td><button type="button" className="use-btn secondary-btn" onClick={() => applyRecentPhase(row)}>Bu fazı seç</button></td>
                        </tr>
                      );
                    })}
                    {!recentBusy && recentRows.length === 0 ? <tr><td colSpan={6} className="empty">Bu müşteri için kayıt bulunamadı.</td></tr> : null}
                    {recentBusy ? <tr><td colSpan={6} className="empty">Yükleniyor...</td></tr> : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid-two">
          <label className="field-wrap"><span className="field-label">Aktivite</span><select value={kanal} onChange={(e) => setKanal(e.target.value as any)} className="select">{AKTIVITELER.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          <label className="field-wrap"><span className="field-label">Bekleyen Taraf</span><select value={bekleyenTaraf} onChange={(e) => setBekleyenTaraf(e.target.value as any)} className="select"><option value="">Seç...</option>{BEKLEYEN_TARAFLAR.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
        </div>

        <div className="grid-two">
          <label className="field-wrap">
            <span className="field-label">Faz</span>
            <select value={fazNo ?? ""} onChange={(e) => setFazNo(e.target.value ? Number(e.target.value) : null)} className="select" disabled={!selected || !fazlar.length}>
              {!selected ? <option value="">Önce müşteri seç...</option> : <option value="">Faz seç...</option>}
              {fazlar.map((f) => <option key={f.faz_no} value={f.faz_no}>{f.faz_no} - {f.asama_adi}</option>)}
            </select>
            <span className="field-help">İşlem hangi faz için yapılıyorsa o fazı seç.</span>
          </label>
          <label className="field-wrap"><span className="field-label">Faz Durumu</span><select value={fazDurum} onChange={(e) => setFazDurum(e.target.value as any)} className="select">{FAZ_DURUM_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
        </div>

        <label className="field-wrap"><span className="field-label">Aktivite Notu</span><textarea value={notlar} onChange={(e) => setNotlar(e.target.value)} rows={4} className="textarea" placeholder="Görüşme notu..." /></label>
      </section>

      <section className="surface">
        <div className="plan-header">
          <h2 className="plan-title">Sonraki Aktivite</h2>
          <button type="button" className={`toggle-btn${planEnabled ? " active" : ""}`} onClick={() => setPlanEnabled((v) => !v)}>{planEnabled ? "Alanı kapat" : "Sonraki aktivite ekle"}</button>
        </div>

        {planEnabled ? (
          <div className="plan-grid">
            <label className="field-wrap"><span className="field-label">Tarih</span><input value={planTarih} onChange={(e) => setPlanTarih(e.target.value)} type="date" className="field" /></label>
            <label className="field-wrap"><span className="field-label">Sonraki Faz</span><select value={planHedefFazNo ?? ""} onChange={(e) => setPlanHedefFazNo(e.target.value ? Number(e.target.value) : null)} className="select" disabled={!selected || !fazlar.length}>{!selected ? <option value="">Önce müşteri seç...</option> : <option value="">Sonraki faz seç...</option>}{fazlar.map((f) => <option key={f.faz_no} value={f.faz_no}>{f.faz_no} - {f.asama_adi}</option>)}</select></label>
            <label className="field-wrap"><span className="field-label">Sonraki Aktivite</span><select value={planAktivite} onChange={(e) => setPlanAktivite(e.target.value as any)} className="select">{AKTIVITELER.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
            <label className="field-wrap"><span className="field-label">Not <span className="muted">(opsiyonel)</span></span><input value={planNot} onChange={(e) => setPlanNot(e.target.value)} className="field" placeholder="örn: Uçtan uca test planlandı" /></label>
          </div>
        ) : null}
      </section>

      {msg ? <div className="message">{msg}</div> : null}
      <div className="actions"><button disabled={busy} onClick={submit} className="primary-btn">{busy ? "Kaydediliyor..." : "Kaydet"}</button></div>
    </main>
  );
}
