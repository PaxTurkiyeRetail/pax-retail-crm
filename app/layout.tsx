import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppRuntimeShell from '@/components/AppRuntimeShell';

export const metadata: Metadata = {
  title: 'PAX CRM',
  description: 'Kurumsal CRM paneli',
  applicationName: 'PAX CRM',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PAX CRM',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
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
