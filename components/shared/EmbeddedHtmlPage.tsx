type EmbeddedHtmlPageProps = {
  title: string;
  description: string;
  iframeSrc: string;
  iframeTitle: string;
  pageKey?: string;
  openInNewTabLabel?: string;
  eyebrow?: string;
  variant?: 'tailwind-card' | 'panel-card';
};

export default function EmbeddedHtmlPage({
  title,
  description,
  iframeSrc,
  iframeTitle,
  openInNewTabLabel = 'Yeni sekmede aç',
  eyebrow,
}: EmbeddedHtmlPageProps) {
  return (
    <div className="pax-page-container">
      {/* Hero Header - Standart */}
      <div className="pax-hero">
        {eyebrow && <span className="pax-hero-eyebrow">{eyebrow}</span>}
        <h1 className="pax-hero-title">{title}</h1>
        <p className="pax-hero-description">{description}</p>
      </div>

      {/* Iframe Container */}
      <div className="pax-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: 20,
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            Doküman Görüntüleyici
          </div>
          <a
            href={iframeSrc}
            target="_blank"
            rel="noreferrer"
            className="pax-btn pax-btn-secondary"
            style={{ fontSize: 13 }}
          >
            {openInNewTabLabel}
          </a>
        </div>
        <iframe 
          src={iframeSrc} 
          title={iframeTitle}
          style={{ 
            width: '100%', 
            height: 'calc(100vh - 340px)',
            minHeight: 600,
            border: 0,
            display: 'block',
            background: '#fff'
          }}
        />
      </div>
    </div>
  );
}
