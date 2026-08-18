import { requirePermissionOrThrow } from '@/lib/authz';
import RbacClient from './RbacClient';

export default async function RbacPage() {
  await requirePermissionOrThrow('admin.rbac.manage');

  return (
    <div className="pax-page-container">
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Kurumsal CRM · Ayarlar</span>
        <h1 className="pax-hero-title">Rol ve Yetki Yönetimi</h1>
        <p className="pax-hero-description">
          Rol bazlı erişimleri burada yönetin. super_admin her zaman tüm yetkilere sahiptir ve değiştirilemez.
          Diğer roller için yetkileri açıp kapatabilirsiniz; değişiklik anında geçerli olur.
        </p>
      </div>
      <RbacClient />
    </div>
  );
}
