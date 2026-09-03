"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WEEKLY_TARGET_LABELS, achievementPct, type WeeklyTargetCounters } from "@/lib/reports/weekly-targets-shared";

type CrmStats = {
  total: number;
  sectors: number;
  accounts: number;
  kasaFirmasi: number;
  entegrasyonYapisi: number;
  kunyeVar: number;
  kunyeEksik: number;
  kunyeYok: number;
  byPhase: Array<{ label: string; value: number }>;
  byOwner: Array<{ label: string; value: number }>;
  bySector: Array<{ label: string; value: number }>;
  missingBreakdown: {
    firma_adi: number;
    magaza_veya_franchise: number;
    pos_modeli: number;
    toplam_pos_adedi: number;
  };
};

// Takip Listesi kartı — Satışçı Takip Raporu'nun (açık engeller) özeti.
type FollowupRow = {
  customerId: string;
  musteri: string;
  konuKimde: string;
  modelAdetLabel: string;
  takipKonusu: string;
  cozumTarihi: string | null;
  overdue: boolean;
  nearTerm: boolean;
};

type FollowupPayload = {
  summary: {
    openFollowupCount: number;
    totalQuantity: number;
    nearTermQuantity: number;
    nearTermCustomers: string[];
    nearTermLabel: string;
  };
  rows: FollowupRow[];
};

// Hedef kartı — haftalık hedef / gerçekleşme.
type TargetRow = { owner: string; actual: WeeklyTargetCounters; target: WeeklyTargetCounters };
type TargetsPayload = {
  range: { from: string; to: string };
  rows: TargetRow[];
  totals: { actual: WeeklyTargetCounters; target: WeeklyTargetCounters };
};

type SellerSummary = {
  sellerOptions: string[];
  selectedSeller: string;
  kpi: {
    total: number;
    kunyeTamam: number;
    kunyeEksik: number;
    kunyeYok: number;
    activeCustomers: number;
    withPhase: number;
    withoutPhase: number;
    phaseCoveragePct: number;
    kunyeCompletionPct: number;
    recentActivityGap: number;
    /** Sektörü boş kalan kayıt sayısı (eski Banka/Vertical/İş Ortağı → İş Kolu taşıması). */
    sectorMissing: number;
  };
  phaseSummary: Array<{ label: string; value: number }>;
  sectorMissingRows: Array<{ musteri: string; sorumlu: string; sektorOnceki: string }>;
};

const EMPTY_STATS: CrmStats = {
  total: 0, sectors: 0, accounts: 0, kasaFirmasi: 0, entegrasyonYapisi: 0,
  kunyeVar: 0, kunyeEksik: 0, kunyeYok: 0,
  byPhase: [], byOwner: [], bySector: [],
  missingBreakdown: { firma_adi: 0, magaza_veya_franchise: 0, pos_modeli: 0, toplam_pos_adedi: 0 },
};

const EMPTY_FOLLOWUP: FollowupPayload = {
  summary: { openFollowupCount: 0, totalQuantity: 0, nearTermQuantity: 0, nearTermCustomers: [], nearTermLabel: "" },
  rows: [],
};

const EMPTY_COUNTERS: WeeklyTargetCounters = {
  salesPhysical: 0, salesOnline: 0, salesPhone: 0, salesEmail: 0,
  technicalPhysical: 0, technicalOnline: 0, totalActivities: 0, uniqueCustomers: 0,
};

const EMPTY_TARGETS: TargetsPayload = {
  range: { from: "", to: "" },
  rows: [],
  totals: { actual: EMPTY_COUNTERS, target: EMPTY_COUNTERS },
};

const EMPTY_SELLER: SellerSummary = {
  sellerOptions: [],
  selectedSeller: "",
  kpi: { total: 0, kunyeTamam: 0, kunyeEksik: 0, kunyeYok: 0, activeCustomers: 0, withPhase: 0, withoutPhase: 0, phaseCoveragePct: 0, kunyeCompletionPct: 0, recentActivityGap: 0, sectorMissing: 0 },
  phaseSummary: [],
  sectorMissingRows: [],
};

