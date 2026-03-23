import { requireCrmAccessOrThrow } from '@/lib/authz';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import NovaCoreClient from '@/components/nova-core/NovaCoreClient';
import type { AllowedRole } from '@/lib/roles';

export default async function NovaCorePage() {
  const user = await requireCrmAccessOrThrow();

  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="novaCore" />
      <NovaCoreClient 
        userRole={user.role as AllowedRole}
        userName={user.full_name || 'Kullanıcı'}
        userEmail={user.email || undefined}
      />
    </div>
  );
}
