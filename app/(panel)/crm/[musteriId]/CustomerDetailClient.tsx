'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import QuickKunyeForm from '@/components/kunye/QuickKunyeForm';
import KunyeDashboard from '@/components/kunye/KunyeDashboard';
import TechnicalContactsPanel from '@/components/kunye/TechnicalContactsPanel';
import CompanyRelationshipsPanel from '@/components/kunye/CompanyRelationshipsPanel';

type Customer = {
  id: string;
  musteri: string;
  sektor: string | null;
  sorumlu: string | null;
  aktif_faz_no?: number | null;
  aktif_faz_adi?: string | null;
  customer_type?: string | null;
  is_ortagi_tipi?: string | null;
  has_customer_role?: boolean;
  has_business_partner_role?: boolean;
  partner_subtype?: string | null;
  customer_phase_no?: number | null;
  customer_phase_status?: string | null;
  partner_phase_no?: number | null;
  partner_phase_status?: string | null;
};

export default function CustomerDetailPage() {
  const params = useParams();
  const musteriId = params.musteriId as string;
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [kunye, setKunye] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Müşteri + künye verisi. Künye formu kaydedilince ve İş Kolu rozetten
  // değiştirilince yeniden çağrılır: üstteki kart ile alttaki form aynı değeri gösterir.
  const loadData = useCallback(async () => {
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
  }, [musteriId]);

  useEffect(() => { void loadData(); }, [loadData]);

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
      <div className="detail-actions" aria-label="Firma işlemleri">
        <style jsx>{`
          .detail-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
          .action-group { display: flex; gap: 9px; flex-wrap: wrap; }
          .action-link { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); color: var(--text-2); text-decoration: none; font-size: 13px; font-weight: 850; box-shadow: var(--shadow-sm); }
          .action-link.primary { color: white; border-color: transparent; background: linear-gradient(135deg, var(--accent), #7c3aed); }
          @media (max-width: 720px) { .detail-actions { align-items: stretch; display: grid; } .action-group { display: grid; grid-template-columns: 1fr; } .action-link { width: 100%; } }
        `}</style>
        <Link className="action-link" href="/crm/customers">← Firma Listesine Dön</Link>
        <div className="action-group">
          <Link className="action-link primary" href={`/crm/activities/new?customer_id=${encodeURIComponent(customer.id)}`}>+ Müşteri Aktivitesi</Link>
          {customer.has_business_partner_role ? <Link className="action-link" href={`/crm/activities/new?customer_id=${encodeURIComponent(customer.id)}&activity_type=${encodeURIComponent('İş Ortaklığı Aktivitesi')}`}>+ İş Ortaklığı Aktivitesi</Link> : null}
        </div>
      </div>
      {/* TEK HERO — KunyeDashboard içinde, tekrar yok */}
      <KunyeDashboard
        kunye={kunye}
        musteriAdi={customer.musteri}
        sektorVeSorumlu={[customer.sektor, customer.sorumlu ? `Sorumlu: ${customer.sorumlu}` : null].filter(Boolean).join(' • ')}
        aktifFazNo={customer.aktif_faz_no}
        musteriId={customer.id}
        customerType={customer.customer_type}
        isOrtagiTipi={customer.is_ortagi_tipi}
        hasCustomerRole={customer.has_customer_role}
        hasBusinessPartnerRole={customer.has_business_partner_role}
        partnerSubtype={customer.partner_subtype}
        customerPhaseNo={customer.customer_phase_no}
        customerPhaseStatus={customer.customer_phase_status}
        partnerPhaseNo={customer.partner_phase_no}
        partnerPhaseStatus={customer.partner_phase_status}
        onIsKoluChanged={() => void loadData()}
      />

      {/* Form */}
      <CompanyRelationshipsPanel customerId={customer.id} onChanged={() => void loadData()} />
      <TechnicalContactsPanel key={customer.id} customerId={customer.id} />
      <QuickKunyeForm
        musteriId={customer.id}
        musteriAdi={customer.musteri}
        existingData={kunye}
        onSaved={() => void loadData()}
      />
    </div>
  );
}
