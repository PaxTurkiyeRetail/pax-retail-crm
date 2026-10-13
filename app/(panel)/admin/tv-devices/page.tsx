import { requireAdminOrThrow } from '@/lib/authz';
import TvDevicesClient from './TvDevicesClient';

export default async function TvDevicesPage() {
  await requireAdminOrThrow();

  return (
    <div className="pax-page-container">
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Kurumsal CRM · Yönetim</span>
        <h1 className="pax-hero-title">TV Cihazları</h1>
        <p className="pax-hero-description">
          TV&apos;de Chrome ile <b>/tv</b> adresini açın, ekranda çıkan 6 haneli kodu buraya girin. Cihaz kullanıcı girişi olmadan
          yalnız Canlı Ekran&apos;ı görür. Gerektiğinde erişimi kapatın.
        </p>
      </div>
      <TvDevicesClient />
    </div>
  );
}
