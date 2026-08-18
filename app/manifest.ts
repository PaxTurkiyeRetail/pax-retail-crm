import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PAX CRM',
    short_name: 'PAX CRM',
    description: 'Kurumsal müşteri ilişkileri ve talep yönetimi',
    start_url: '/crm',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f6fb',
    theme_color: '#4f46e5',
    orientation: 'any',
    icons: [
      {
        src: '/pax-logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
