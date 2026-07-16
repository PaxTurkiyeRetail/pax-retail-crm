'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';


type KunyeOption = { label: string; value: string };
type KunyeOptionMap = Record<string, KunyeOption[]>;

const FALLBACK_KUNYE_OPTIONS: KunyeOptionMap = {
  kunye_magaza_sayisi: ['1-25', '26-200', '201-500', '500+'].map((value) => ({ label: value, value })),
  kunye_franchise_sayisi: ['Yok', '1-25', '26-200', '201-500', '500+'].map((value) => ({ label: value, value })),
  kunye_sabit_kasa_adedi: ['Kullanılmıyor', '1-25', '26-200', '201-500', '500+'].map((value) => ({ label: value, value })),
  kunye_kasapos_firmasi: ['Nebim', 'Toshiba', 'Echopos', 'NCR', 'Encore', 'Enpos', 'Logo', 'Posback', 'Smartpos', 'Barsoft', 'Protel', 'Avion', 'Inhouse', 'Denpos', 'Diğer'].map((value) => ({ label: value, value })),
  kunye_pos_modeli: ['ÖKC', 'EFT'].map((value) => ({ label: value, value })),
  kunye_pos_markasi: ['Ingenico', 'Verifone', 'PAX', 'Pavo', 'Hugin', 'Sunmi', 'Profilo', 'Beko', 'Vera', 'Inpos', 'Diğer'].map((value) => ({ label: value, value })),
  kunye_alim_yili: ['1 yıldan az', '1-3 yıl', '3-5 yıl', '5+ yıl'].map((value) => ({ label: value, value })),
  kunye_bilgisayar_markasi: ['HP', 'Posback', 'Echopos', 'Toshiba', 'Enpos', 'NCR', 'Encore', 'D&N', 'OEM', 'Diğer'].map((value) => ({ label: value, value })),
  kunye_evet_hayir: ['Hayır', 'Evet'].map((value) => ({ label: value, value })),
  kunye_odeme_yazilimi: ['Logo', 'Nebim', 'Genius', 'NCR', 'Tera', 'Enpos', 'In House', 'Diğer'].map((value) => ({ label: value, value })),
  kunye_reyon_cihaz_modeli: ['Zebra', 'Honeywell', 'Datalogic', 'Newland', 'Sunmi', 'PAX', 'Diğer'].map((value) => ({ label: value, value })),
  kunye_el_terminali_modeli: ['Honeywell', 'iData', 'Disc', 'Zebra', 'Newland', 'Point Mobile', 'Urovo', 'Telefon', 'Diğer'].map((value) => ({ label: value, value })),
  kunye_erp: ['Logo', 'Nebim', 'Genius', 'NCR', 'Tera', 'Enpos', 'Mikro', 'Posback', 'SAP', 'AXAPTA', 'Oracle', 'Uyumsoft', 'Giz', 'In House', 'Diğer'].map((value) => ({ label: value, value })),
  kunye_banka: ['Akbank', 'Garanti BBVA', 'İş Bankası', 'Yapı Kredi', 'Halkbank', 'VakıfBank', 'Ziraat Bankası', 'QNB', 'TEB', 'DenizBank', 'AktifBank'].map((value) => ({ label: value, value })),
  kunye_pos_mulkiyet: ['Kendisi', 'Banka', 'Bankada'].map((value) => ({ label: value, value })),
  kunye_saha_hizmeti_firmasi: ['Bilinmiyor', 'Teknoser', 'IBM', 'Payser', 'Diğer'].map((value) => ({ label: value, value })),
  kunye_memnuniyet: ['Memnun', 'Orta', 'Memnun Değil'].map((value) => ({ label: value, value })),
};

