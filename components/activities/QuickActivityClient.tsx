'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Customer = {
  musteri_id: string;
  musteri: string;
  sorumlu: string | null;
  sektor?: string | null;
  report_only?: boolean | null;
  is_business_partner?: boolean | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  son_kalinan_faz_no?: number | null;
  son_kalinan_faz_adi?: string | null;
  son_kalinan_faz_durumu?: string | null;
};

type Faz = {
  faz_no: number;
  asama_adi: string;
};

type Me = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
};

const AKTIVITE_TIPLERI = [
  'Online Toplantı',
  'Yerinde Ziyaret',
  'Telefon',
  'E-posta',
  'Teknik Ziyaret',
  'Teknik Online',
  'POM',
  'Diğer'
] as const;

const TECHNICAL_ACTIVITY_TYPES = ['Teknik Ziyaret', 'Teknik Online', 'POM'] as const;

const FAZ_DURUMLARI = [
  'Devam Ediyor',
  'Tamamlandı',
  'İhtiyaç Duyulmadı',
  'Başlamadı'
] as const;

const BEKLEYEN_TARAFLAR = [
  'Müşteri',
  'Müşteri IT',
  'Müşteri (Finance Owner)',
  'PAX RS(Support)'
] as const;

const TECHNICAL_PHASE_REQUIRED_MESSAGE = 'Bu müşteri için faz bilgisi bulunamadı. Lütfen önce account ekibine bilgi veriniz; teknik aktivite girebilmek için müşterinin faz bilgisi olmalıdır.';

type ActivityType = typeof AKTIVITE_TIPLERI[number];
type PhaseStatus = typeof FAZ_DURUMLARI[number];
type WaitingSide = typeof BEKLEYEN_TARAFLAR[number];

function isTechnicalActivityType(value: string | null | undefined) {
  return TECHNICAL_ACTIVITY_TYPES.includes(value as typeof TECHNICAL_ACTIVITY_TYPES[number]);
}

function canCreateTechnicalActivity(role: string | null | undefined) {
  return role === 'itsm' || role === 'admin' || role === 'super_admin';
}

