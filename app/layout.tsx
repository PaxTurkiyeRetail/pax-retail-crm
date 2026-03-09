import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM Panel',
  description: 'Supabase allowlist + admin panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto' }}>
        {children}
      </body>
    </html>
  );
}
