import { requireAdminOrThrow } from '@/lib/authz';
import DbBackupClient from './DbBackupClient';

export default async function DbBackupPage() {
  await requireAdminOrThrow();

  return (
    <div className="pax-page-container">
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Kurumsal CRM · Yönetim</span>
        <h1 className="pax-hero-title">DB Yedeği</h1>
        <p className="pax-hero-description">
          Super Admin ve Admin kullanıcıları çalışan sistemdeki PostgreSQL veritabanının .bak yedeğini alabilir.
          Yedek varsayılan olarak C:\\pax-crm-db-backups klasörüne kaydedilir.
        </p>
      </div>
      <DbBackupClient />
    </div>
  );
}
