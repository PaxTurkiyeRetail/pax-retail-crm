import { requirePermissionOrThrow } from '@/lib/authz';
import BlockerImpactClient from '@/components/blocker-impact/BlockerImpactClient';

export default async function BlockerImpactPage() {
  await requirePermissionOrThrow('forecast.read');
  return (
    <div className="pax-page-container">
      <BlockerImpactClient />
    </div>
  );
}