function normalizeTr(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

function normalizeTrAscii(value: string | null | undefined) {
  return normalizeTr(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function isPhaseOptionalCustomer(customer: Customer | null) {
  if (!customer) return false;
  // Faz muafiyeti backend'de Parametreler / CRM / Faz İstemeyecek Sorumlular
  // listesine göre hesaplanır. İş ortağı/yemek kartı gibi müşteri tipi tek başına
  // muafiyet yaratmaz.
  return Boolean(customer.report_only);
}

function coercePhaseStatus(value: string | null | undefined): PhaseStatus {
  const raw = String(value ?? '').trim();
  if (raw === 'Tamamlandı') return 'Tamamlandı';
  if (raw === 'İhtiyaç Duyulmadı' || raw === 'İhtiyaç duyulmadı') return 'İhtiyaç Duyulmadı';
  if (raw === 'Başlamadı') return 'Başlamadı';
  return 'Devam Ediyor';
}

export default function QuickActivityClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = (searchParams.get('edit') || '').trim();
  
  const [me, setMe] = useState<Me | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);
  const [fazlar, setFazlar] = useState<Faz[]>([]);
  const [partnerFazlar, setPartnerFazlar] = useState<Faz[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [musteriId, setMusteriId] = useState('');
  const [aktiviteTipi, setAktiviteTipi] = useState<ActivityType>('Online Toplantı');
  const [fazNo, setFazNo] = useState<number | null>(null);
  const [fazDurum, setFazDurum] = useState<PhaseStatus>('Devam Ediyor');
  const [bekleyenTaraf, setBekleyenTaraf] = useState<WaitingSide | ''>('');
  const [notlar, setNotlar] = useState('');
  
  const [sonrakiAksiyonVar, setSonrakiAksiyonVar] = useState(true);
  const [sonrakiTarih, setSonrakiTarih] = useState('');
  const [sonrakiTip, setSonrakiTip] = useState<ActivityType>('Online Toplantı');
  const [sonrakiNot, setSonrakiNot] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editReady, setEditReady] = useState(false);
  const [phaseMetaLoading, setPhaseMetaLoading] = useState(false);

  const canCreateTechnical = canCreateTechnicalActivity(me?.role);
  const visibleActivityTypes = useMemo(() => {
    return AKTIVITE_TIPLERI.filter((tip) => !isTechnicalActivityType(tip) || canCreateTechnical);
  }, [canCreateTechnical]);
  const visibleNextActivityTypes = useMemo(() => visibleActivityTypes.filter((tip) => !isTechnicalActivityType(tip)), [visibleActivityTypes]);
  const isTechnicalActivity = isTechnicalActivityType(aktiviteTipi);

  const selectedCustomer = useMemo(
    () => customers.find(c => c.musteri_id === musteriId) || null,
    [customers, musteriId]
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const [meRes, customersRes, fazRes, partnerFazRes] = await Promise.all([
          fetch('/api/me', { cache: 'no-store' }),
          fetch('/api/activities/customers?all=1&limit=5000', { cache: 'no-store' }),
          fetch('/api/faz/list', { cache: 'no-store' }),
          fetch('/api/faz/list?type=business-partner', { cache: 'no-store' })
        ]);

        if (meRes.ok) {
          const data = await meRes.json();
          setMe(data.me || null);
        }

        if (customersRes.ok) {
          const data = await customersRes.json();
          setCustomers(data.rows || []);
        }

        if (fazRes.ok) {
          const data = await fazRes.json();
          setFazlar((data.fazlar || []).sort((a: Faz, b: Faz) => a.faz_no - b.faz_no));
        }

        if (partnerFazRes.ok) {
          const data = await partnerFazRes.json();
          setPartnerFazlar((data.fazlar || []).sort((a: Faz, b: Faz) => a.faz_no - b.faz_no));
        }
      } catch (err) {
        console.error('Data yükleme hatası:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    let cancelled = false;
    const loadCustomers = async () => {
      setCustomerLoading(true);
      try {
        const params = new URLSearchParams({ all: '1', limit: debouncedCustomerSearch ? '5000' : '5000' });
        if (debouncedCustomerSearch) params.set('q', debouncedCustomerSearch);
        if (musteriId) params.set('id', musteriId);
        const res = await fetch(`/api/activities/customers?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setCustomers(data.rows || []);
      } finally {
        if (!cancelled) setCustomerLoading(false);
      }
    };
    void loadCustomers();
    return () => { cancelled = true; };
  }, [debouncedCustomerSearch, musteriId]);

  useEffect(() => {
    if (!visibleActivityTypes.includes(aktiviteTipi)) {
      setAktiviteTipi(visibleActivityTypes[0] ?? 'Online Toplantı');
    }
    if (!visibleNextActivityTypes.includes(sonrakiTip)) {
      setSonrakiTip(visibleNextActivityTypes[0] ?? 'Online Toplantı');
    }
  }, [aktiviteTipi, sonrakiTip, visibleActivityTypes, visibleNextActivityTypes]);

  useEffect(() => {
    if (editId) return;
    const preferredFaz = selectedCustomer?.son_kalinan_faz_no ?? selectedCustomer?.aktif_faz_no ?? null;
    setFazNo(preferredFaz != null ? Number(preferredFaz) : null);
  }, [selectedCustomer, editId]);

  useEffect(() => {
    if (!isTechnicalActivity) return;
    setSonrakiAksiyonVar(false);
    const preferredFaz = selectedCustomer?.son_kalinan_faz_no ?? selectedCustomer?.aktif_faz_no ?? null;
    setFazNo(preferredFaz != null ? Number(preferredFaz) : null);
    if (selectedCustomer?.son_kalinan_faz_durumu) {
      setFazDurum(coercePhaseStatus(selectedCustomer.son_kalinan_faz_durumu));
    }
  }, [isTechnicalActivity, selectedCustomer]);

  const isBusinessPartnerCustomer = Boolean(selectedCustomer?.is_business_partner);
  const phaseOptionalCustomer = isPhaseOptionalCustomer(selectedCustomer);
  const phaseOptions = isBusinessPartnerCustomer ? partnerFazlar : fazlar;
  const phaseOptionalTechnicalCustomer = isTechnicalActivity && phaseOptionalCustomer;

  useEffect(() => {
    if (!musteriId || fazNo == null) return;
    let cancelled = false;
    const loadPhaseMeta = async () => {
      setPhaseMetaLoading(true);
      try {
        const res = await fetch(`/api/activities/meta?musteri_id=${encodeURIComponent(musteriId)}&faz_no=${encodeURIComponent(String(fazNo))}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          if (data?.durum) setFazDurum(coercePhaseStatus(data.durum));
          if (data?.partner_owner) setBekleyenTaraf(data.partner_owner as WaitingSide);
        }
      } finally {
        if (!cancelled) setPhaseMetaLoading(false);
      }
    };
    void loadPhaseMeta();
    return () => {
      cancelled = true;
    };
  }, [musteriId, fazNo]);

  useEffect(() => {
    if (!editId) {
      setEditReady(true);
      return;
    }

    let cancelled = false;

    const loadEditRecord = async () => {
      setEditLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/activities/detail?activity_id=${encodeURIComponent(editId)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.row) {
          throw new Error(data?.message || 'Aktivite detayı alınamadı');
        }
        if (cancelled) return;

        const row = data.row;
        setMusteriId(String(row.musteri_id ?? ''));
        setFazNo(row.faz_no != null ? Number(row.faz_no) : null);
        setAktiviteTipi(((row.activity_label || 'Diğer') as ActivityType));
        setFazDurum(coercePhaseStatus(row.activity_status || 'Devam Ediyor'));
        setBekleyenTaraf(((row.partner_owner || '') as WaitingSide | ''));
        setNotlar(String(row.notlar ?? ''));
        setSonrakiAksiyonVar(false);
        setSonrakiTarih('');
        setSonrakiTip('Online Toplantı');
        setSonrakiNot('');
        setEditReady(true);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Aktivite yüklenemedi');
          setEditReady(true);
        }
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    };

    void loadEditRecord();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const technicalMissingPhase = isTechnicalActivity && !phaseOptionalTechnicalCustomer && !fazNo;

  useEffect(() => {
    if (phaseOptionalCustomer) {
      setSonrakiAksiyonVar(false);
      setFazNo(null);
      setBekleyenTaraf('');
    }
  }, [phaseOptionalCustomer]);

  const isValid = useMemo(() => {
    if (!editReady || !musteriId || !aktiviteTipi || !notlar.trim()) {
      return false;
    }
    if (!isTechnicalActivity && !phaseOptionalCustomer && (fazNo === null || !fazDurum || !bekleyenTaraf)) {
      return false;
    }
    if (isTechnicalActivity && !phaseOptionalTechnicalCustomer && (fazNo === null || !fazDurum || !bekleyenTaraf)) {
      return false;
    }
    if (isTechnicalActivity && !canCreateTechnical) return false;
    if (!phaseOptionalCustomer && sonrakiAksiyonVar && (!sonrakiTarih || !sonrakiTip || isTechnicalActivityType(sonrakiTip))) {
      return false;
    }
    return true;
  }, [editReady, musteriId, aktiviteTipi, fazNo, fazDurum, bekleyenTaraf, notlar, isTechnicalActivity, phaseOptionalCustomer, phaseOptionalTechnicalCustomer, canCreateTechnical, sonrakiAksiyonVar, sonrakiTarih, sonrakiTip]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (technicalMissingPhase) {
      setError(isBusinessPartnerCustomer ? 'Bu iş ortağı için faz bulunamadı. Accountlara haber veriniz.' : TECHNICAL_PHASE_REQUIRED_MESSAGE);
      return;
    }
    if (!isValid || saving) return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        ...(editId ? { activity_id: editId } : {}),
        musteri_id: musteriId,
        faz_no: fazNo,
        kanal: aktiviteTipi,
        faz_durum: fazDurum,
        bekleyen_taraf: bekleyenTaraf,
        notlar: notlar.trim(),
        ...(!isTechnicalActivity && !phaseOptionalCustomer && sonrakiAksiyonVar && {
          plan: {
            hedef_tarihi: sonrakiTarih,
            hedef_aktivite: sonrakiTip,
            hedef_not: sonrakiNot.trim(),
            hedef_faz_no: fazNo,
          }
        })
      };

      const res = await fetch('/api/activities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Sunucudan beklenmeyen cevap geldi. Aktivite kayıt endpointi JSON dönmüyor.');
      }

      if (!res.ok) {
        throw new Error(data.message || 'Kayıt başarısız');
      }

      router.refresh();
      router.replace('/crm/activities');
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu');
      setSaving(false);
    }
  };

  if (loading || editLoading) {
    return (
      <div className="pax-page-container">
        <div className="pax-card pax-loading" style={{ padding: 60, textAlign: 'center' }}>
{editId ? 'Aktivite yükleniyor...' : 'Yükleniyor...'}
        </div>
      </div>
    );
  }

  return (
    <>
      {editId ? (
        <div className="pax-card" style={{ marginBottom: 16, padding: 16, background: 'var(--surface-2)' }}>
          <strong>Düzenleme modu</strong> · Seçilen aktivite güncellenecek.
        </div>
      ) : null}
      <form onSubmit={handleSubmit}>
        <div className="pax-card" style={{ display: 'grid', gap: 20 }}>
          {error && (
            <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: 14 }}>
              {error}
            </div>
          )}

          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Müşteri *</label>
            <input
              type="search"
              className="pax-input"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Müşteri / iş ortağı ara..."
              style={{ width: '100%', minHeight: 44, fontSize: 15, marginBottom: 8 }}
            />
            <select
              value={musteriId}
              onChange={(e) => {
                const nextMusteriId = e.target.value;
                setMusteriId(nextMusteriId);
                if (!editId) {
                  const nextCustomer = customers.find(c => c.musteri_id === nextMusteriId) || null;
                  const preferredFaz = nextCustomer?.son_kalinan_faz_no ?? nextCustomer?.aktif_faz_no ?? null;
                  setFazNo(preferredFaz != null ? Number(preferredFaz) : null);
                }
              }}
              className="pax-input"
              required
              style={{ width: '100%', minHeight: 48, fontSize: 16 }}
            >
              <option value="">{customerLoading ? 'Müşteriler aranıyor...' : 'Müşteri seçin...'}</option>
              {customers.map(c => (
                <option key={c.musteri_id} value={c.musteri_id}>{c.musteri} {c.sorumlu && `(${c.sorumlu})`}</option>
              ))}
            </select>
            {customerSearch && !customerLoading && customers.length === 0 ? (
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)' }}>Sonuç bulunamadı. Müşteri adı, sorumlu veya sektörle tekrar deneyin.</div>
            ) : null}
            {selectedCustomer && (
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>Sorumlu: {selectedCustomer.sorumlu || 'Atanmadı'}</span>
                {(selectedCustomer.son_kalinan_faz_no ?? selectedCustomer.aktif_faz_no) != null && (
                  <span>Faz: {selectedCustomer.son_kalinan_faz_no ?? selectedCustomer.aktif_faz_no} - {selectedCustomer.son_kalinan_faz_adi ?? selectedCustomer.aktif_faz_adi ?? 'Faz adı yok'}</span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Aktivite Tipi *</label>
            <select value={aktiviteTipi} onChange={(e) => setAktiviteTipi(e.target.value as ActivityType)} className="pax-input" required style={{ width: '100%', minHeight: 48, fontSize: 16 }}>
              {visibleActivityTypes.map(tip => <option key={tip} value={tip}>{tip}</option>)}
            </select>
          </div>

          {technicalMissingPhase && (
            <div style={{ padding: 14, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-md)', color: '#9a3412', fontSize: 14 }}>
              {isBusinessPartnerCustomer ? 'Bu iş ortağı için faz bulunamadı. Accountlara haber veriniz.' : TECHNICAL_PHASE_REQUIRED_MESSAGE}
            </div>
          )}

          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Faz {phaseOptionalCustomer ? '' : '*'} {isTechnicalActivity && !phaseOptionalCustomer ? '(otomatik / değiştirilemez)' : ''}</label>
            <select value={fazNo || ''} onChange={(e) => setFazNo(e.target.value ? Number(e.target.value) : null)} className="pax-input" required={!phaseOptionalCustomer} disabled={isTechnicalActivity || phaseOptionalCustomer} style={{ width: '100%', minHeight: 48, fontSize: 16, opacity: (isTechnicalActivity || phaseOptionalCustomer) ? 0.75 : 1 }}>
              <option value="">Faz seçin...</option>
              {phaseOptions.map(f => <option key={f.faz_no} value={f.faz_no}>{f.faz_no} - {f.asama_adi}</option>)}
            </select>
          </div>

          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Faz Durum {phaseOptionalCustomer ? '' : '*'} {isTechnicalActivity && !phaseOptionalCustomer ? '(otomatik / değiştirilemez)' : ''}</label>
            <select value={fazDurum} onChange={(e) => setFazDurum(e.target.value as PhaseStatus)} className="pax-input" required={!phaseOptionalCustomer} disabled={isTechnicalActivity || phaseOptionalCustomer} style={{ width: '100%', minHeight: 48, fontSize: 16, opacity: (isTechnicalActivity || phaseOptionalCustomer) ? 0.75 : 1 }}>
              {FAZ_DURUMLARI.map(durum => <option key={durum} value={durum}>{durum}</option>)}
            </select>
          </div>

          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Bekleyen Taraf {phaseOptionalCustomer ? '' : '*'} {isTechnicalActivity && !phaseOptionalCustomer ? '(otomatik / değiştirilemez)' : ''}</label>
            <select value={bekleyenTaraf} onChange={(e) => setBekleyenTaraf(e.target.value as WaitingSide)} className="pax-input" required={!phaseOptionalCustomer} disabled={isTechnicalActivity || phaseOptionalCustomer} style={{ width: '100%', minHeight: 48, fontSize: 16, opacity: (isTechnicalActivity || phaseOptionalCustomer) ? 0.75 : 1 }}>
              <option value="">Seçin...</option>
              {BEKLEYEN_TARAFLAR.map(taraf => <option key={taraf} value={taraf}>{taraf}</option>)}
            </select>
            {phaseMetaLoading && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>Faz bilgileri alınıyor...</div>}
          </div>

          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Notlar *</label>
            <textarea value={notlar} onChange={(e) => setNotlar(e.target.value)} className="pax-input" required rows={4} placeholder="Görüşme notlarını buraya yazın..." style={{ width: '100%', minHeight: 120, fontSize: 16, resize: 'vertical', padding: 12 }} />
          </div>

          {!isTechnicalActivity && !phaseOptionalCustomer && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>
                <input type="checkbox" checked={sonrakiAksiyonVar} onChange={(e) => setSonrakiAksiyonVar(e.target.checked)} style={{ width: 20, height: 20, cursor: 'pointer' }} />
                Sonraki aksiyon planla
              </label>
            </div>
          )}

          {!isTechnicalActivity && !phaseOptionalCustomer && sonrakiAksiyonVar && (
            <div style={{ display: 'grid', gap: 16, padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Tarih *</label>
                <input type="date" value={sonrakiTarih} onChange={(e) => setSonrakiTarih(e.target.value)} className="pax-input" required={sonrakiAksiyonVar} style={{ width: '100%', minHeight: 48, fontSize: 16 }} />
              </div>
              <div>
                <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Aktivite Tipi *</label>
                <select value={sonrakiTip} onChange={(e) => setSonrakiTip(e.target.value as ActivityType)} className="pax-input" required={sonrakiAksiyonVar} style={{ width: '100%', minHeight: 48, fontSize: 16 }}>
                  {visibleNextActivityTypes.map(tip => <option key={tip} value={tip}>{tip}</option>)}
                </select>
              </div>
              <div>
                <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Not (Opsiyonel)</label>
                <textarea value={sonrakiNot} onChange={(e) => setSonrakiNot(e.target.value)} className="pax-input" rows={2} placeholder="Sonraki aksiyonla ilgili not..." style={{ width: '100%', fontSize: 16, resize: 'vertical', padding: 12 }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <Link href="/crm/activities" className="pax-btn pax-btn-secondary" style={{ flex: 1 }}>İptal</Link>
            <button type="submit" disabled={!isValid || saving || technicalMissingPhase} className="pax-btn pax-btn-primary" style={{ flex: 2 }}>
{saving ? 'Kaydediliyor...' : editId ? '💾 Güncelle' : '💾 Kaydet'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
