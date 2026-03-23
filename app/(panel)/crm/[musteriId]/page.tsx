'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import QuickKunyeForm from '@/components/kunye/QuickKunyeForm';
import KunyeDashboard from '@/components/kunye/KunyeDashboard';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';

type Customer = {
  id: string;
  musteri: string;
  sektor: string | null;
  sorumlu: string | null;
  aktif_faz_no?: number | null;
  aktif_faz_adi?: string | null;
};

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
          fetch(`/api/crm/detail?id=${musteriId}`),
          fetch(`/api/kunye?musteriId=${musteriId}`)
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

  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="customerDetail" />

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
    </div>
  );
}
