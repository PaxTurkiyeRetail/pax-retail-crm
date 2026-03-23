"use client";

import { useMemo, useState } from "react";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  team: string;
  customers: number;
  opportunities: number;
  proposals: number;
  weeklyActivities: number;
  replyRate: number;
  avgReplyHours: number;
  riskCount: number;
  targetProgress: number;
  focus: string;
};

const members: TeamMember[] = [
  { id: "omer", name: "Ömer Canatar", role: "Key Account Manager", team: "Satış", customers: 26, opportunities: 14, proposals: 8, weeklyActivities: 23, replyRate: 71, avgReplyHours: 8, riskCount: 3, targetProgress: 64, focus: "Yeni müşteri kazanım" },
  { id: "furkan", name: "Furkan Kızılkurt", role: "Technical Account Manager", team: "Satış & Teknik", customers: 18, opportunities: 11, proposals: 6, weeklyActivities: 19, replyRate: 76, avgReplyHours: 7, riskCount: 2, targetProgress: 58, focus: "Pilot ve geçiş yönetimi" },
  { id: "mete", name: "Mete Özdemir", role: "Marketing", team: "Pazarlama", customers: 0, opportunities: 0, proposals: 0, weeklyActivities: 16, replyRate: 82, avgReplyHours: 6, riskCount: 1, targetProgress: 61, focus: "Talep üretimi ve görünürlük" },
  { id: "eda", name: "Eda Kılıç", role: "PMO & AI Automation", team: "PMO", customers: 0, opportunities: 0, proposals: 0, weeklyActivities: 28, replyRate: 88, avgReplyHours: 5, riskCount: 1, targetProgress: 73, focus: "Takip ritmi ve otomasyon" },
];

const weeklyFlow = [
  { day: "Pzt", value: 24 },
  { day: "Sal", value: 31 },
  { day: "Çar", value: 18 },
  { day: "Per", value: 27 },
  { day: "Cum", value: 22 },
  { day: "Cmt", value: 7 },
  { day: "Paz", value: 3 },
];

