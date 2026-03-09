"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

type Me = { email: string; full_name: string | null; role: string };
type FazRow = { faz_no: number; asama_adi: string };
type ActivityRow = {
  id: string;
  musteri_id: string;
  faz_no: number | null;
  iteration_no: number | null;
  activity_status: string | null;
  activity_label: string | null;
  owner: string | null;
  created_by?: string | null;
  partner_owner: string | null;
  notlar: string | null;
  created_at: string;
  due_date: string | null;
  musteriler: {
    musteri: string;
    sektor: string | null;
    entegrasyon_tipi: string | null;
    risk: string | null;
    sorumlu: string | null;
  } | null;
};

type EditForm = {
  activity_label: string;
  activity_status: string;
  notlar: string;
  partner_owner: string;
  due_date: string;
};

const EMPTY_FILTERS = { q: "", owner: "", faz_no: "", partner_owner: "", from: "", to: "" };
const ACTIVITY_OPTIONS = ["Online Toplantı", "Yerinde Ziyaret", "Telefon", "E-posta", "Diğer"] as const;
const PARTNER_OPTIONS = ["Müşteri", "Müşteri IT", "Müşteri (Finance Owner)", "PAX RS(Support)"] as const;
const STATUS_OPTIONS = ["", "Bekleniyor", "Devam Ediyor", "Tamamlandı", "İhtiyaç Duyulmadı"] as const;

function daysDiff(target: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(target);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortText(value: string | null | undefined, max = 32) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
}

function slaMeta(row: ActivityRow) {
  const status = String(row.activity_status ?? "").trim().toLocaleLowerCase("tr");
  if (!row.due_date || !status || status === "bekleniyor") return { label: "", cls: "sla empty", title: "" };
  if (status === "tamamlandı") return { label: "", cls: "sla circle done", title: "Tamamlandı" };
  const diff = daysDiff(row.due_date);
  if (diff < 0) return { label: `${diff}`, cls: "sla circle overdue", title: `${Math.abs(diff)} gün geçti` };
  return { label: String(diff), cls: "sla circle upcoming", title: diff === 0 ? "Bugün" : `${diff} gün kaldı` };
}

function getInitialForm(row: ActivityRow): EditForm {
  return {
    activity_label: row.activity_label ?? "Diğer",
    activity_status: row.activity_status ?? "",
    notlar: row.notlar ?? "",
    partner_owner: row.partner_owner ?? "",
    due_date: dateInputValue(row.due_date),
  };
}

