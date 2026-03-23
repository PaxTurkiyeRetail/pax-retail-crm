'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type KunyeFormData = {
  firma_adi: string;
  magaza_sayisi: string;
  franchise_sayisi: string;
  
  sabit_kasa_adedi: string;
  kasapos_firmasi: string;
  pos_modeli: string;
  pos_markasi: string;
  toplam_pos_adedi: string;
  pos_alim_yili: string;
  sabit_bilgisayar_markasi: string;
  
  reyon_kullaniliyor: string;
  reyon_odeme_yazilimi: string;
  reyon_cihaz_modeli: string;
  reyon_cihaz_sayisi: string;
  reyon_alim_yili: string;
  
  el_terminali_kullaniliyor: string;
  el_terminali_modeli: string;
  el_terminali_yazilimi: string;
  el_terminali_adedi: string;
  el_terminali_alim_yili: string;
  
  erp: string;
  
  bankalar: string[];
  pos_mulkiyet: string;
  pos_mulkiyet_bankalari: string[];
  saha_hizmeti_firmasi: string;
  
  genel_memnuniyet: string;
  problem_1: string;
  problem_2: string;
  problem_3: string;
  degisim_nedeni: string;
};

const EMPTY_FORM: KunyeFormData = {
  firma_adi: '',
  magaza_sayisi: '',
  franchise_sayisi: '',
  sabit_kasa_adedi: '',
  kasapos_firmasi: '',
  pos_modeli: '',
  pos_markasi: '',
  toplam_pos_adedi: '',
  pos_alim_yili: '',
  sabit_bilgisayar_markasi: '',
  reyon_kullaniliyor: 'Hayır',
  reyon_odeme_yazilimi: '',
  reyon_cihaz_modeli: '',
  reyon_cihaz_sayisi: '',
  reyon_alim_yili: '',
  el_terminali_kullaniliyor: 'Hayır',
  el_terminali_modeli: '',
  el_terminali_yazilimi: '',
  el_terminali_adedi: '',
  el_terminali_alim_yili: '',
  erp: '',
  bankalar: [],
  pos_mulkiyet: '',
  pos_mulkiyet_bankalari: [],
  saha_hizmeti_firmasi: '',
  genel_memnuniyet: '',
  problem_1: '',
  problem_2: '',
  problem_3: '',
  degisim_nedeni: ''
};

type QuickKunyeFormProps = {
  musteriId: string;
  musteriAdi: string;
  existingData?: Partial<KunyeFormData>;
};

