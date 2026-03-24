"use client";

import { useEffect, useMemo, useState } from "react";

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
  };
  phaseSummary: Array<{ label: string; value: number }>;
};

const EMPTY_STATS: CrmStats = {
  total: 0, sectors: 0, accounts: 0, kasaFirmasi: 0, entegrasyonYapisi: 0,
  kunyeVar: 0, kunyeEksik: 0, kunyeYok: 0,
  byPhase: [], byOwner: [], bySector: [],
  missingBreakdown: { firma_adi: 0, magaza_veya_franchise: 0, pos_modeli: 0, toplam_pos_adedi: 0 },
};

const EMPTY_SELLER: SellerSummary = {
  sellerOptions: [],
  selectedSeller: "",
  kpi: { total: 0, kunyeTamam: 0, kunyeEksik: 0, kunyeYok: 0, activeCustomers: 0, withPhase: 0, withoutPhase: 0, phaseCoveragePct: 0, kunyeCompletionPct: 0, recentActivityGap: 0 },
  phaseSummary: [],
};

export default function CrmDashboardClient() {
  const [stats, setStats] = useState<CrmStats>(EMPTY_STATS);
  const [sellerData, setSellerData] = useState<SellerSummary>(EMPTY_SELLER);
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [statsLoading, setStatsLoading] = useState(true);
  const [sellerLoading, setSellerLoading] = useState(true);

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
      .then((data) => setSellerData({ ...EMPTY_SELLER, ...data }))
      .catch(() => {})
      .finally(() => setSellerLoading(false));
  }, [selectedSeller]);

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
            <div className="pax-page-sub">Seçerek detay gör</div>
          </div>
          <select
            value={selectedSeller}
            onChange={(e) => setSelectedSeller(e.target.value)}
            className="pax-input"
            style={{ fontSize: 13, marginBottom: 16 }}
          >
            <option value="all">Tüm Satıcılar</option>
            {sellerData.sellerOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

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
              {(sellerData.kpi.withoutPhase > 0 || sellerData.kpi.kunyeEksik + sellerData.kpi.kunyeYok > 0) && (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "var(--radius-md)", padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>Aksiyon Gerekli</div>
                  <div style={{ display: "grid", gap: 5, fontSize: 12, color: "#78716c" }}>
                    {sellerData.kpi.withoutPhase > 0 && <div>• Fazı girilmemiş: <strong>{sellerData.kpi.withoutPhase}</strong> firma</div>}
                    {(sellerData.kpi.kunyeEksik + sellerData.kpi.kunyeYok) > 0 && <div>• Künyesi eksik/yok: <strong>{sellerData.kpi.kunyeEksik + sellerData.kpi.kunyeYok}</strong> firma</div>}
                    {sellerData.kpi.recentActivityGap > 0 && <div>• Yakın aktivite yok: <strong>{sellerData.kpi.recentActivityGap}</strong> firma</div>}
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