function getOptions(options: KunyeOptionMap, key: string) {
  return options[key]?.length ? options[key] : FALLBACK_KUNYE_OPTIONS[key] ?? [];
}

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
  const [form, setForm] = useState<KunyeFormData>({
    ...EMPTY_FORM,
    ...existingData,
    firma_adi: String(existingData?.firma_adi ?? musteriAdi ?? ''),
    bankalar: Array.isArray(existingData?.bankalar)
      ? existingData!.bankalar
      : String(existingData?.bankalar ?? '')
          .split(',')
          .map(v => v.trim())
          .filter(Boolean),
    pos_mulkiyet_bankalari: Array.isArray(existingData?.pos_mulkiyet_bankalari)
      ? existingData!.pos_mulkiyet_bankalari
      : String(existingData?.pos_mulkiyet_bankalari ?? '')
          .split(',')
          .map(v => v.trim())
          .filter(Boolean),
  });
  const [parameterOptions, setParameterOptions] = useState<KunyeOptionMap>(FALLBACK_KUNYE_OPTIONS);
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



  useEffect(() => {
    let alive = true;
    fetch('/api/parameters/kunye', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Parametreler alınamadı');
        if (alive && data.options) setParameterOptions({ ...FALLBACK_KUNYE_OPTIONS, ...data.options });
      })
      .catch(() => {
        if (alive) setParameterOptions(FALLBACK_KUNYE_OPTIONS);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setForm({
      ...EMPTY_FORM,
      ...existingData,
      firma_adi: String(existingData?.firma_adi ?? musteriAdi ?? ''),
      bankalar: Array.isArray(existingData?.bankalar)
        ? existingData.bankalar
        : String(existingData?.bankalar ?? '')
            .split(',')
            .map(v => v.trim())
            .filter(Boolean),
      pos_mulkiyet_bankalari: Array.isArray(existingData?.pos_mulkiyet_bankalari)
        ? existingData.pos_mulkiyet_bankalari
        : String(existingData?.pos_mulkiyet_bankalari ?? '')
            .split(',')
            .map(v => v.trim())
            .filter(Boolean),
    });
  }, [existingData, musteriAdi]);

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
      const payload = {
        ...form,
        firma_adi: musteriAdi,
        reyon_odeme_yazilimi: reyonVisible ? form.reyon_odeme_yazilimi : '',
        reyon_cihaz_modeli: reyonVisible ? form.reyon_cihaz_modeli : '',
        reyon_cihaz_sayisi: reyonVisible ? form.reyon_cihaz_sayisi : '',
        reyon_alim_yili: reyonVisible ? form.reyon_alim_yili : '',
        el_terminali_modeli: elTerminaliVisible ? form.el_terminali_modeli : '',
        el_terminali_yazilimi: elTerminaliVisible ? form.el_terminali_yazilimi : '',
        el_terminali_adedi: elTerminaliVisible ? form.el_terminali_adedi : '',
        el_terminali_alim_yili: elTerminaliVisible ? form.el_terminali_alim_yili : '',
        pos_mulkiyet_bankalari: posMulkiyetBankalarVisible ? form.pos_mulkiyet_bankalari : [],
        problem_1: form.genel_memnuniyet && form.genel_memnuniyet !== 'Memnun' ? form.problem_1 : '',
        problem_2: '',
        problem_3: '',
      };

      const res = await fetch('/api/kunye', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musteriId: musteriId,
          ...payload
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Kayıt başarısız');
      }

      router.refresh();
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
  const opt = (key: string) => getOptions(parameterOptions, key);


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
                readOnly
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16, background: 'var(--panel-soft)' }}
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
                {opt('kunye_magaza_sayisi').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                {opt('kunye_franchise_sayisi').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                {opt('kunye_sabit_kasa_adedi').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                    {opt('kunye_kasapos_firmasi').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                    {opt('kunye_pos_modeli').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>

                {/* POS Markası - YENİ ALAN */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    POS Markası
                  </label>
                  <select
                    value={form.pos_markasi}
                    onChange={(e) => updateForm('pos_markasi', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    {opt('kunye_pos_markasi').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    POS Cihazları Alım Yılı
                  </label>
                  <select
                    value={form.pos_alim_yili}
                    onChange={(e) => updateForm('pos_alim_yili', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    {opt('kunye_alim_yili').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>

                {/* Sabit Bilgisayar Markası - YENİ ALAN */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Sabit Bilgisayar Markası
                  </label>
                  <select
                    value={form.sabit_bilgisayar_markasi}
                    onChange={(e) => updateForm('sabit_bilgisayar_markasi', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    {opt('kunye_bilgisayar_markasi').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                Reyon Cihazı Kullanıyor mu?
              </label>
              <select
                value={form.reyon_kullaniliyor}
                onChange={(e) => updateForm('reyon_kullaniliyor', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                {opt('kunye_evet_hayir').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                    {opt('kunye_odeme_yazilimi').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>

                {/* Reyon Cihaz Modeli - YENİ ALAN */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Reyon Cihazı Modeli
                  </label>
                  <select
                    value={form.reyon_cihaz_modeli}
                    onChange={(e) => updateForm('reyon_cihaz_modeli', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    {opt('kunye_reyon_cihaz_modeli').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    Reyon/Saha Cihazları Alım Yılı
                  </label>
                  <select
                    value={form.reyon_alim_yili}
                    onChange={(e) => updateForm('reyon_alim_yili', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    {opt('kunye_alim_yili').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                El Terminali Kullanıyor mu?
              </label>
              <select
                value={form.el_terminali_kullaniliyor}
                onChange={(e) => updateForm('el_terminali_kullaniliyor', e.target.value)}
                className="pax-input"
                style={{ width: '100%', minHeight: 48, fontSize: 16 }}
              >
                {opt('kunye_evet_hayir').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                    {opt('kunye_el_terminali_modeli').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>

                {/* El Terminali Yazılımı - YENİ ALAN */}
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    El Terminali Yazılımı
                  </label>
                  <select
                    value={form.el_terminali_yazilimi}
                    onChange={(e) => updateForm('el_terminali_yazilimi', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    {opt('kunye_odeme_yazilimi').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                <div>
                  <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                    El Terminali Alım Yılı
                  </label>
                  <select
                    value={form.el_terminali_alim_yili}
                    onChange={(e) => updateForm('el_terminali_alim_yili', e.target.value)}
                    className="pax-input"
                    style={{ width: '100%', minHeight: 48, fontSize: 16 }}
                  >
                    <option value="">Seçin...</option>
                    {opt('kunye_alim_yili').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                {opt('kunye_erp').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                {opt('kunye_banka').map((item) => { const banka = item.value; return (
                  <label key={banka} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.bankalar.includes(banka)}
                      onChange={() => handleMultiSelect('bankalar', banka)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 14 }}>{banka}</span>
                  </label>
                ); })}
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
                {opt('kunye_pos_mulkiyet').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                  {opt('kunye_banka').map((item) => { const banka = item.value; return (
                    <label key={banka} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.pos_mulkiyet_bankalari.includes(banka)}
                        onChange={() => handleMultiSelect('pos_mulkiyet_bankalari', banka)}
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ fontSize: 14 }}>{banka}</span>
                    </label>
                  ); })}
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
                {opt('kunye_saha_hizmeti_firmasi').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
                {opt('kunye_memnuniyet').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>

            {/* Problem */}
            {form.genel_memnuniyet && form.genel_memnuniyet !== 'Memnun' && (
              <div>
                <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                  Problem
                </label>
                <textarea
                  value={form.problem_1}
                  onChange={(e) => updateForm('problem_1', e.target.value)}
                  className="pax-input"
                  rows={3}
                  placeholder="Problem..."
                  style={{ width: '100%', fontSize: 16, resize: 'vertical', padding: 12 }}
                />
              </div>
            )}

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
