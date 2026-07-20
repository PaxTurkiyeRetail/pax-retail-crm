import { requireCrmAccessOrThrow } from '@/lib/authz';
import BlockerImpactClient from '@/components/blocker-impact/BlockerImpactClient';

export default async function BlockerImpactPage() {
  await requireCrmAccessOrThrow();
  return (
    <div className="pax-page-container">
      <BlockerImpactClient />
    </div>
  );
}
