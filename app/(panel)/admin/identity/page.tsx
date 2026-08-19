import { requireIdentityAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import IdentityClient from './IdentityClient';

export default async function AdminIdentityPage() {
  await requireIdentityAccessOrThrow();
  await requireScreenAccessOrThrow('screen.admin.identity.view');

  return (
    <div className="pax-page-container">
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Kurumsal CRM · Ayarlar</span>
        <h1 className="pax-hero-title">Kimlik ve Erişim Yönetimi</h1>
        <p className="pax-hero-description">
          CRM rol otoritesi yalnız AD grup üyeliğidir. Bu ekrandan hangi Entra AD grubunun
          hangi role eşlendiğini yönetin ve bir kullanıcının efektif yetkilerini AD gruplarından
          RBAC&apos;a kadar uçtan uca izleyin.
        </p>
      </div>
      <IdentityClient />
    </div>
  );
}
