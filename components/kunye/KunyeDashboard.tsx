'use client';
import '@/styles/kunye-dashboard.css';

import { useMemo, useState } from 'react';
import { deriveCustomerSegmentation, customerStatusTone, managementTypeTone, FIRMA_DURUMU_OPTIONS, YONETIM_TIPI_OPTIONS } from '@/lib/customer-segmentation';

type KunyeDashboardProps = {
  kunye: any;
  musteriAdi: string;
  sektorVeSorumlu?: string;
  aktifFazNo?: number | null;
  musteriId?: string;
};

export default function KunyeDashboard({ kunye, musteriAdi, sektorVeSorumlu, aktifFazNo, musteriId }: KunyeDashboardProps) {
  const [segOverride, setSegOverride] = useState<{ firmaDurumu?: string; yonetimTipi?: string }>({});
  const [editingSeg, setEditingSeg] = useState(false);
  const [savingSeg, setSavingSeg] = useState(false);
  const [segMsg, setSegMsg] = useState('');

  const segmentation = useMemo(() => deriveCustomerSegmentation(aktifFazNo), [aktifFazNo]);
  const firmaDurumu = (segOverride.firmaDurumu || segmentation.firmaDurumu) as string;
  const yonetimTipi = (segOverride.yonetimTipi || segmentation.yonetimTipi) as string;
  const firmaTone = customerStatusTone(firmaDurumu as any);
  const yonetimTone = managementTypeTone(yonetimTipi as any);

  const stats = useMemo(() => {
    if (!kunye) return { total: 30, filled: 0, percentage: 0, groups: [] as any[] };

    const normalizeYesNo = (value: any) =>
      String(value ?? '').trim().toLocaleLowerCase('tr-TR');

    const reyonKullaniyor = normalizeYesNo(kunye.reyon_kullaniliyor) === 'evet';
    const elTerminaliKullaniyor = normalizeYesNo(kunye.el_terminali_kullaniliyor) === 'evet';
    const posMulkiyetBanka = normalizeYesNo(kunye.pos_mulkiyet) === 'banka';

    const groups = [
      { name: 'Genel Bilgiler', icon: '📋', fields: [kunye.firma_adi, kunye.magaza_sayisi, kunye.franchise_sayisi] },
      { name: 'Sabit Kasa', icon: '🖥️', fields: [kunye.sabit_kasa_adedi, kunye.kasapos_firmasi, kunye.pos_modeli, kunye.pos_markasi, kunye.toplam_pos_adedi, kunye.pos_alim_yili, kunye.sabit_bilgisayar_markasi] },
      {
        name: 'Reyon/Saha',
        icon: '📱',
        fields: reyonKullaniyor
          ? [kunye.reyon_kullaniliyor, kunye.reyon_odeme_yazilimi, kunye.reyon_cihaz_modeli, kunye.reyon_cihaz_sayisi, kunye.reyon_alim_yili]
          : [kunye.reyon_kullaniliyor],
      },
      {
        name: 'El Terminali',
        icon: '📲',
        fields: elTerminaliKullaniyor
          ? [kunye.el_terminali_kullaniliyor, kunye.el_terminali_modeli, kunye.el_terminali_yazilimi, kunye.el_terminali_adedi, kunye.el_terminali_alim_yili]
          : [kunye.el_terminali_kullaniliyor],
      },
      { name: 'Yazılım & ERP', icon: '💻', fields: [kunye.erp] },
      {
        name: 'Bankacılık',
        icon: '🏦',
        fields: posMulkiyetBanka
          ? [kunye.bankalar, kunye.pos_mulkiyet, kunye.pos_mulkiyet_bankalari, kunye.saha_hizmeti_firmasi]
          : [kunye.bankalar, kunye.pos_mulkiyet, kunye.saha_hizmeti_firmasi],
      },
      {
        name: 'Memnuniyet',
        icon: '⭐',
        fields:
          normalizeYesNo(kunye.genel_memnuniyet) === 'memnun'
            ? [kunye.genel_memnuniyet, kunye.degisim_nedeni]
            : [kunye.genel_memnuniyet, kunye.problem_1, kunye.degisim_nedeni],
      },
    ];

    const countFilled = (fields: any[]) => fields.filter(f => {
      if (Array.isArray(f)) return f.length > 0;
      if (typeof f === 'string') return f.trim().length > 0;
      if (typeof f === 'number') return f > 0;
      return false;
    }).length;

    const mappedGroups = groups.map(g => ({
      name: g.name,
      icon: g.icon,
      total: g.fields.length,
      filled: countFilled(g.fields),
    }));
    const total = mappedGroups.reduce((acc, g) => acc + g.total, 0);
    const filled = mappedGroups.reduce((acc, g) => acc + g.filled, 0);
    return { total, filled, percentage: total > 0 ? Math.round((filled / total) * 100) : 0, groups: mappedGroups };
  }, [kunye]);

  const getColor = (pct: number) => {
    if (pct >= 80) return { bar: '#22c55e', text: '#16a34a', glow: 'rgba(34,197,94,0.4)' };
    if (pct >= 50) return { bar: '#f59e0b', text: '#d97706', glow: 'rgba(245,158,11,0.4)' };
    return { bar: '#ef4444', text: '#dc2626', glow: 'rgba(239,68,68,0.4)' };
  };

  const mainColor = getColor(stats.percentage);
  const r = 44, cx = 52, cy = 52;
  const circ = 2 * Math.PI * r;
  const dash = (stats.percentage / 100) * circ;
  const statusLabel = stats.percentage >= 80 ? '✓ Eksiksiz' : stats.percentage >= 50 ? '⚠ Eksik Var' : '⚠ Çok Eksik';
  const completedCats = stats.groups.filter(g => g.filled === g.total).length;

  const handleSaveSegmentation = async () => {
    if (!musteriId) return;
    setSavingSeg(true);
    setSegMsg('');
    try {
      // In-memory override — backend bağlandığında burada API çağrısı yapılacak
      setSegMsg('✓ Kaydedildi (demo mod)');
      setEditingSeg(false);
      setTimeout(() => setSegMsg(''), 3000);
    } catch {
      setSegMsg('Hata oluştu');
    } finally {
      setSavingSeg(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* ── HERO ── */}
      <section className="pax-hero kd-hero-grid">
        <div className="kd-left">
          <div className="kd-eyebrow">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
            Müşteri Künye
          </div>
          <h2 className="kd-title">{musteriAdi}</h2>
          {sektorVeSorumlu && <p className="kd-sub">{sektorVeSorumlu}</p>}

          {/* Segmentasyon badges + edit toggle */}
          {!editingSeg && (
            <div className="kd-badges">
              <span className="kd-badge" style={{ background: firmaTone.bg, border: `1px solid ${firmaTone.border}`, color: firmaTone.color }}>
                🏷️ {firmaDurumu}
              </span>
              <span className="kd-badge" style={{ background: yonetimTone.bg, border: `1px solid ${yonetimTone.border}`, color: yonetimTone.color }}>
                🎯 {yonetimTipi}
              </span>
              <span className="kd-badge" style={{
                background: stats.percentage >= 80 ? 'rgba(34,197,94,0.2)' : stats.percentage >= 50 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                border: `1px solid ${mainColor.bar}`, color: 'white',
              }}>
                {statusLabel}
              </span>
              <button className="kd-edit-btn" onClick={() => setEditingSeg(true)}>
                ✏️ Segmentasyonu Düzenle
              </button>
              {segMsg && <span className="seg-msg">{segMsg}</span>}
            </div>
          )}

          {/* Segmentasyon editörü */}
          {editingSeg && (
            <div className="seg-editor">
              <div className="seg-editor-title">✏️ Segmentasyonu Manuel Düzenle</div>
              <div className="seg-row">
                <div className="seg-field">
                  <label>Firma Durumu</label>
                  <select
                    className="seg-select"
                    value={segOverride.firmaDurumu || segmentation.firmaDurumu}
                    onChange={e => setSegOverride(v => ({ ...v, firmaDurumu: e.target.value }))}
                  >
                    {FIRMA_DURUMU_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="seg-field">
                  <label>Yönetim Tipi</label>
                  <select
                    className="seg-select"
                    value={segOverride.yonetimTipi || segmentation.yonetimTipi}
                    onChange={e => setSegOverride(v => ({ ...v, yonetimTipi: e.target.value }))}
                  >
                    {YONETIM_TIPI_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="seg-actions">
                <button className="seg-save" onClick={handleSaveSegmentation} disabled={savingSeg}>
                  {savingSeg ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button className="seg-cancel" onClick={() => { setEditingSeg(false); setSegOverride({}); }}>
                  İptal
                </button>
                <span style={{ fontSize: 11, opacity: 0.6 }}>Faz verisi yoksa manuel olarak belirlenebilir</span>
              </div>
            </div>
          )}
        </div>

        {/* Donut */}
        <div className="kd-right">
          <svg width="112" height="112" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={mainColor.bar} strokeWidth="9"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 8px ${mainColor.glow})` }} />
            <text x={cx} y={cy - 5} textAnchor="middle" fill="white" fontSize="17" fontWeight="900"
              style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px` }}>
              {stats.percentage}%
            </text>
            <text x={cx} y={cy + 13} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9" fontWeight="700"
              style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px` }}>
              {stats.filled}/{stats.total}
            </text>
          </svg>
          <div className="kd-donut-caption">Doluluk Oranı</div>
        </div>
      </section>

      {/* ── STAT CARDS ── */}
      <div className="kd-cards">
        <div className="kd-card">
          <div className="kd-card-kicker">Dolu Alan</div>
          <div className="kd-card-val" style={{ color: '#22c55e' }}>{stats.filled}</div>
          <div className="kd-card-note">{stats.total} alanın {stats.percentage}%’si tamamlandı</div>
          <div className="kd-track"><div className="kd-fill" style={{ width: `${stats.percentage}%`, background: mainColor.bar }} /></div>
        </div>
        <div className="kd-card">
          <div className="kd-card-kicker">Eksik Alan</div>
          <div className="kd-card-val" style={{ color: stats.total - stats.filled > 0 ? '#ef4444' : '#22c55e' }}>
            {stats.total - stats.filled}
          </div>
          <div className="kd-card-note">{stats.total - stats.filled === 0 ? 'Tüm alanlar eksiksiz ✓' : `${stats.total - stats.filled} alan doldurulmalı`}</div>
          <div className="kd-track"><div className="kd-fill" style={{ width: `${100 - stats.percentage}%`, background: '#ef4444' }} /></div>
        </div>
        <div className="kd-card">
          <div className="kd-card-kicker">Tam Kategori</div>
          <div className="kd-card-val" style={{ color: '#3b82f6' }}>{completedCats}</div>
          <div className="kd-card-note">/ {stats.groups.length} kategori eksiksiz dolu</div>
          <div className="kd-track">
            <div className="kd-fill" style={{ width: `${(completedCats / stats.groups.length) * 100}%`, background: '#3b82f6' }} />
          </div>
        </div>
        <div className="kd-card">
          <div className="kd-card-kicker">ERP Yazılımı</div>
          <div className="kd-card-val" style={{ fontSize: kunye?.erp ? 17 : 34, paddingTop: kunye?.erp ? 9 : 0, color: kunye?.erp ? '#10b981' : 'var(--text-3)' }}>
            {kunye?.erp || '—'}
          </div>
          <div className="kd-card-note">{kunye?.erp ? 'Sisteme kayıtlı' : 'Henüz girilmemiş'}</div>
          <div className="kd-track"><div className="kd-fill" style={{ width: kunye?.erp ? '100%' : '0%', background: '#10b981' }} /></div>
        </div>
      </div>

      {/* ── CATEGORY GRID ── */}
      <div className="kd-grid">
        {stats.groups.map((group, idx) => {
          const pct = Math.round((group.filled / group.total) * 100);
          const col = getColor(pct);
          return (
            <div key={idx} className="kd-cat">
              <div className="kd-cat-head">
                <span style={{ fontSize: 18 }}>{group.icon}</span>
                <span className="kd-cat-name">{group.name}</span>
              </div>
              <div className="kd-track"><div className="kd-fill" style={{ width: `${pct}%`, background: col.bar }} /></div>
              <div className="kd-cat-footer">
                <span className="kd-cat-frac">{group.filled}/{group.total} alan</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: col.text }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── QUICK FACTS ── */}
      {kunye && (() => {
        const facts = [
          kunye.magaza_sayisi && { icon: '🏪', label: 'Mağaza', val: kunye.magaza_sayisi },
          kunye.franchise_sayisi && kunye.franchise_sayisi !== '0' && { icon: '🔗', label: 'Franchise', val: kunye.franchise_sayisi },
          kunye.sabit_kasa_adedi && kunye.sabit_kasa_adedi !== 'Kullanılmıyor' && { icon: '🖥️', label: 'Sabit Kasa', val: kunye.sabit_kasa_adedi },
          kunye.kasapos_firmasi && { icon: '🏢', label: 'Kasa Firması', val: kunye.kasapos_firmasi },
          kunye.pos_markasi && { icon: '💳', label: 'POS Marka', val: kunye.pos_markasi },
          kunye.toplam_pos_adedi && { icon: '🔢', label: 'Toplam POS', val: kunye.toplam_pos_adedi },
          kunye.bankalar?.length && { icon: '🏦', label: 'Banka', val: `${Array.isArray(kunye.bankalar) ? kunye.bankalar.length : kunye.bankalar.split(',').length} banka` },
          kunye.genel_memnuniyet && { icon: '⭐', label: 'Memnuniyet', val: kunye.genel_memnuniyet },
          kunye.reyon_kullaniliyor === 'Evet' && { icon: '📱', label: 'Reyon/Saha', val: 'Kullanıyor' },
          kunye.el_terminali_kullaniliyor === 'Evet' && { icon: '📲', label: 'El Terminali', val: 'Kullanıyor' },
        ].filter(Boolean) as { icon: string; label: string; val: string }[];

        if (!facts.length) return null;
        return (
          <div className="kd-facts">
            {facts.map((f, i) => (
              <div key={i} className="kd-fact">
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <div>
                  <div className="kd-fact-lbl">{f.label}</div>
                  <div className="kd-fact-val">{f.val}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
