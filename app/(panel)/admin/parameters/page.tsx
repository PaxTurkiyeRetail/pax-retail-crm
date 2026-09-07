import { requireSystemParametersAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import ParametersClient from './ParametersClient';
import ActivityTypeAccessPanel from './ActivityTypeAccessPanel';

export default async function ParametersPage() {
  await requireSystemParametersAccessOrThrow();
  await requireScreenAccessOrThrow('screen.admin.parameters.view');

  return (
    <div className="pax-page-container">
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Kurumsal CRM · Ayarlar</span>
        <h1 className="pax-hero-title">Parametre Yönetimi</h1>
        <p className="pax-hero-description">
          Bir ayarı arayın veya ilgili alanı seçin. Müşteri ve iş ortağı fazları kendi gruplarında yönetilir.
        </p>
      </div>
      <ActivityTypeAccessPanel />
      <ParametersClient />
    </div>
  );
}
