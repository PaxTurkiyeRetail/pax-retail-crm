'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Customer = {
  musteri_id: string;
  musteri: string;
  sorumlu: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
};

type Faz = {
  faz_no: number;
  asama_adi: string;
};

const AKTIVITE_TIPLERI = [
  'Online Toplantı',
  'Yerinde Ziyaret',
  'Telefon',
  'E-posta',
  'Teknik Ziyaret',
  'Teknik Online',
  'Diğer'
] as const;

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

export default function QuickActivityClient() {
  const router = useRouter();
  
  // Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fazlar, setFazlar] = useState<Faz[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [musteriId, setMusteriId] = useState('');
  const [aktiviteTipi, setAktiviteTipi] = useState<typeof AKTIVITE_TIPLERI[number]>('Online Toplantı');
  const [fazNo, setFazNo] = useState<number | null>(null);
  const [fazDurum, setFazDurum] = useState<typeof FAZ_DURUMLARI[number]>('Devam Ediyor');
  const [bekleyenTaraf, setBekleyenTaraf] = useState<typeof BEKLEYEN_TARAFLAR[number] | ''>('');
  const [notlar, setNotlar] = useState('');
  
  // Sonraki Aksiyon
  const [sonrakiAksiyonVar, setSonrakiAksiyonVar] = useState(true);
  const [sonrakiTarih, setSonrakiTarih] = useState('');
  const [sonrakiTip, setSonrakiTip] = useState<typeof AKTIVITE_TIPLERI[number]>('Online Toplantı');
  const [sonrakiNot, setSonrakiNot] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Selected customer
  const selectedCustomer = useMemo(
    () => customers.find(c => c.musteri_id === musteriId) || null,
    [customers, musteriId]
  );

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersRes, fazRes] = await Promise.all([
          fetch('/api/crm/list?lite=1&pageSize=5000'),
          fetch('/api/faz/list')
        ]);

        if (customersRes.ok) {
          const data = await customersRes.json();
          setCustomers(data.rows || []);
        }

        if (fazRes.ok) {
          const data = await fazRes.json();
          setFazlar((data.fazlar || []).sort((a: Faz, b: Faz) => a.faz_no - b.faz_no));
        }
      } catch (err) {
        console.error('Data yükleme hatası:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Auto-set faz when customer selected
  useEffect(() => {
    if (selectedCustomer?.aktif_faz_no) {
      setFazNo(selectedCustomer.aktif_faz_no);
    }
  }, [selectedCustomer]);

  // Validation
  const isValid = useMemo(() => {
    if (!musteriId || !aktiviteTipi || fazNo === null || !fazDurum || !bekleyenTaraf || !notlar.trim()) {
      return false;
    }
    
    if (sonrakiAksiyonVar && (!sonrakiTarih || !sonrakiTip)) {
      return false;
    }
    
    return true;
  }, [musteriId, aktiviteTipi, fazNo, fazDurum, bekleyenTaraf, notlar, sonrakiAksiyonVar, sonrakiTarih, sonrakiTip]);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || saving) return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        musteri_id: musteriId,
        faz_no: fazNo,
        kanal: aktiviteTipi,
        faz_durum: fazDurum,
        bekleyen_taraf: bekleyenTaraf,
        notlar: notlar.trim(),
        ...(sonrakiAksiyonVar && {
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

      // Success - redirect
      router.push('/crm/activities');
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pax-page-container">
        <div className="pax-card pax-loading" style={{ padding: 60, textAlign: 'center' }}>
          Yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="pax-card" style={{ display: 'grid', gap: 20 }}>
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

          {/* Müşteri */}
          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
              Müşteri *
            </label>
            <select
              value={musteriId}
              onChange={(e) => setMusteriId(e.target.value)}
              className="pax-input"
              required
              style={{ 
                width: '100%',
                minHeight: 48,
                fontSize: 16 // Mobile-friendly
              }}
            >
              <option value="">Müşteri seçin...</option>
              {customers.map(c => (
                <option key={c.musteri_id} value={c.musteri_id}>
                  {c.musteri} {c.sorumlu && `(${c.sorumlu})`}
                </option>
              ))}
            </select>
            
            {selectedCustomer && (
              <div style={{ 
                marginTop: 8, 
                fontSize: 13, 
                color: 'var(--text-3)',
                display: 'flex',
                gap: 12
              }}>
                <span>Sorumlu: {selectedCustomer.sorumlu || 'Atanmadı'}</span>
                {selectedCustomer.aktif_faz_adi && (
                  <span>Faz: {selectedCustomer.aktif_faz_no} - {selectedCustomer.aktif_faz_adi}</span>
                )}
              </div>
            )}
          </div>

          {/* Aktivite Tipi */}
          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
              Aktivite Tipi *
            </label>
            <select
              value={aktiviteTipi}
              onChange={(e) => setAktiviteTipi(e.target.value as typeof AKTIVITE_TIPLERI[number])}
              className="pax-input"
              required
              style={{ 
                width: '100%',
                minHeight: 48,
                fontSize: 16
              }}
            >
              {AKTIVITE_TIPLERI.map(tip => (
                <option key={tip} value={tip}>{tip}</option>
              ))}
            </select>
          </div>

          {/* Faz */}
          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
              Faz *
            </label>
            <select
              value={fazNo || ''}
              onChange={(e) => setFazNo(e.target.value ? Number(e.target.value) : null)}
              className="pax-input"
              required
              style={{ 
                width: '100%',
                minHeight: 48,
                fontSize: 16
              }}
            >
              <option value="">Faz seçin...</option>
              {fazlar.map(f => (
                <option key={f.faz_no} value={f.faz_no}>
                  {f.faz_no} - {f.asama_adi}
                </option>
              ))}
            </select>
          </div>

          {/* Faz Durum */}
          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
              Faz Durum *
            </label>
            <select
              value={fazDurum}
              onChange={(e) => setFazDurum(e.target.value as typeof FAZ_DURUMLARI[number])}
              className="pax-input"
              required
              style={{ 
                width: '100%',
                minHeight: 48,
                fontSize: 16
              }}
            >
              {FAZ_DURUMLARI.map(durum => (
                <option key={durum} value={durum}>{durum}</option>
              ))}
            </select>
          </div>

          {/* Bekleyen Taraf */}
          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
              Bekleyen Taraf *
            </label>
            <select
              value={bekleyenTaraf}
              onChange={(e) => setBekleyenTaraf(e.target.value as typeof BEKLEYEN_TARAFLAR[number])}
              className="pax-input"
              required
              style={{ 
                width: '100%',
                minHeight: 48,
                fontSize: 16
              }}
            >
              <option value="">Seçin...</option>
              {BEKLEYEN_TARAFLAR.map(taraf => (
                <option key={taraf} value={taraf}>{taraf}</option>
              ))}
            </select>
          </div>

          {/* Notlar */}
          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
              Notlar *
            </label>
            <textarea
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              className="pax-input"
              required
              rows={4}
              placeholder="Görüşme notlarını buraya yazın..."
              style={{ 
                width: '100%',
                minHeight: 120,
                fontSize: 16,
                resize: 'vertical',
                padding: 12
              }}
            />
          </div>

          {/* Sonraki Aksiyon Toggle */}
          <div style={{ 
            borderTop: '1px solid var(--border)',
            paddingTop: 20,
            marginTop: 10
          }}>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600
            }}>
              <input
                type="checkbox"
                checked={sonrakiAksiyonVar}
                onChange={(e) => setSonrakiAksiyonVar(e.target.checked)}
                style={{ 
                  width: 20,
                  height: 20,
                  cursor: 'pointer'
                }}
              />
              Sonraki aksiyon planla
            </label>
          </div>

          {/* Sonraki Aksiyon Alanları */}
          {sonrakiAksiyonVar && (
            <div style={{ 
              display: 'grid', 
              gap: 16,
              padding: 16,
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div>
                <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                  Tarih *
                </label>
                <input
                  type="date"
                  value={sonrakiTarih}
                  onChange={(e) => setSonrakiTarih(e.target.value)}
                  className="pax-input"
                  required={sonrakiAksiyonVar}
                  style={{ 
                    width: '100%',
                    minHeight: 48,
                    fontSize: 16
                  }}
                />
              </div>

              <div>
                <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                  Aktivite Tipi *
                </label>
                <select
                  value={sonrakiTip}
                  onChange={(e) => setSonrakiTip(e.target.value as typeof AKTIVITE_TIPLERI[number])}
                  className="pax-input"
                  required={sonrakiAksiyonVar}
                  style={{ 
                    width: '100%',
                    minHeight: 48,
                    fontSize: 16
                  }}
                >
                  {AKTIVITE_TIPLERI.map(tip => (
                    <option key={tip} value={tip}>{tip}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>
                  Not (Opsiyonel)
                </label>
                <textarea
                  value={sonrakiNot}
                  onChange={(e) => setSonrakiNot(e.target.value)}
                  className="pax-input"
                  rows={2}
                  placeholder="Sonraki aksiyonla ilgili not..."
                  style={{ 
                    width: '100%',
                    fontSize: 16,
                    resize: 'vertical',
                    padding: 12
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            paddingTop: 12,
            borderTop: '1px solid var(--border)'
          }}>
            <Link 
              href="/crm/activities" 
              className="pax-btn pax-btn-secondary"
              style={{ flex: 1 }}
            >
              İptal
            </Link>
            <button
              type="submit"
              disabled={!isValid || saving}
              className="pax-btn pax-btn-primary"
              style={{ flex: 2 }}
            >
              {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