export default function CrmDashboardClient() {
  const [stats, setStats] = useState<CrmStats>(EMPTY_STATS);
  const [sellerData, setSellerData] = useState<SellerSummary>(EMPTY_SELLER);
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [statsLoading, setStatsLoading] = useState(true);
  const [sellerLoading, setSellerLoading] = useState(true);
  const [followup, setFollowup] = useState<FollowupPayload>(EMPTY_FOLLOWUP);
  const [followupLoading, setFollowupLoading] = useState(true);
  const [targets, setTargets] = useState<TargetsPayload>(EMPTY_TARGETS);
  const [targetsLoading, setTargetsLoading] = useState(true);

  // Genel CRM istatistikleri
  useEffect(() => {
    setStatsLoading(true);
    fetch("/api/crm/stats", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : EMPTY_STATS)
      .then(setStats)
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  // Satıcı bazlı veriler — seçim değişince yeniden çek
  useEffect(() => {
    setSellerLoading(true);
    const params = new URLSearchParams();
    if (selectedSeller && selectedSeller !== "all") params.set("seller", selectedSeller);
    fetch(`/api/reports/seller-summary${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : EMPTY_SELLER)
      .then((data) => setSellerData({ ...EMPTY_SELLER, ...data, kpi: { ...EMPTY_SELLER.kpi, ...(data?.kpi ?? {}) } }))
      .catch(() => {})
      .finally(() => setSellerLoading(false));
  }, [selectedSeller]);

  // Takip Listesi — açık engeller (seçilen satıcıya göre filtrelenir)
  useEffect(() => {
    setFollowupLoading(true);
    const params = new URLSearchParams();
    if (selectedSeller && selectedSeller !== "all") params.set("owner", selectedSeller);
    fetch(`/api/reports/seller-followup${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : EMPTY_FOLLOWUP))
      .then((data) => setFollowup({ ...EMPTY_FOLLOWUP, ...data }))
      .catch(() => {})
      .finally(() => setFollowupLoading(false));
  }, [selectedSeller]);

  // Hedef — bu haftanın hedef/gerçekleşme durumu
  useEffect(() => {
    setTargetsLoading(true);
    const params = new URLSearchParams();
    if (selectedSeller && selectedSeller !== "all") params.set("owner", selectedSeller);
    fetch(`/api/reports/weekly-targets${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : EMPTY_TARGETS))
      .then((data) => setTargets({ ...EMPTY_TARGETS, ...data }))
      .catch(() => {})
      .finally(() => setTargetsLoading(false));
  }, [selectedSeller]);

  const targetView = selectedSeller !== "all" && targets.rows.length === 1 ? targets.rows[0] : null;
  const targetActual = targetView ? targetView.actual : targets.totals.actual;
  const targetGoal = targetView ? targetView.target : targets.totals.target;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Hero Header */}
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">CRM Ana Ekran · Yönetim Komuta Merkezi</span>
        <h1 className="pax-hero-title">Büyük resmi, ekipleri ve kişileri aynı akışta gör.</h1>
        <p className="pax-hero-description">
          Bu ekran senin ana yönetim ekranın. Üstte şirketin genel resmi, ortada satıcı katmanı,
          altta faz ve künye dağılımı var.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>Kişi filtresi</span>
          <select
            value={selectedSeller}
            onChange={(e) => setSelectedSeller(e.target.value)}
            className="pax-input"
            style={{ fontSize: 13, maxWidth: 280 }}
            aria-label="Satıcı filtresi"
          >
            <option value="all">Tüm Accountlar</option>
            {sellerData.sellerOptions.filter((name) => name !== 'Tüm Satıcılar').map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, opacity: 0.7 }}>Takip Listesi, Hedef ve Satıcı Özeti bu seçime göre filtrelenir.</span>
        </div>

        <div className="pax-hero-stats">
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Toplam Müşteri</div>
            <div className="pax-hero-stat-value">{statsLoading ? "…" : stats.total}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Künye Tamam</div>
            <div className="pax-hero-stat-value">{statsLoading ? "…" : stats.kunyeVar}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Künye Eksik</div>
            <div className="pax-hero-stat-value">{statsLoading ? "…" : stats.kunyeEksik}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Sorumlu Sayısı</div>
            <div className="pax-hero-stat-value">{statsLoading ? "…" : stats.accounts}</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="pax-grid-4">
        {[
          { label: "Toplam Firma", value: stats.total, sub: "Tüm portföy" },
          { label: "Sektör Çeşitliliği", value: stats.sectors, sub: "Farklı sektör" },
          { label: "Künye Eksik/Yok", value: stats.kunyeEksik + stats.kunyeYok, sub: "Aksiyon gerekli" },
          { label: "Entegrasyon Tipi", value: stats.entegrasyonYapisi, sub: "Farklı yapı" },
        ].map((item) => (
          <div key={item.label} className="pax-card" style={{ textAlign: "center" }}>
            <div className="pax-label" style={{ marginBottom: 12 }}>{item.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
              {statsLoading ? "…" : item.value}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Takip Listesi + Hedef ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }} className="pax-dashboard-followup">
        {/* Takip Listesi */}
        <div className="pax-card">
          <div className="pax-page-header" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div className="pax-page-title" style={{ fontSize: 16 }}>Takip Listesi</div>
              <div className="pax-page-sub">
                Açık engeller · {selectedSeller === "all" ? "tüm portföy" : selectedSeller}
              </div>
            </div>
            <Link
              href="/crm/reports/seller-followup"
              style={{
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
                padding: "6px 12px",
                borderRadius: 10,
                border: "1px solid var(--border, #e5e7eb)",
                color: "var(--text-2, #334155)",
                textDecoration: "none",
              }}
            >
              Tümünü gör →
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Açık Takip", value: followup.summary.openFollowupCount, hint: "engel bekliyor" },
              { label: "Toplam Adet", value: followup.summary.totalQuantity, hint: "forecast adedi" },
              { label: "Yakın Vadeli", value: followup.summary.nearTermQuantity, hint: followup.summary.nearTermLabel || "3 ay içinde" },
            ].map((item) => (
              <div key={item.label} style={{ background: "var(--surface-2, #f8fafc)", borderRadius: "var(--radius-md, 12px)", padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-3, #64748b)", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text, #0f172a)", fontVariantNumeric: "tabular-nums" }}>
                  {followupLoading ? "…" : item.value.toLocaleString("tr-TR")}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-3, #64748b)", marginTop: 2 }}>{item.hint}</div>
              </div>
            ))}
          </div>

          {followupLoading ? (
            <div style={{ fontSize: 13, color: "var(--text-3, #64748b)", padding: "16px 0", textAlign: "center" }}>Yükleniyor…</div>
          ) : followup.rows.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-3, #64748b)", padding: "16px 0", textAlign: "center" }}>
              Açık engel yok — takip listesi boş.
            </div>
          ) : (
            <div className="pax-table-wrap">
              <table className="pax-table">
                <thead>
                  <tr><th>Müşteri</th><th>Konu Kimde</th><th>Model / Adet</th><th>Çözüm</th></tr>
                </thead>
                <tbody>
                  {followup.rows.slice(0, 5).map((row) => (
                    <tr key={row.customerId}>
                      <td style={{ fontWeight: 700 }}>
                        {row.musteri}
                        <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text-3, #64748b)", marginTop: 2 }}>
                          {row.takipKonusu.length > 60 ? `${row.takipKonusu.slice(0, 60)}…` : row.takipKonusu}
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{row.konuKimde}</td>
                      <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{row.modelAdetLabel}</td>
                      <td style={{ fontSize: 12, whiteSpace: "nowrap", color: row.overdue ? "#b91c1c" : row.nearTerm ? "#b45309" : "var(--text-2, #334155)", fontWeight: row.overdue ? 700 : 400 }}>
                        {row.cozumTarihi
                          ? new Date(`${row.cozumTarihi}T00:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "2-digit" })
                          : "—"}
                        {row.overdue ? <div style={{ fontSize: 10 }}>tarih geçti</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {followup.rows.length > 5 ? (
                <div style={{ fontSize: 12, color: "var(--text-3, #64748b)", padding: "10px 0 0", textAlign: "center" }}>
                  {followup.rows.length} kaydın ilk 5&apos;i · kalanı raporda
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Hedef */}
        <div className="pax-card">
          <div className="pax-page-header" style={{ marginBottom: 16 }}>
            <div className="pax-page-title" style={{ fontSize: 16 }}>Hedef</div>
            <div className="pax-page-sub">
              Bu hafta{targets.range.from ? ` · ${targets.range.from.split("-").reverse().join(".")} – ${targets.range.to.split("-").reverse().join(".")}` : ""}
            </div>
          </div>

          {targetsLoading ? (
            <div style={{ fontSize: 13, color: "var(--text-3, #64748b)", padding: "20px 0", textAlign: "center" }}>Yükleniyor…</div>
          ) : !targetGoal.totalActivities && !targetActual.totalActivities ? (
            <div style={{ fontSize: 13, color: "var(--text-3, #64748b)", padding: "20px 0", textAlign: "center" }}>
              Bu hafta için hedef veya aktivite kaydı yok.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {/* Toplam aktivite ilerlemesi */}
              <div style={{ background: "var(--surface-2, #f8fafc)", borderRadius: "var(--radius-md, 12px)", padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-3, #64748b)" }}>Toplam Aktivite</span>
                  <strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
                    {targetActual.totalActivities}
                    {targetGoal.totalActivities ? <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-3, #64748b)" }}> / {targetGoal.totalActivities}</span> : null}
                  </strong>
                </div>
                {targetGoal.totalActivities ? (
                  <div style={{ height: 8, background: "var(--surface, #eef2f7)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min((targetActual.totalActivities / targetGoal.totalActivities) * 100, 100)}%`,
                      background: targetActual.totalActivities >= targetGoal.totalActivities ? "#16a34a" : "var(--accent, #4f46e5)",
                      borderRadius: 999,
                    }} />
                  </div>
                ) : null}
              </div>

              {/* Kanal bazlı hedef/gerçekleşme */}
              <div style={{ display: "grid", gap: 6 }}>
                {WEEKLY_TARGET_LABELS.map(({ key, label }) => {
                  const actual = targetActual[key];
                  const goal = targetGoal[key];
                  const pct = achievementPct(actual, goal);
                  const reached = Boolean(goal) && actual >= goal;
                  return (
                    <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                      <span style={{ color: "var(--text-2, #334155)" }}>{label}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums", color: goal ? (reached ? "#15803d" : "#b45309") : "var(--text-2, #334155)", fontWeight: 700 }}>
                        {actual}{goal ? ` / ${goal}` : ""}
                        {pct != null ? <span style={{ fontWeight: 500, color: "var(--text-3, #64748b)" }}> · %{pct}</span> : null}
                      </span>
                    </div>
                  );
                })}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", fontSize: 12, paddingTop: 6 }}>
                  <span style={{ color: "var(--text-2, #334155)" }}>Tekil Firma</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                    {targetActual.uniqueCustomers}{targetGoal.uniqueCustomers ? ` / ${targetGoal.uniqueCustomers}` : ""}
                  </span>
                </div>
              </div>

              {selectedSeller === "all" && targets.rows.length > 1 ? (
                <div style={{ fontSize: 11, color: "var(--text-3, #64748b)", textAlign: "center", paddingTop: 4 }}>
                  {targets.rows.length} kişinin toplamı · kişi bazlı görmek için yukarıdaki kişi filtresini kullan
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Main 2-col */}
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 24 }}>
        {/* Portföy Özeti */}
        <div className="pax-card">
          <div className="pax-page-header" style={{ marginBottom: 20 }}>
            <div className="pax-page-title" style={{ fontSize: 16 }}>Portföy Özeti</div>
            <div className="pax-page-sub">Künye durumu ve faz dağılımı</div>
          </div>
          <div className="pax-grid-3">
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "var(--radius-lg)", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d", marginBottom: 12 }}>Künye Durumu</div>
              <div style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--text-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tamam</span><strong>{stats.kunyeVar}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Eksik</span><strong>{stats.kunyeEksik}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Yok</span><strong>{stats.kunyeYok}</strong></div>
              </div>
            </div>
            <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: "var(--radius-lg)", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 12 }}>Eksik Alanlar</div>
              <div style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--text-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>POS modeli</span><strong>{stats.missingBreakdown.pos_modeli}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>POS adedi</span><strong>{stats.missingBreakdown.toplam_pos_adedi}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Mağaza/Franchise</span><strong>{stats.missingBreakdown.magaza_veya_franchise}</strong></div>
              </div>
            </div>
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "var(--radius-lg)", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 12 }}>Portföy Yapısı</div>
              <div style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--text-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Sektör sayısı</span><strong>{stats.sectors}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Sorumlu sayısı</span><strong>{stats.accounts}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Kasa firması</span><strong>{stats.kasaFirmasi}</strong></div>
              </div>
            </div>
          </div>

          {stats.byPhase.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", marginBottom: 16 }}>Faz Dağılımı</div>
              <div style={{ display: "grid", gap: 8 }}>
                {stats.byPhase.slice(0, 8).map((item) => {
                  const maxVal = Math.max(...stats.byPhase.slice(0, 8).map((d) => d.value));
                  return (
                    <div key={item.label} style={{ display: "grid", gridTemplateColumns: "110px 1fr 32px", gap: 8, alignItems: "center" }}>
                      <div style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
                      <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(item.value / maxVal) * 100}%`, background: "var(--accent)", borderRadius: 999 }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textAlign: "right" }}>{item.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Satıcı Bazlı */}
        <div className="pax-card">
          <div className="pax-page-header" style={{ marginBottom: 16 }}>
            <div className="pax-page-title" style={{ fontSize: 16 }}>Satıcı Bazlı Özet</div>
            <div className="pax-page-sub">{selectedSeller === "all" ? "Tum accountlar" : selectedSeller}</div>
          </div>
          {sellerLoading ? (
            <div style={{ fontSize: 13, color: "var(--text-3)", padding: "20px 0", textAlign: "center" }}>Yükleniyor…</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Toplam Firma", value: sellerData.kpi.total },
                  { label: "Aktif Firma", value: sellerData.kpi.activeCustomers },
                  { label: "Faz Kapsaması", value: `%${sellerData.kpi.phaseCoveragePct}` },
                  { label: "Künye Tamamlanma", value: `%${sellerData.kpi.kunyeCompletionPct}` },
                ].map((item) => (
                  <div key={item.label} style={{ background: "var(--surface-2)", borderRadius: "var(--radius-md)", padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {(sellerData.kpi.withoutPhase > 0 || sellerData.kpi.kunyeEksik + sellerData.kpi.kunyeYok > 0 || sellerData.kpi.sectorMissing > 0) && (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "var(--radius-md)", padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>Aksiyon Gerekli</div>
                  <div style={{ display: "grid", gap: 5, fontSize: 12, color: "#78716c" }}>
                    {sellerData.kpi.withoutPhase > 0 && <div>• Fazı girilmemiş: <strong>{sellerData.kpi.withoutPhase}</strong> firma</div>}
                    {(sellerData.kpi.kunyeEksik + sellerData.kpi.kunyeYok) > 0 && <div>• Künyesi eksik/yok: <strong>{sellerData.kpi.kunyeEksik + sellerData.kpi.kunyeYok}</strong> firma</div>}
                    {sellerData.kpi.recentActivityGap > 0 && <div>• Yakın aktivite yok: <strong>{sellerData.kpi.recentActivityGap}</strong> firma</div>}
                    {sellerData.kpi.sectorMissing > 0 && (
                      <div>
                        • Sektörü boş kalan: <strong>{sellerData.kpi.sectorMissing}</strong> firma
                        <span style={{ opacity: 0.8 }}> (eski Banka / Vertical / İş Ortağı kaydı — gerçek sektörü sahibi girmeli)</span>
                        {sellerData.sectorMissingRows.length > 0 && (
                          <div style={{ marginTop: 4, paddingLeft: 12, display: "grid", gap: 2 }}>
                            {sellerData.sectorMissingRows.slice(0, 8).map((row) => (
                              <div key={`${row.sorumlu}-${row.musteri}`}>
                                <Link href={`/crm/customers?q=${encodeURIComponent(row.musteri)}`} style={{ color: "#92400e", fontWeight: 700, textDecoration: "underline" }}>{row.musteri}</Link>
                                <span> · {row.sorumlu} · eski: {row.sektorOnceki}</span>
                              </div>
                            ))}
                            {sellerData.sectorMissingRows.length > 8 && <div>… ve {sellerData.sectorMissingRows.length - 8} firma daha</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Satıcı Bazlı Tablo */}
      {stats.byOwner.length > 0 && (
        <div className="pax-card">
          <div className="pax-page-header">
            <div className="pax-page-title">Satıcı Bazlı Firma Dağılımı</div>
            <div className="pax-page-sub">Gerçek veri — vw_crm_musteriler</div>
          </div>
          <div className="pax-table-wrap">
            <table className="pax-table">
              <thead>
                <tr><th>Satıcı</th><th>Firma Sayısı</th><th>Dağılım</th></tr>
              </thead>
              <tbody>
                {stats.byOwner.map((row) => {
                  const maxVal = Math.max(...stats.byOwner.map((d) => d.value));
                  return (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 700 }}>{row.label}</td>
                      <td>{row.value}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
                          <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(row.value / maxVal) * 100}%`, background: "var(--accent)", borderRadius: 999 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", minWidth: 32, textAlign: "right" }}>
                            %{Math.round((row.value / stats.total) * 100)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