export default function ActivitiesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [fazlar, setFazlar] = useState<FazRow[]>([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ activity_label: "Diğer", activity_status: "", notlar: "", partner_owner: "", due_date: "" });

  const fazMap = useMemo(() => Object.fromEntries(fazlar.map((f) => [String(f.faz_no), f.asama_adi])), [fazlar]);
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [filters]);

  const load = async () => {
    setMsg(null);
    const [meRes, fazRes, listRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/faz/list", { cache: "force-cache" }),
      fetch(`/api/activities/list?${queryString}`, { cache: "no-store" }),
    ]);
    if (!meRes.ok) {
      location.href = "/login";
      return;
    }
    setMe((await meRes.json()).me);
    const fazJson = await fazRes.json().catch(() => ({}));
    setFazlar((fazJson.fazlar ?? []).sort((a: FazRow, b: FazRow) => a.faz_no - b.faz_no));

    const payload = await listRes.json().catch(() => ({}));
    if (!listRes.ok) {
      setMsg(payload?.message || "Liste alınamadı");
      return;
    }
    setRows(payload.rows ?? []);
  };

  useEffect(() => { void load(); }, [queryString]);

  const ownerOptions = useMemo(() => Array.from(new Set(rows.map((x) => x.owner).filter(Boolean))) as string[], [rows]);

  const markDone = async (row: ActivityRow) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/activities/done", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activity_id: row.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(j?.message || "İşlem başarısız");
        return;
      }
      setEditingRowId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const openRow = (row: ActivityRow) => {
    setOpenRowId((current) => current === row.id ? null : row.id);
    if (editingRowId && editingRowId !== row.id) {
      setEditingRowId(null);
    }
  };

  const startEdit = (row: ActivityRow) => {
    setOpenRowId(row.id);
    setEditingRowId(row.id);
    setEditForm(getInitialForm(row));
  };

  const cancelEdit = () => {
    setEditingRowId(null);
  };

  const saveEdit = async (row: ActivityRow) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/activities/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          activity_id: row.id,
          activity_label: editForm.activity_label,
          activity_status: editForm.activity_status || null,
          notlar: editForm.notlar,
          partner_owner: editForm.partner_owner,
          due_date: editForm.due_date || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(j?.message || "Güncelleme başarısız");
        return;
      }
      setEditingRowId(null);
      await load();
      setOpenRowId(row.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <style jsx>{`
        .page { display: grid; gap: 18px; }
        .hero, .surface { border: 1px solid #d9e4ef; border-radius: 24px; background: linear-gradient(180deg,#fff 0%,#f7fbff 100%); box-shadow: 0 16px 36px rgba(15,23,42,0.05); }
        .hero { padding: 24px 26px; display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
        .title { margin: 0; font-size: clamp(32px,3vw,44px); line-height: 1.02; color: #0f172a; }
        .cta { text-decoration: none; border-radius: 16px; padding: 13px 18px; font-weight: 900; background: linear-gradient(135deg,#0f172a 0%,#1e293b 100%); color: #fff; box-shadow: 0 14px 24px rgba(15,23,42,0.18); }
        .surface { padding: 22px; display: grid; gap: 16px; overflow: hidden; }
        .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .toolbar-title { margin: 0; font-size: 18px; color: #0f172a; }
        .meta { color: #64748b; font-size: 13px; }
        .filters { display: grid; grid-template-columns: repeat(12, minmax(0,1fr)); gap: 14px; align-items: end; }
        .field-wrap { display: grid; gap: 6px; min-width: 0; }
        .field-search { grid-column: span 4; }
        .field-owner, .field-faz, .field-partner, .field-from, .field-to { grid-column: span 2; }
        .field-clear { grid-column: span 2; }
        .field-label { display: block; min-height: 16px; font-size: 12px; line-height: 1.25; font-weight: 900; color: #334155; white-space: nowrap; }
        .input, .select, .textarea { min-height: 46px; border-radius: 14px; border: 1px solid #c7d4e3; padding: 0 14px; background: #fff; color: #0f172a; width: 100%; min-width: 0; }
        .textarea { min-height: 120px; padding: 12px 14px; resize: vertical; }
        .clear-btn { min-height: 46px; width: 100%; align-self: end; border-radius: 14px; border: 1px solid #c7d4e3; background: #fff; font-weight: 900; cursor: pointer; }
        .table-wrap { overflow: auto; border: 1px solid #d9e4ef; border-radius: 18px; background: #fff; }
        table { width: 100%; border-collapse: collapse; min-width: 1320px; }
        th, td { padding: 14px 16px; border-bottom: 1px solid #edf2f7; text-align: left; vertical-align: top; }
        th { font-size: 12px; color: #475569; background: #f8fbff; position: sticky; top: 0; }
        .muted { color: #64748b; font-size: 12px; }
        .empty { padding: 18px; color: #64748b; }
        .phase-pill { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 900; background: #e8f7ef; color: #166534; }
        .sla { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 999px; font-weight: 900; font-size: 12px; line-height: 1; }
        .sla.circle.done { background: #22c55e; color: transparent; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.04); }
        .sla.circle.upcoming { background: #22c55e; color: #ffffff; }
        .sla.circle.overdue { background: #ef4444; color: #ffffff; }
        .sla.empty { width: 36px; height: 36px; background: transparent; color: transparent; }
        .done-btn, .edit-btn, .save-btn, .cancel-btn { min-height: 38px; border-radius: 12px; border: 1px solid #c7d4e3; background: #fff; padding: 0 12px; font-weight: 900; cursor: pointer; }
        .save-btn { border-color: #0f172a; background: #0f172a; color: #fff; }
        .message { color: #b91c1c; background: #fff1f2; border: 1px solid #fecdd3; padding: 12px 14px; border-radius: 14px; }
        .date-btn { appearance: none; border: 0; background: transparent; padding: 0; margin: 0; color: #0f172a; font: inherit; text-align: left; cursor: pointer; font-weight: 700; }
        .date-btn:hover { color: #2563eb; }
        .note-cell { max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .detail-row td { background: #f8fbff; }
        .detail-card { display: grid; gap: 10px; padding: 2px 0; }
        .detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
        .detail-box { border: 1px solid #dbe7f3; border-radius: 14px; background: #fff; padding: 12px; }
        .detail-label { display: block; font-size: 11px; font-weight: 900; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .02em; }
        .detail-value { color: #0f172a; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .detail-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
        @media (max-width: 1240px) {
          .filters { grid-template-columns: repeat(6, minmax(0,1fr)); }
          .field-search { grid-column: span 3; }
          .field-owner, .field-faz, .field-partner, .field-from, .field-to, .field-clear { grid-column: span 2; }
        }
        @media (max-width: 1080px) {
          .filters, .detail-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .field-search, .field-owner, .field-faz, .field-partner, .field-from, .field-to, .field-clear { grid-column: span 1; }
        }
        @media (max-width: 720px) {
          .hero, .surface { padding: 16px; }
          .filters, .detail-grid { grid-template-columns: 1fr; }
          .field-search, .field-owner, .field-faz, .field-partner, .field-from, .field-to, .field-clear { grid-column: span 1; }
          .field-label { white-space: normal; }
          .toolbar { align-items: stretch; }
          .cta, .clear-btn, .done-btn, .edit-btn, .save-btn, .cancel-btn { width: 100%; text-align: center; }
          table { min-width: 1100px; }
          .detail-actions { justify-content: stretch; }
        }
      `}</style>

      <section className="hero">
        <div>
          <h1 className="title">Aktiviteler</h1>
        </div>
        <Link href="/crm/activities/new" className="cta">+ Aktivite Gir</Link>
      </section>

      <section className="surface">
        <div className="toolbar">
          <h2 className="toolbar-title">Tüm Aktiviteler</h2>
          <div className="meta">{["super_admin", "admin"].includes(me?.role ?? "") ? "Tüm kayıtlar" : "Kendi kayıtların"}</div>
        </div>

        <div className="filters">
          <label className="field-wrap field-search"><span className="field-label">Arama</span><input className="input" value={filters.q} onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))} placeholder="Müşteri / aktivite / not / ekleyen" /></label>
          <label className="field-wrap field-owner"><span className="field-label">Ekleyen</span><select className="select" value={filters.owner} onChange={(e) => setFilters((s) => ({ ...s, owner: e.target.value }))}><option value="">Tümü</option>{ownerOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          <label className="field-wrap field-faz"><span className="field-label">Faz No</span><input className="input" value={filters.faz_no} onChange={(e) => setFilters((s) => ({ ...s, faz_no: e.target.value }))} placeholder="örn: 9" /></label>
          <label className="field-wrap field-partner"><span className="field-label">Bekleyen Taraf</span><select className="select" value={filters.partner_owner} onChange={(e) => setFilters((s) => ({ ...s, partner_owner: e.target.value }))}><option value="">Tümü</option><option value="Müşteri">Müşteri</option><option value="Müşteri IT">Müşteri IT</option><option value="Müşteri (Finance Owner)">Müşteri (Finance Owner)</option><option value="PAX RS(Support)">PAX RS(Support)</option></select></label>
          <label className="field-wrap field-from"><span className="field-label">Başlangıç Tarihi</span><input className="input" type="date" value={filters.from} onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))} /></label>
          <label className="field-wrap field-to"><span className="field-label">Bitiş Tarihi</span><input className="input" type="date" value={filters.to} onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))} /></label>
          <div className="field-wrap field-clear"><span className="field-label">&nbsp;</span><button type="button" className="clear-btn" onClick={() => setFilters(EMPTY_FILTERS)}>Filtreleri Temizle</button></div>
        </div>

        {msg ? <div className="message">{msg}</div> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Hedef Tarih</th>
                <th>Müşteri</th>
                <th>Faz</th>
                <th>Aktivite</th>
                <th>Not</th>
                <th>Bekleyen</th>
                <th>Ekleyen</th>
                <th>Risk</th>
                <th>SLA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const phaseName = row.faz_no != null ? fazMap[String(row.faz_no)] : "";
                const sla = slaMeta(row);
                const isOpen = openRowId === row.id;
                const isEditing = editingRowId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr>
                      <td>
                        <button type="button" className="date-btn" onClick={() => openRow(row)}>
                          {formatDateLabel(row.created_at)}
                        </button>
                      </td>
                      <td>{formatDate(row.due_date)}</td>
                      <td>{row.musteriler?.musteri ?? "-"}</td>
                      <td><span className="phase-pill">{row.faz_no ?? "-"}{phaseName ? ` · ${phaseName}` : ""}</span></td>
                      <td>{row.activity_label ?? "-"}</td>
                      <td className="note-cell" title={row.notlar ?? ""}>{shortText(row.notlar, 38)}</td>
                      <td>{row.partner_owner ?? ""}</td>
                      <td>{row.owner ?? "-"}</td>
                      <td>{row.musteriler?.risk ?? "-"}</td>
                      <td><span className={sla.cls} title={sla.title}>{sla.label}</span></td>
                      <td>{row.due_date && row.activity_status !== "Tamamlandı" ? <button disabled={busy} className="done-btn" onClick={() => markDone(row)}>Tamamlandı</button> : null}</td>
                    </tr>
                    {isOpen ? (
                      <tr className="detail-row">
                        <td colSpan={11}>
                          {isEditing ? (
                            <div className="detail-card">
                              <div className="detail-grid">
                                <label className="detail-box"><span className="detail-label">Tarih</span><div className="detail-value">{formatDateLabel(row.created_at)}</div></label>
                                <label className="detail-box"><span className="detail-label">Hedef Tarih</span><input className="input" type="date" value={editForm.due_date} onChange={(e) => setEditForm((s) => ({ ...s, due_date: e.target.value }))} /></label>
                                <label className="detail-box"><span className="detail-label">Aktivite</span><select className="select" value={editForm.activity_label} onChange={(e) => setEditForm((s) => ({ ...s, activity_label: e.target.value }))}>{ACTIVITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                                <label className="detail-box"><span className="detail-label">Aktivite Durumu</span><select className="select" value={editForm.activity_status} onChange={(e) => setEditForm((s) => ({ ...s, activity_status: e.target.value }))}>{STATUS_OPTIONS.map((item) => <option key={item || "empty"} value={item}>{item || "Boş"}</option>)}</select></label>
                                <label className="detail-box"><span className="detail-label">Bekleyen Taraf</span><select className="select" value={editForm.partner_owner} onChange={(e) => setEditForm((s) => ({ ...s, partner_owner: e.target.value }))}><option value="">Seç...</option>{PARTNER_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                              </div>
                              <label className="detail-box"><span className="detail-label">Not</span><textarea className="textarea" value={editForm.notlar} onChange={(e) => setEditForm((s) => ({ ...s, notlar: e.target.value }))} /></label>
                              <div className="detail-actions">
                                <button type="button" className="cancel-btn" disabled={busy} onClick={cancelEdit}>İptal</button>
                                <button type="button" className="save-btn" disabled={busy} onClick={() => saveEdit(row)}>{busy ? "Kaydediliyor..." : "Kaydet"}</button>
                              </div>
                            </div>
                          ) : (
                            <div className="detail-card">
                              <div className="detail-grid">
                                <div className="detail-box"><span className="detail-label">Tarih</span><div className="detail-value">{formatDateLabel(row.created_at)}</div></div>
                                <div className="detail-box"><span className="detail-label">Hedef Tarih</span><div className="detail-value">{formatDate(row.due_date)}</div></div>
                                <div className="detail-box"><span className="detail-label">Aktivite</span><div className="detail-value">{row.activity_label ?? "-"}</div></div>
                                <div className="detail-box"><span className="detail-label">Aktivite Durumu</span><div className="detail-value">{row.activity_status?.trim() ? row.activity_status : "-"}</div></div>
                                <div className="detail-box"><span className="detail-label">Bekleyen Taraf</span><div className="detail-value">{row.partner_owner ?? ""}</div></div>
                              </div>
                              <div className="detail-box">
                                <span className="detail-label">Not</span>
                                <div className="detail-value">{row.notlar?.trim() ? row.notlar : "-"}</div>
                              </div>
                              <div className="detail-actions">
                                <button type="button" className="edit-btn" disabled={busy} onClick={() => startEdit(row)}>Düzenle</button>
                                {row.due_date && row.activity_status !== "Tamamlandı" ? <button type="button" className="done-btn" disabled={busy} onClick={() => markDone(row)}>Tamamlandı</button> : null}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {rows.length === 0 ? <tr><td colSpan={11} className="empty">Kayıt yok.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
