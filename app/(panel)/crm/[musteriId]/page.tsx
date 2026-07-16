'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import QuickKunyeForm from '@/components/kunye/QuickKunyeForm';
import KunyeDashboard from '@/components/kunye/KunyeDashboard';

type Customer = {
  id: string;
  musteri: string;
  sektor: string | null;
  sorumlu: string | null;
  aktif_faz_no?: number | null;
  aktif_faz_adi?: string | null;
};

function normalizeTr(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

function normalizeTrAscii(value: unknown) {
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

function isReportOnlyCustomer(customer: Customer | null) {
  if (!customer) return false;
  const sector = normalizeTrAscii(customer.sektor);
  return sector === 'is ortagi';
}

export default function CustomerDetailPage() {
  const params = useParams();
  const musteriId = params.musteriId as string;
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [kunye, setKunye] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [customerRes, kunyeRes] = await Promise.all([
          fetch(`/api/crm/detail?id=${musteriId}`, { cache: 'no-store' }),
          fetch(`/api/kunye?musteriId=${musteriId}`, { cache: 'no-store' })
        ]);
        
        if (customerRes.ok) {
          const data = await customerRes.json();
          setCustomer(data.musteri);
        }
        
        if (kunyeRes.ok) {
          const data = await kunyeRes.json();
          setKunye(data.kunye);
        }
      } catch (err) {
        console.error('Veri yükleme hatası:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [musteriId]);

  if (loading) {
    return (
      <div className="pax-page-container">
        <div className="pax-card pax-loading" style={{ padding: 60, textAlign: 'center' }}>
          Yükleniyor...
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="pax-page-container">
        <div className="pax-card" style={{ padding: 60, textAlign: 'center' }}>
          <h2 style={{ marginBottom: 16 }}>Müşteri bulunamadı</h2>
          <p style={{ color: 'var(--text-3)' }}>Bu müşteri silinmiş veya mevcut değil.</p>
        </div>
      </div>
    );
  }

  const kunyeDisabled = isReportOnlyCustomer(customer);

  return (
    <div className="pax-page-container">
      {kunyeDisabled ? (
        <section className="pax-card" style={{ padding: 24, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            Rapor Müşterisi
          </div>
          <h2 style={{ margin: 0 }}>{customer.musteri}</h2>
          <p style={{ margin: 0, color: 'var(--text-3)' }}>
            {[customer.sektor, customer.sorumlu ? `Sorumlu: ${customer.sorumlu}` : null].filter(Boolean).join(' • ')}
          </p>
        </section>
      ) : (
        <>
      {/* TEK HERO — KunyeDashboard içinde, tekrar yok */}
      <KunyeDashboard
        kunye={kunye}
        musteriAdi={customer.musteri}
        sektorVeSorumlu={[customer.sektor, customer.sorumlu ? `Sorumlu: ${customer.sorumlu}` : null].filter(Boolean).join(' • ')}
        aktifFazNo={customer.aktif_faz_no}
        musteriId={customer.id}
      />

      {/* Form */}
      <QuickKunyeForm
        musteriId={customer.id}
        musteriAdi={customer.musteri}
        existingData={kunye}
      />
        </>
      )}
    </div>
  );
}
