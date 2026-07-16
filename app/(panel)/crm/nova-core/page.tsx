import { requireCrmAccessOrThrow } from '@/lib/authz';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import NovaCoreClient from '@/components/nova-core/NovaCoreClient';
import type { AllowedRole } from '@/lib/roles';
import type { UserRole } from '@/lib/nova-core-data';

function toNovaRole(role: AllowedRole): UserRole {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  if (role === 'itsm') return 'support';
  return 'sales';
}

export default async function NovaCorePage() {
  const user = await requireCrmAccessOrThrow();

  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="novaCore" />
      <NovaCoreClient 
        userRole={toNovaRole(user.role)}
        userName={user.full_name || 'Kullanıcı'}
        userEmail={user.email || undefined}
      />
    </div>
  );
}
