import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppRuntimeShell from '@/components/AppRuntimeShell';

export const metadata: Metadata = {
  title: 'PAX CRM',
  description: 'Kurumsal CRM paneli',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AppRuntimeShell>{children}</AppRuntimeShell>
      </body>
    </html>
  );
}