export default function QuickKunyeForm({ musteriId, musteriAdi, existingData }: QuickKunyeFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<KunyeFormData>({ ...EMPTY_FORM, ...existingData });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    genel: true,
    sabit_kasa: false,
    reyon: false,
    el_terminali: false,
    yazilim: false,
    bankacilik: false,
    memnuniyet: false
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateForm = (field: keyof KunyeFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleMultiSelect = (field: 'bankalar' | 'pos_mulkiyet_bankalari', value: string) => {
    setForm(prev => {
      const current = prev[field];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/kunye', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musteriId: musteriId,
          ...form
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Kayıt başarısız');
      }

      router.push(`/crm/${musteriId}`);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu');
      setSaving(false);
    }
  };

  // Conditional visibility
  const sabitKasaVisible = form.sabit_kasa_adedi !== 'Kullanılmıyor';
  const reyonVisible = form.reyon_kullaniliyor === 'Evet';
  const elTerminaliVisible = form.el_terminali_kullaniliyor === 'Evet';
  const posMulkiyetBankalarVisible = form.pos_mulkiyet === 'Banka';

  return (
    <form onSubmit={handleSubmit} className="pax-page-container">
      {error && (
        <div style={{ 
          padding: 16, 
          background: '#fef2f2', 
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: 14
        }}>
          {error}
        </div>
      )}

      {/* GRUP 1: GENEL BİLGİLER */}
      <div className="pax-card">
        <button
          type="button"
          onClick={() => toggleSection('genel')}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)'
          }}
        >
          <span>📋 Genel Bilgiler</span>
          <span style={{ fontSize: 24 }}>{openSections.genel ? '−' : '+'}</span>
        </button>

        {openSections.genel && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gap: 16 }}>
            {/* Firma Adı */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Firma Adı
              </label>
              <input
                type="text"
                value={form.firma_adi}
                onChange={(e) => updateForm('firma_adi', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              />
            </div>

            {/* Mağaza Sayısı */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Mağaza Sayısı
              </label>
              <select
                value={form.magaza_sayisi}
                onChange={(e) => updateForm('magaza_sayisi', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                <option value="">Seçin...</option>
                <option value="1-25">1-25</option>
                <option value="26-200">26-200</option>
                <option value="201-500">201-500</option>
                <option value="500+">500+</option>
              </select>
            </div>

            {/* Franchise Sayısı */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Franchise Sayısı
              </label>
              <select
                value={form.franchise_sayisi}
                onChange={(e) => updateForm('franchise_sayisi', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                <option value="">Seçin...</option>
                <option value="Yok">Yok</option>
                <option value="1-25">1-25</option>
                <option value="26-200">26-200</option>
                <option value="201-500">201-500</option>
                <option value="500+">500+</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* GRUP 2: SABİT KASA */}
      <div className="pax-card">
        <button
          type="button"
          onClick={() => toggleSection('sabit_kasa')}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)'
          }}
        >
          <span>🖥️ Sabit Kasa</span>
          <span style={{ fontSize: 24 }}>{openSections.sabit_kasa ? '−' : '+'}</span>
        </button>

        {openSections.sabit_kasa && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gap: 16 }}>
            {/* Sabit Kasa Adedi */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Sabit Kasa Adedi
              </label>
              <select
                value={form.sabit_kasa_adedi}
                onChange={(e) => updateForm('sabit_kasa_adedi', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                <option value="">Seçin...</option>
                <option value="Kullanılmıyor">Kullanılmıyor</option>
                <option value="1-25">1-25</option>
                <option value="26-200">26-200</option>
                <option value="201-500">201-500</option>
                <option value="500+">500+</option>
              </select>
            </div>

            {sabitKasaVisible && (
              <>
                {/* Kasapos Firması */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Kasapos Firması
                  </label>
                  <select
                    value={form.kasapos_firmasi}
                    onChange={(e) => updateForm('kasapos_firmasi', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="Nebim">Nebim</option>
                    <option value="Toshiba">Toshiba</option>
                    <option value="NCR">NCR</option>
                    <option value="Encore">Encore</option>
                    <option value="Enpos">Enpos</option>
                    <option value="Logo">Logo</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                {/* POS Modeli */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    POS Modeli
                  </label>
                  <select
                    value={form.pos_modeli}
                    onChange={(e) => updateForm('pos_modeli', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="ÖKC">ÖKC</option>
                    <option value="EFT">EFT</option>
                  </select>
                </div>

                {/* POS Markası - YENİ ALAN */}
                <div style={{ 
                  background: 'rgba(255, 193, 7, 0.1)', 
                  padding: 12, 
                  borderRadius: 'var(--radius-md)',
                  border: '2px dashed rgba(255, 193, 7, 0.4)'
                }}>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    POS Markası ⚠️ YENİ ALAN
                  </label>
                  <select
                    value={form.pos_markasi}
                    onChange={(e) => updateForm('pos_markasi', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="Ingenico">Ingenico</option>
                    <option value="Verifone">Verifone</option>
                    <option value="PAX">PAX</option>
                    <option value="Pavo">Pavo</option>
                    <option value="Hugin">Hugin</option>
                    <option value="Sunmi">Sunmi</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                {/* Toplam POS Adedi */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Toplam POS Adedi
                  </label>
                  <input
                    type="number"
                    value={form.toplam_pos_adedi}
                    onChange={(e) => updateForm('toplam_pos_adedi', e.target.value)}
                    className="pax-input"
                    placeholder="Örn: 50"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  />
                </div>

                {/* POS Alım Yılı - YENİ ALAN */}
                <div style={{ 
                  background: 'rgba(255, 193, 7, 0.1)', 
                  padding: 12, 
                  borderRadius: 'var(--radius-md)',
                  border: '2px dashed rgba(255, 193, 7, 0.4)'
                }}>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    POS Cihazları Alım Yılı ⚠️ YENİ ALAN
                  </label>
                  <select
                    value={form.pos_alim_yili}
                    onChange={(e) => updateForm('pos_alim_yili', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="1 yıldan az">1 yıldan az</option>
                    <option value="1-3 yıl">1-3 yıl</option>
                    <option value="3-5 yıl">3-5 yıl</option>
                    <option value="5+ yıl">5+ yıl</option>
                  </select>
                </div>

                {/* Sabit Bilgisayar Markası - YENİ ALAN */}
                <div style={{ 
                  background: 'rgba(255, 193, 7, 0.1)', 
                  padding: 12, 
                  borderRadius: 'var(--radius-md)',
                  border: '2px dashed rgba(255, 193, 7, 0.4)'
                }}>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Sabit Bilgisayar Markası ⚠️ YENİ ALAN
                  </label>
                  <select
                    value={form.sabit_bilgisayar_markasi}
                    onChange={(e) => updateForm('sabit_bilgisayar_markasi', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="HP">HP</option>
                    <option value="Dell">Dell</option>
                    <option value="Lenovo">Lenovo</option>
                    <option value="Asus">Asus</option>
                    <option value="Casper">Casper</option>
                    <option value="Apple">Apple</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* GRUP 3: REYON / SAHA CİHAZLARI */}
      <div className="pax-card">
        <button
          type="button"
          onClick={() => toggleSection('reyon')}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)'
          }}
        >
          <span>📱 Reyon / Saha Cihazları</span>
          <span style={{ fontSize: 24 }}>{openSections.reyon ? '−' : '+'}</span>
        </button>

        {openSections.reyon && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gap: 16 }}>
            {/* Reyon Kullanılıyor mu - YENİ ALAN */}
            <div style={{ 
              background: 'rgba(255, 193, 7, 0.1)', 
              padding: 12, 
              borderRadius: 'var(--radius-md)',
              border: '2px dashed rgba(255, 193, 7, 0.4)'
            }}>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Reyon Cihazı Kullanıyor mu? ⚠️ YENİ ALAN
              </label>
              <select
                value={form.reyon_kullaniliyor}
                onChange={(e) => updateForm('reyon_kullaniliyor', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                <option value="Hayır">Hayır</option>
                <option value="Evet">Evet</option>
              </select>
            </div>

            {reyonVisible && (
              <>
                {/* Reyon Ödeme Yazılımı */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Reyonda Ödeme Yazılımı
                  </label>
                  <select
                    value={form.reyon_odeme_yazilimi}
                    onChange={(e) => updateForm('reyon_odeme_yazilimi', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="Logo">Logo</option>
                    <option value="Nebim">Nebim</option>
                    <option value="Genius">Genius</option>
                    <option value="NCR">NCR</option>
                    <option value="Tera">Tera</option>
                    <option value="Enpos">Enpos</option>
                    <option value="In House">In House</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                {/* Reyon Cihaz Modeli - YENİ ALAN */}
                <div style={{ 
                  background: 'rgba(255, 193, 7, 0.1)', 
                  padding: 12, 
                  borderRadius: 'var(--radius-md)',
                  border: '2px dashed rgba(255, 193, 7, 0.4)'
                }}>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Reyon Cihazı Modeli ⚠️ YENİ ALAN
                  </label>
                  <select
                    value={form.reyon_cihaz_modeli}
                    onChange={(e) => updateForm('reyon_cihaz_modeli', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="Zebra">Zebra</option>
                    <option value="Honeywell">Honeywell</option>
                    <option value="Datalogic">Datalogic</option>
                    <option value="Newland">Newland</option>
                    <option value="Sunmi">Sunmi</option>
                    <option value="PAX">PAX</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                {/* Reyon Cihaz Sayısı */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Reyonda Kullanılan Cihaz Sayısı
                  </label>
                  <input
                    type="number"
                    value={form.reyon_cihaz_sayisi}
                    onChange={(e) => updateForm('reyon_cihaz_sayisi', e.target.value)}
                    className="pax-input"
                    placeholder="Örn: 20"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  />
                </div>

                {/* Reyon Alım Yılı - YENİ ALAN */}
                <div style={{ 
                  background: 'rgba(255, 193, 7, 0.1)', 
                  padding: 12, 
                  borderRadius: 'var(--radius-md)',
                  border: '2px dashed rgba(255, 193, 7, 0.4)'
                }}>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Reyon/Saha Cihazları Alım Yılı ⚠️ YENİ ALAN
                  </label>
                  <select
                    value={form.reyon_alim_yili}
                    onChange={(e) => updateForm('reyon_alim_yili', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="1 yıldan az">1 yıldan az</option>
                    <option value="1-3 yıl">1-3 yıl</option>
                    <option value="3-5 yıl">3-5 yıl</option>
                    <option value="5+ yıl">5+ yıl</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* GRUP 4: EL TERMİNALİ */}
      <div className="pax-card">
        <button
          type="button"
          onClick={() => toggleSection('el_terminali')}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)'
          }}
        >
          <span>📲 El Terminali</span>
          <span style={{ fontSize: 24 }}>{openSections.el_terminali ? '−' : '+'}</span>
        </button>

        {openSections.el_terminali && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gap: 16 }}>
            {/* El Terminali Kullanılıyor mu - YENİ ALAN */}
            <div style={{ 
              background: 'rgba(255, 193, 7, 0.1)', 
              padding: 12, 
              borderRadius: 'var(--radius-md)',
              border: '2px dashed rgba(255, 193, 7, 0.4)'
            }}>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                El Terminali Kullanıyor mu? ⚠️ YENİ ALAN
              </label>
              <select
                value={form.el_terminali_kullaniliyor}
                onChange={(e) => updateForm('el_terminali_kullaniliyor', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                <option value="Hayır">Hayır</option>
                <option value="Evet">Evet</option>
              </select>
            </div>

            {elTerminaliVisible && (
              <>
                {/* El Terminali Modeli */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    El Terminali Modeli
                  </label>
                  <select
                    value={form.el_terminali_modeli}
                    onChange={(e) => updateForm('el_terminali_modeli', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="Zebra">Zebra</option>
                    <option value="Newland">Newland</option>
                    <option value="Point Mobile">Point Mobile</option>
                    <option value="Urovo">Urovo</option>
                    <option value="Telefon">Telefon</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                {/* El Terminali Yazılımı - YENİ ALAN */}
                <div style={{ 
                  background: 'rgba(255, 193, 7, 0.1)', 
                  padding: 12, 
                  borderRadius: 'var(--radius-md)',
                  border: '2px dashed rgba(255, 193, 7, 0.4)'
                }}>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    El Terminali Yazılımı ⚠️ YENİ ALAN
                  </label>
                  <select
                    value={form.el_terminali_yazilimi}
                    onChange={(e) => updateForm('el_terminali_yazilimi', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="Logo">Logo</option>
                    <option value="Nebim">Nebim</option>
                    <option value="Genius">Genius</option>
                    <option value="NCR">NCR</option>
                    <option value="Tera">Tera</option>
                    <option value="Enpos">Enpos</option>
                    <option value="In House">In House</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                {/* El Terminali Adedi */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    El Terminali Adedi
                  </label>
                  <input
                    type="number"
                    value={form.el_terminali_adedi}
                    onChange={(e) => updateForm('el_terminali_adedi', e.target.value)}
                    className="pax-input"
                    placeholder="Örn: 10"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  />
                </div>

                {/* El Terminali Alım Yılı - YENİ ALAN */}
                <div style={{ 
                  background: 'rgba(255, 193, 7, 0.1)', 
                  padding: 12, 
                  borderRadius: 'var(--radius-md)',
                  border: '2px dashed rgba(255, 193, 7, 0.4)'
                }}>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    El Terminali Alım Yılı ⚠️ YENİ ALAN
                  </label>
                  <select
                    value={form.el_terminali_alim_yili}
                    onChange={(e) => updateForm('el_terminali_alim_yili', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    <option value="1 yıldan az">1 yıldan az</option>
                    <option value="1-3 yıl">1-3 yıl</option>
                    <option value="3-5 yıl">3-5 yıl</option>
                    <option value="5+ yıl">5+ yıl</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* GRUP 5: YAZILIM & ERP */}
      <div className="pax-card">
        <button
          type="button"
          onClick={() => toggleSection('yazilim')}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)'
          }}
        >
          <span>💻 Yazılım & ERP</span>
          <span style={{ fontSize: 24 }}>{openSections.yazilim ? '−' : '+'}</span>
        </button>

        {openSections.yazilim && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gap: 16 }}>
            {/* ERP */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                ERP
              </label>
              <select
                value={form.erp}
                onChange={(e) => updateForm('erp', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                <option value="">Seçin...</option>
                <option value="Logo">Logo</option>
                <option value="Nebim">Nebim</option>
                <option value="Genius">Genius</option>
                <option value="NCR">NCR</option>
                <option value="Tera">Tera</option>
                <option value="Enpos">Enpos</option>
                <option value="SAP">SAP</option>
                <option value="Oracle">Oracle</option>
                <option value="Uyumsoft">Uyumsoft</option>
                <option value="Giz">Giz</option>
                <option value="In House">In House</option>
                <option value="Diğer">Diğer</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* GRUP 6: BANKACILIK */}
      <div className="pax-card">
        <button
          type="button"
          onClick={() => toggleSection('bankacilik')}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)'
          }}
        >
          <span>🏦 Bankacılık</span>
          <span style={{ fontSize: 24 }}>{openSections.bankacilik ? '−' : '+'}</span>
        </button>

        {openSections.bankacilik && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gap: 16 }}>
            {/* Bankalar - Multi Select */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Bankalar (Birden fazla seçilebilir)
              </label>
              <div style={{ 
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                maxHeight: 200,
                overflow: 'auto'
              }}>
                {['Akbank', 'Garanti BBVA', 'İş Bankası', 'Yapı Kredi', 'Halkbank', 'VakıfBank', 'Ziraat Bankası', 'QNB', 'TEB', 'DenizBank'].map(banka => (
                  <label key={banka} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.bankalar.includes(banka)}
                      onChange={() => handleMultiSelect('bankalar', banka)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 14 }}>{banka}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* POS Mülkiyet */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                POS Mülkiyet
              </label>
              <select
                value={form.pos_mulkiyet}
                onChange={(e) => updateForm('pos_mulkiyet', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                <option value="">Seçin...</option>
                <option value="Kendisi">Kendisi</option>
                <option value="Banka">Banka</option>
                <option value="Bankada">Bankada</option>
              </select>
            </div>

            {/* POS Mülkiyet Bankaları */}
            {posMulkiyetBankalarVisible && (
              <div>
                <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                  POS Mülkiyet Bankaları (Birden fazla seçilebilir)
                </label>
                <div style={{ 
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  maxHeight: 200,
                  overflow: 'auto'
                }}>
                  {['Akbank', 'Garanti BBVA', 'İş Bankası', 'Yapı Kredi', 'Halkbank', 'VakıfBank', 'Ziraat Bankası', 'QNB', 'TEB', 'DenizBank'].map(banka => (
                    <label key={banka} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.pos_mulkiyet_bankalari.includes(banka)}
                        onChange={() => handleMultiSelect('pos_mulkiyet_bankalari', banka)}
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontSize: 14 }}>{banka}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Saha Hizmeti Firması */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Saha Hizmeti Firması
              </label>
              <select
                value={form.saha_hizmeti_firmasi}
                onChange={(e) => updateForm('saha_hizmeti_firmasi', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                <option value="">Seçin...</option>
                <option value="Bilinmiyor">Bilinmiyor</option>
                <option value="Teknoser">Teknoser</option>
                <option value="IBM">IBM</option>
                <option value="Payser">Payser</option>
                <option value="Diğer">Diğer</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* GRUP 7: MEMNUNİYET */}
      <div className="pax-card">
        <button
          type="button"
          onClick={() => toggleSection('memnuniyet')}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)'
          }}
        >
          <span>⭐ Memnuniyet</span>
          <span style={{ fontSize: 24 }}>{openSections.memnuniyet ? '−' : '+'}</span>
        </button>

        {openSections.memnuniyet && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gap: 16 }}>
            {/* Genel Memnuniyet */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Genel Memnuniyet
              </label>
              <select
                value={form.genel_memnuniyet}
                onChange={(e) => updateForm('genel_memnuniyet', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                <option value="">Seçin...</option>
                <option value="Memnun">Memnun</option>
                <option value="Orta">Orta</option>
                <option value="Memnun Değil">Memnun Değil</option>
              </select>
            </div>

            {/* Problem 1 */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Problem 1
              </label>
              <textarea
                value={form.problem_1}
                onChange={(e) => updateForm('problem_1', e.target.value)}
                className="pax-input"
                rows={3}
                placeholder="İlk problem..."
                style={{ width: '100%', fontSize: 16, resize: 'vertical', padding: 12 }}
              />
            </div>

            {/* Problem 2 */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Problem 2
              </label>
              <textarea
                value={form.problem_2}
                onChange={(e) => updateForm('problem_2', e.target.value)}
                className="pax-input"
                rows={3}
                placeholder="İkinci problem..."
                style={{ width: '100%', fontSize: 16, resize: 'vertical', padding: 12 }}
              />
            </div>

            {/* Problem 3 */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Problem 3
              </label>
              <textarea
                value={form.problem_3}
                onChange={(e) => updateForm('problem_3', e.target.value)}
                className="pax-input"
                rows={3}
                placeholder="Üçüncü problem..."
                style={{ width: '100%', fontSize: 16, resize: 'vertical', padding: 12 }}
              />
            </div>

            {/* Değişim Nedeni */}
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Değişim Nedeni
              </label>
              <textarea
                value={form.degisim_nedeni}
                onChange={(e) => updateForm('degisim_nedeni', e.target.value)}
                className="pax-input"
                rows={3}
                placeholder="Sistemini değiştirme nedeni..."
                style={{ width: '100%', fontSize: 16, resize: 'vertical', padding: 12 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pax-card" style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="pax-btn pax-btn-secondary"
          style={{ flex: 1 }}
        >
          İptal
        </button>
        <button
          type="submit"
          disabled={saving}
          className="pax-btn pax-btn-primary"
          style={{ flex: 2 }}
        >
          {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
        </button>
      </div>
    </form>
  );
}
