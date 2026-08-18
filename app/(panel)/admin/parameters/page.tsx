import { requireSystemParametersAccessOrThrow } from '@/lib/authz';
import ParametersClient from './ParametersClient';

export default async function ParametersPage() {
  await requireSystemParametersAccessOrThrow();

  return (
    <div className="pax-page-container">
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Kurumsal CRM · Ayarlar</span>
        <h1 className="pax-hero-title">Parametre Yönetimi</h1>
        <p className="pax-hero-description">
          Bu ekran yalnızca parametre yönetimi yetkisi bulunan kullanıcılara görünür. Sistem Ayarları, Entegrasyonlar, Liste Yönetimleri ve Güvenlik/Tanı ayrı kartlarla yönetilir; künye seçenekleri Liste Yönetimleri → Müşteri Künye alt kırılımında düzenlenir.
        </p>
      </div>
      <ParametersClient />
    </div>
  );
}
