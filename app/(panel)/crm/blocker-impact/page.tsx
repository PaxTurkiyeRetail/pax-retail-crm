import { requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import BlockerImpactClient from '@/components/blocker-impact/BlockerImpactClient';

export default async function BlockerImpactPage() {
  await requirePermissionOrThrow('forecast.read');
  await requireScreenAccessOrThrow('screen.crm.blocker_impact.view');
  return (
    <div className="pax-page-container">
      <BlockerImpactClient />
    </div>
  );
}
