import Link from 'next/link';
import { requireReportsAccessOrThrow } from '@/lib/authz';

export default async function ReportsPage() {
  await requireReportsAccessOrThrow();

  return (
    <main style={{ maxWidth: 1100, margin: '30px auto', fontFamily: 'system-ui', padding: 16 }}>
      <h1 style={{ margin: 0 }}>Raporlar</h1>
      <p style={{ marginTop: 8, color: '#4b5563', fontSize: 14 }}>
        Yönetim raporları burada listelenir.
      </p>

      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        <Link
          href="/crm/reports/management"
          style={{
            textDecoration: 'none',
            color: '#111827',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 14,
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 800 }}>Yönetim Raporu</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>No / Müşteri / Sektör / Entegrasyon / Faz / Son Aksiyon / Sorumlu / Risk / Sonraki Adım / Bekleyen Taraf</div>
        </Link>
      </div>
    </main>
  );
}
