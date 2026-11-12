import Link from 'next/link';
import { requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';

export default async function QuotePdfDownloadPage({ params }: { params: Promise<{ quoteId: string }> }) {
  await requirePermissionOrThrow('quote.read');
  await requireScreenAccessOrThrow('screen.crm.quotes.view');
  const { quoteId } = await params;

  return (
    <div className="pax-page-container">
      <main style={{ display: 'grid', gap: 18 }}>
        <section className="pax-hero">
          <span className="pax-hero-eyebrow">Teklif PDF</span>
          <h1 className="pax-hero-title">PDF İndirme</h1>
          <p className="pax-hero-description">
            Bu ekrandan PAX teklif şablonuna göre hazırlanmış PDF çıktısını açabilir veya indirebilirsin.
          </p>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <a
              href={`/api/quotes/${quoteId}/pdf`}
              target="_blank"
              rel="noopener"
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
              PAX Teklif İndir
            </a>
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
              Teklif Detayına Dön
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
