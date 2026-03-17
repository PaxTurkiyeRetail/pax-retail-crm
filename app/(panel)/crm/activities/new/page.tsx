"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type CrmRow = {
  musteri_id: string;
  musteri: string;
  sektor: string | null;
  entegrasyon_tipi: string | null;
  satis_olasiligi: string | null;
  sorumlu: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  pipeline_durum: string | null;
};

type FazRow = { faz_no: number; asama_adi: string };
type Me = { email: string; full_name: string | null; role: string };
type RecentRow = {
  musteri_id?: string | null;
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

const AKTIVITELER = ["Online Toplantı", "Yerinde Ziyaret", "Telefon", "E-posta", "Teknik Ziyaret", "Teknik Online", "Diğer"] as const;
const FAZ_DURUM_OPTIONS = [
  { label: "Devam ediyor", value: "Devam Ediyor" },
  { label: "Tamamlandı", value: "Tamamlandı" },
  { label: "İhtiyaç duyulmadı", value: "İhtiyaç Duyulmadı" },
  { label: "Başlamadı", value: "Başlamadı" },
] as const;
const BEKLEYEN_TARAFLAR = ["Müşteri", "Müşteri IT", "Müşteri (Finance Owner)", "PAX RS(Support)"] as const;

function normalizeSearchText(value: string) {
  return String(value ?? "")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[I]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function NewActivityPage() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [customers, setCustomers] = useState<CrmRow[]>([]);
  const [searchResults, setSearchResults] = useState<CrmRow[]>([]);
  const [customerBusy, setCustomerBusy] = useState(false);
  const [fazlar, setFazlar] = useState<FazRow[]>([]);
  const [recentRows, setRecentRows] = useState<RecentRow[]>([]);

  const [musteriId, setMusteriId] = useState("");
  const [musteriQuery, setMusteriQuery] = useState("");
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const customerBoxRef = useRef<HTMLDivElement | null>(null);
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const customerPool = useMemo(() => {
    const map = new Map<string, CrmRow>();
    for (const row of [...customers, ...searchResults]) {
      if (!row?.musteri_id) continue;
      if (!map.has(row.musteri_id)) map.set(row.musteri_id, row);
    }
    return Array.from(map.values());
  }, [customers, searchResults]);
  const selected = useMemo(() => customerPool.find((c) => c.musteri_id === musteriId) ?? null, [customerPool, musteriId]);
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
  const [editActivityId, setEditActivityId] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [phaseMetaBusy, setPhaseMetaBusy] = useState(false);
  const [recentBusy, setRecentBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const lastKnownFazNo = useMemo(() => {
    if (selected?.aktif_faz_no != null) return selected.aktif_faz_no;
    for (const row of recentRows) {
      if (row?.faz_no != null) return row.faz_no;
    }
    return null;
  }, [selected?.aktif_faz_no, recentRows]);
  const currentFazLabel = useMemo(() => {
    if (!selected) return '-';
    const fazNoValue = lastKnownFazNo;
    const fazAdi = (fazNoValue != null ? fazMap[String(fazNoValue)] : null) ?? selected.aktif_faz_adi ?? null;
    return `${fazNoValue ?? '-'}${fazAdi ? ` / ${fazAdi}` : ''}`;
  }, [selected, lastKnownFazNo, fazMap]);
  const isEditMode = Boolean(editActivityId);

  const filteredCustomers = useMemo(() => {
    const q = normalizeSearchText(musteriQuery);
    const pool = q ? searchResults : customers;
    if (!q) return pool.slice(0, 12);

    const scoreOf = (row: CrmRow) => {
      const name = normalizeSearchText(row.musteri);
      if (!name) return 999;
      if (name === q) return 0;
      if (name.startsWith(q)) return 1;
      if (name.split(" ").some((part) => part.startsWith(q))) return 2;
      if (name.includes(q)) return 3;
      return 999;
    };

    return [...pool]
      .map((row) => ({ row, score: scoreOf(row) }))
      .filter((item) => item.score < 999)
      .sort((a, b) => a.score - b.score || a.row.musteri.localeCompare(b.row.musteri, "tr"))
      .map((item) => item.row)
      .slice(0, 20);
  }, [customers, musteriQuery, searchResults]);

  const load = async () => {
    setMsg(null);
    const [meRes, cRes, fRes] = await Promise.all([fetch("/api/me"), fetch("/api/crm/list?lite=1"), fetch("/api/faz/list")]);
    if (!meRes.ok) {
      location.href = "/login";
      return;
    }
    setMe((await meRes.json()).me);
    const cj = await cRes.json().catch(() => ({}));
    if (cRes.ok) {
      setCustomers(cj.rows ?? []);
      setSearchResults(cj.rows ?? []);
    }
    const fj = await fRes.json().catch(() => ({}));
    if (fRes.ok) setFazlar((fj.fazlar ?? []).sort((a: FazRow, b: FazRow) => a.faz_no - b.faz_no));
    if (!fRes.ok) setMsg(fj?.message || "Faz listesi alınamadı.");
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const q = musteriQuery.trim();
    if (!customerMenuOpen && !q) return;

    let ignore = false;
    const controller = new AbortController();
    const loadCustomers = async () => {
      setCustomerBusy(true);
      try {
        const params = new URLSearchParams({ lite: "1", pageSize: "20" });
        if (q) params.set("q", q);
        const res = await fetch(`/api/crm/list?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || ignore) return;
        setSearchResults(j.rows ?? []);
      } catch (error: any) {
        if (error?.name !== "AbortError" && !ignore) setSearchResults([]);
      } finally {
        if (!ignore) setCustomerBusy(false);
      }
    };

    const timer = window.setTimeout(loadCustomers, q ? 180 : 0);
    return () => {
      ignore = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [musteriQuery, customerMenuOpen]);

  useEffect(() => {
    if (!customerMenuOpen) return;
    const previous = document.body.style.overflow;
    if (window.innerWidth <= 768) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [customerMenuOpen]);

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
    if (editActivityId) return;
    const current = lastKnownFazNo ?? null;
    setFazNo(current);
    setPlanEnabled(false);
    setPlanTarih("");
    setPlanNot("");
    setBekleyenTaraf("");
    setPlanAktivite("Online Toplantı");
    setPlanHedefFazNo(current);
    setFazDurum("Devam Ediyor");
    setNotlar("");
  }, [selected?.musteri_id, lastKnownFazNo, editActivityId]);

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
    const editId = (searchParams.get("edit") ?? "").trim();
    if (!editId) return;
    let ignore = false;
    const loadDetail = async () => {
      setEditLoading(true);
      try {
        const res = await fetch(`/api/activities/detail?activity_id=${editId}`, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || ignore) {
          if (!ignore && j?.message) setMsg(j.message);
          return;
        }
        setEditActivityId(j.row.id ?? editId);
        if (j.row.musteri_id) setMusteriId(j.row.musteri_id);
        if (j.row.activity_label && AKTIVITELER.includes(j.row.activity_label)) setKanal(j.row.activity_label as any);
        setNotlar(j.row.notlar ?? "");
        if (j.row.faz_no != null) setFazNo(j.row.faz_no);
        if (j.row.activity_status && FAZ_DURUM_OPTIONS.some((o) => o.value === j.row.activity_status)) setFazDurum(j.row.activity_status as any);
        if (j.row.partner_owner && BEKLEYEN_TARAFLAR.includes(j.row.partner_owner)) setBekleyenTaraf(j.row.partner_owner as any);
      } finally {
        if (!ignore) setEditLoading(false);
      }
    };
    loadDetail();
    return () => { ignore = true; };
  }, [searchParams]);

  useEffect(() => {
    const loadRecent = async () => {
      if (!musteriId) {
        setRecentRows([]);
        setHistoryOpen(false);
        return;
      }
      setRecentBusy(true);
      setHistoryOpen(false);
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

  useEffect(() => {
    if (!selected || editActivityId) return;
    if (fazNo != null) return;
    if (lastKnownFazNo == null) return;
    setFazNo(lastKnownFazNo);
    setPlanHedefFazNo(lastKnownFazNo);
  }, [selected?.musteri_id, fazNo, lastKnownFazNo, editActivityId]);

  const chooseCustomer = (customer: CrmRow) => {
    setEditActivityId("");
    setMusteriId(customer.musteri_id);
    setMusteriQuery(customer.musteri);
    setSearchResults([customer]);
    setCustomerMenuOpen(false);
  };

  const clearCustomer = () => {
    setEditActivityId("");
    setMusteriId("");
    setMusteriQuery("");
    setCustomerMenuOpen(true);
    setSearchResults(customers.slice(0, 12));
    setFazNo(null);
    setPlanHedefFazNo(null);
    setRecentRows([]);
    window.setTimeout(() => customerInputRef.current?.focus(), 0);
  };

  const startEditFromRow = (row: RecentRow) => {
    setEditActivityId(row.id);
    if (row.musteri_id) setMusteriId(row.musteri_id);
    if (row.faz_no != null) setFazNo(row.faz_no);
    if (row.durum && FAZ_DURUM_OPTIONS.some((o) => o.value === row.durum)) setFazDurum(row.durum as any);
    if (row.partner_owner && BEKLEYEN_TARAFLAR.includes(row.partner_owner as any)) setBekleyenTaraf(row.partner_owner as any);
    if (row.aksiyon && AKTIVITELER.includes(row.aksiyon as any)) setKanal(row.aksiyon as any);
    setNotlar(row.notlar ?? "");
    setPlanEnabled(false);
    setPlanTarih("");
    setPlanNot("");
    setHistoryOpen(false);
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
        body: JSON.stringify({ activity_id: editActivityId || null, musteri_id: musteriId, kanal, notlar: notlar.trim() || null, faz_no: fazNo, faz_durum: fazDurum, bekleyen_taraf: bekleyenTaraf || null, plan }),
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
        .customer-menu-hint { padding: 12px 16px 0; font-size: 12px; color: #64748b; }
        .customer-backdrop { display: none; }
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
        @media (max-width: 768px) { .surface { padding: 16px; border-radius: 20px; } .title { font-size: 28px; } .search-input, .field, .select, .textarea { min-height: 52px; font-size: 16px; } .customer-backdrop { display: block; position: fixed; inset: 0; background: rgba(15,23,42,0.28); z-index: 29; } .customer-menu { position: fixed; left: 12px; right: 12px; bottom: 12px; top: auto; max-height: min(70vh, 560px); border-radius: 22px; z-index: 30; padding-bottom: env(safe-area-inset-bottom); } .customer-search { position: static; } .customer-option { padding: 16px; } }
      `}</style>

      <div className="header">
        <h1 className="title">{isEditMode ? "Aktivite Düzenle" : "Aktivite Gir"}</h1>
        <Link href="/crm/activities" className="back">Geri dön</Link>
      </div>

      <section className="surface">
        <div className="field-wrap" ref={customerBoxRef}>
          <div className="field-label">Müşteri</div>
          {selected ? (
            <div className="selected-customer">
              <div className="selected-main">
                <div className="selected-title">{selected.musteri}</div>
                <div className="customer-meta">Mevcut faz: {currentFazLabel}</div>
                {selected.sorumlu ? <div className="customer-meta">Sorumlu: {selected.sorumlu}</div> : null}
                {phaseMetaBusy || editLoading ? <div className="customer-meta">Faz bilgisi yükleniyor…</div> : null}
              </div>
              <button type="button" className="secondary-btn" onClick={clearCustomer}>Değiştir</button>
            </div>
          ) : (
            <div className="customer-search">
              {customerMenuOpen ? <button type="button" className="customer-backdrop" aria-label="Müşteri aramayı kapat" onClick={() => setCustomerMenuOpen(false)} /> : null}
              <input ref={customerInputRef} className="search-input" value={musteriQuery} onFocus={() => setCustomerMenuOpen(true)} onChange={(e) => { setMusteriQuery(e.target.value); setCustomerMenuOpen(true); if (musteriId) setMusteriId(""); }} placeholder="Müşteri adıyla ara..." autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} />
              <button type="button" className="search-toggle" onClick={() => setCustomerMenuOpen((v) => !v)}>▾</button>
              {customerMenuOpen ? (
                <div className="customer-menu">
                  <div className="customer-menu-hint">Büyük-küçük harf fark etmez. Türkçe karakter olmadan da arayabilirsin.</div>
                  {customerBusy ? <div className="empty">Müşteriler aranıyor...</div> : null}
                  {!customerBusy && filteredCustomers.length ? filteredCustomers.map((c) => (
                    <button key={c.musteri_id} type="button" className="customer-option" onClick={() => chooseCustomer(c)}>
                      <span className="customer-name">{c.musteri}</span>
                      <span className="customer-meta">{c.aktif_faz_no ?? "-"}{c.aktif_faz_adi ? ` - ${c.aktif_faz_adi}` : ""}</span>
                    </button>
                  )) : null}
                  {!customerBusy && !filteredCustomers.length ? <div className="empty">Sonuç bulunamadı.</div> : null}
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
              <span>Geçmiş Aktiviteler <span className="history-count">({recentRows.length} kayıt)</span></span>
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
                          <td><button type="button" className="use-btn secondary-btn" onClick={() => startEditFromRow(row)}>Düzenle</button></td>
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
              {fazlar.map((f) => <option key={f.faz_no} value={f.faz_no}>{f.faz_no} - {f.asama_adi}{lastKnownFazNo === f.faz_no ? " (Son Faz)" : ""}</option>)}
            </select>
            <span className="field-help">İşlem hangi faz için yapılıyorsa o fazı seç. Geçmiş aktivite düzenleme modunda kayıt güncellenir, tekrar eklenmez.</span>
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

      {isEditMode ? <div className="muted">Düzenleme modundasın. Kaydet dediğinde seçilen geçmiş aktivite güncellenir; Sonraki Aktivite açıksa sadece yeni sonraki aktivite açılır.</div> : null}
      {msg ? <div className="message">{msg}</div> : null}
      <div className="actions"><button disabled={busy || editLoading} onClick={submit} className="primary-btn">{busy ? "Kaydediliyor..." : isEditMode ? "Güncelle" : "Kaydet"}</button></div>
    </main>
  );
}