export default function CrmDashboardClient() {
  const [selected, setSelected] = useState<string>("all");

  const totals = useMemo(() => {
    return members.reduce(
      (acc, member) => {
        acc.customers += member.customers;
        acc.opportunities += member.opportunities;
        acc.proposals += member.proposals;
        acc.activities += member.weeklyActivities;
        acc.risks += member.riskCount;
        return acc;
      },
      { customers: 0, opportunities: 0, proposals: 0, activities: 0, risks: 0 },
    );
  }, []);

  const selectedMember = members.find((member) => member.id === selected) ?? null;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Hero Header - Standart */}
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">CRM Ana Ekran · Yönetim Komuta Merkezi</span>
        <h1 className="pax-hero-title">
          Büyük resmi, ekipleri ve kişileri aynı akışta gör.
        </h1>
        <p className="pax-hero-description">
          Bu ekran senin ana yönetim ekranın. Üstte şirketin genel resmi, ortada ekip katmanı, 
          altta kişi bazlı kokpit özeti var.
        </p>

        <div className="pax-hero-stats">
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Toplam Müşteri</div>
            <div className="pax-hero-stat-value">{totals.customers}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Açık Fırsat</div>
            <div className="pax-hero-stat-value">{totals.opportunities}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Aktif Teklif</div>
            <div className="pax-hero-stat-value">{totals.proposals}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Riskli Başlık</div>
            <div className="pax-hero-stat-value">{totals.risks}</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="pax-grid-4">
        <div className="pax-card" style={{ textAlign: 'center' }}>
          <div className="pax-label" style={{ marginBottom: 12 }}>Fırsat Havuzu</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            {totals.opportunities}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Yeni kazanım odağı</div>
        </div>
        <div className="pax-card" style={{ textAlign: 'center' }}>
          <div className="pax-label" style={{ marginBottom: 12 }}>Canlı Portföy</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            {totals.customers}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Elde tutma + büyütme</div>
        </div>
        <div className="pax-card" style={{ textAlign: 'center' }}>
          <div className="pax-label" style={{ marginBottom: 12 }}>Haftalık Aktivite</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            {totals.activities}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Ekip toplam aksiyon</div>
        </div>
        <div className="pax-card" style={{ textAlign: 'center' }}>
          <div className="pax-label" style={{ marginBottom: 12 }}>Aktif Teklif</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            {totals.proposals}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Takip disiplini gerekli</div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 24 }}>
        {/* Yönetim Özeti */}
        <div className="pax-card">
          <div className="pax-page-header" style={{ marginBottom: 20 }}>
            <div className="pax-page-title" style={{ fontSize: 16 }}>Yönetim Özeti</div>
            <div className="pax-page-sub">Satış, müşteri ve aksiyon görünümü</div>
          </div>
          
          <div className="pax-grid-3">
            <div style={{ 
              background: '#f0fdf4', 
              border: '1px solid #86efac', 
              borderRadius: 'var(--radius-lg)', 
              padding: 16 
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 12 }}>
                Kazanım Tarafı
              </div>
              <div style={{ display: 'grid', gap: 12, fontSize: 13, color: 'var(--text-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Yeni fırsat</span><strong>9</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pilotta</span><strong>5</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Teklif bekleyen</span><strong>6</strong>
                </div>
              </div>
            </div>

            <div style={{ 
              background: '#eff6ff', 
              border: '1px solid #93c5fd', 
              borderRadius: 'var(--radius-lg)', 
              padding: 16 
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>
                Müşteri Portföyü
              </div>
              <div style={{ display: 'grid', gap: 12, fontSize: 13, color: 'var(--text-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Gelişen</span><strong>8</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Riskli</span><strong>4</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pasif</span><strong>3</strong>
                </div>
              </div>
            </div>

            <div style={{ 
              background: '#fffbeb', 
              border: '1px solid #fcd34d', 
              borderRadius: 'var(--radius-lg)', 
              padding: 16 
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
                Haftalık Ritim
              </div>
              <div style={{ display: 'grid', gap: 12, fontSize: 13, color: 'var(--text-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Toplam aktivite</span><strong>{totals.activities}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Teklif takibi</span><strong>{totals.proposals}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kritik başlık</span><strong>{totals.risks}</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 16 }}>
              Haftalık Aktivite Akışı
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 140 }}>
              {weeklyFlow.map((item) => {
                const maxVal = Math.max(...weeklyFlow.map(d => d.value));
                const heightPct = (item.value / maxVal) * 100;
                return (
                  <div key={item.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                    <div style={{ 
                      height: `${heightPct}%`,
                      width: '100%',
                      background: 'var(--accent)',
                      borderRadius: 'var(--radius-sm)',
                      minHeight: 12,
                      transition: 'all 200ms'
                    }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
                      {item.day}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Kişi Seçimi */}
        <div className="pax-card">
          <div className="pax-page-header" style={{ marginBottom: 20 }}>
            <div className="pax-page-title" style={{ fontSize: 16 }}>Kişi Seçimi</div>
            <div className="pax-page-sub">Kişisel ekranları izle</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setSelected("all")}
              className={`pax-btn ${selected === "all" ? 'pax-btn-primary' : 'pax-btn-secondary'}`}
              style={{ fontSize: 12 }}
            >
              Tümü
            </button>
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelected(member.id)}
                className={`pax-btn ${selected === member.id ? 'pax-btn-primary' : 'pax-btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                {member.name.split(" ")[0]}
              </button>
            ))}
          </div>

          <div style={{ 
            background: 'var(--surface-2)', 
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            fontSize: 12,
            color: 'var(--text-3)',
            lineHeight: 1.5
          }}>
            Bu blok şu an UI-first demo mantığıyla çalışır. Gerçek kullanıcı hesabı, teklif, müşteri, aktivite ve mail verileri backend bağlandığında kullanıcı bazlı gerçek verilerle beslenecek.
          </div>
        </div>
      </div>

      {/* Kişi Bazlı Detay */}
      <div className="pax-card">
        <div className="pax-page-header">
          <div className="pax-page-title">
            {selectedMember ? `${selectedMember.name} · Kişisel Ana Ekran Özeti` : "Kişi Bazlı Genel Görünüm"}
          </div>
          <div className="pax-page-sub">
            {selectedMember ? `${selectedMember.role} · ${selectedMember.team}` : "Tüm ekip üyelerinin kişisel göstergeleri"}
          </div>
        </div>

        {selectedMember ? (
          <div style={{ display: 'grid', gap: 20 }}>
            {/* Odak Alanı */}
            <div style={{ 
              background: '#eef2ff', 
              border: '1px solid #c7d2fe',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              fontSize: 13,
              color: 'var(--text-2)'
            }}>
              <strong style={{ color: 'var(--text)' }}>Odak alanı:</strong> {selectedMember.focus}
            </div>

            {/* Stats */}
            <div className="pax-grid-4">
              <div className="pax-card" style={{ textAlign: 'center', padding: 16 }}>
                <div className="pax-label" style={{ marginBottom: 8 }}>Müşteri</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                  {selectedMember.customers}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Sorumlu portföy</div>
              </div>
              <div className="pax-card" style={{ textAlign: 'center', padding: 16 }}>
                <div className="pax-label" style={{ marginBottom: 8 }}>Fırsat</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                  {selectedMember.opportunities}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Açık iş hacmi</div>
              </div>
              <div className="pax-card" style={{ textAlign: 'center', padding: 16 }}>
                <div className="pax-label" style={{ marginBottom: 8 }}>Teklif</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                  {selectedMember.proposals}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Aktif ticari dosya</div>
              </div>
              <div className="pax-card" style={{ textAlign: 'center', padding: 16 }}>
                <div className="pax-label" style={{ marginBottom: 8 }}>Risk</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                  {selectedMember.riskCount}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Öncelik isteyen başlık</div>
              </div>
            </div>

            {/* Hedef & İletişim */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="pax-card" style={{ padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
                  Hedef & Gerçekleşen
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-2)' }}>Hedef ilerleme</span>
                    <strong style={{ color: 'var(--text)' }}>{selectedMember.targetProgress}%</strong>
                  </div>
                  <div style={{ 
                    height: 8, 
                    background: 'var(--surface-2)', 
                    borderRadius: 999,
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      height: '100%',
                      width: `${selectedMember.targetProgress}%`,
                      background: '#10b981',
                      borderRadius: 999,
                      transition: 'width 300ms'
                    }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Haftalık aktivite</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      {selectedMember.weeklyActivities}
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Ort. cevap süresi</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      {selectedMember.avgReplyHours} sa
                    </div>
                  </div>
                </div>
              </div>

              <div className="pax-card" style={{ padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
                  Mail & İletişim Analitiği
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Cevaplanma oranı</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      %{selectedMember.replyRate}
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Ortalama cevap</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      {selectedMember.avgReplyHours} sa
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Takip yoğunluğu</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      {Math.max(3, selectedMember.proposals + 2)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Cevapsız başlık</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                      {Math.max(1, selectedMember.riskCount)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Riskler & AI */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ 
                background: '#fffbeb', 
                border: '1px solid #fcd34d',
                borderRadius: 'var(--radius-lg)',
                padding: 20
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 16 }}>
                  Benim Risklerim
                </div>
                <ul style={{ display: 'grid', gap: 12, fontSize: 13, color: '#78716c', listStyle: 'none' }}>
                  <li>• 7 gündür temas bekleyen {Math.max(1, selectedMember.riskCount)} müşteri</li>
                  <li>• Follow-up gerektiren {Math.max(2, selectedMember.proposals)} teklif</li>
                  <li>• Öncelik verilmesi gereken 1 kritik müşteri başlığı</li>
                </ul>
              </div>

              <div style={{ 
                background: '#eff6ff', 
                border: '1px solid #93c5fd',
                borderRadius: 'var(--radius-lg)',
                padding: 20
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 16 }}>
                  AI Destek Katmanı
                </div>
                <ul style={{ display: 'grid', gap: 12, fontSize: 13, color: '#64748b', listStyle: 'none' }}>
                  <li>• Follow-up Agent</li>
                  <li>• Teklif Hazırlayıcı</li>
                  <li>• Müşteri Segmentasyon Agent</li>
                  <li>• Yönetici Özeti / Haftalık Özet Agent</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="pax-table-wrap">
            <table className="pax-table">
              <thead>
                <tr>
                  <th>Kişi</th>
                  <th>Rol</th>
                  <th>Takım</th>
                  <th>Müşteri</th>
                  <th>Fırsat</th>
                  <th>Teklif</th>
                  <th>Aktivite</th>
                  <th>Risk</th>
                  <th>Hedef</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td style={{ fontWeight: 700 }}>{member.name}</td>
                    <td>{member.role}</td>
                    <td>{member.team}</td>
                    <td>{member.customers}</td>
                    <td>{member.opportunities}</td>
                    <td>{member.proposals}</td>
                    <td>{member.weeklyActivities}</td>
                    <td>{member.riskCount}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 170 }}>
                        <div style={{ 
                          flex: 1,
                          height: 8,
                          background: 'var(--surface-2)',
                          borderRadius: 999,
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${member.targetProgress}%`,
                            background: 'var(--accent)',
                            borderRadius: 999
                          }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                          {member.targetProgress}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
