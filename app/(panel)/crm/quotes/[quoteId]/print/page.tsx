import Link from 'next/link';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';

export default async function QuotePdfDownloadPage({ params }: { params: Promise<{ quoteId: string }> }) {
  await requireCrmAccessOrThrow();
  const { quoteId } = await params;

  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="quotes-pdf-download" />
      <main style={{ display: 'grid', gap: 18 }}>
        <section className="pax-hero">
          <span className="pax-hero-eyebrow">Teklif PDF</span>
          <h1 className="pax-hero-title">PDF Indirme</h1>
          <p className="pax-hero-description">
            Bu ekrandan PAX teklif sablonuna gore hazirlanmis PDF ciktisini acabilir veya indirebilirsin.
          </p>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <Link
              href={`/api/quotes/${quoteId}/pdf`}
              target="_blank"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                padding: '0 18px',
                borderRadius: 14,
                background: 'white',
                color: '#1e3a8a',
                fontWeight: 900,
                textDecoration: 'none',
              }}
            >
              PAX Teklif Indir
            </Link>
            <Link
              href={`/crm/quotes/${quoteId}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                padding: '0 18px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
                color: 'white',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              Teklif Detayina Don
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
