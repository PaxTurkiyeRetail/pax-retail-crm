import { requireCrmAccessOrThrow } from '@/lib/authz';
import CustomerStatusGuideClient from '@/components/system/CustomerStatusGuideClient';

export default async function CustomerStatusGuidePage() {
  await requireCrmAccessOrThrow();
  return <div style={{ display: 'grid', gap: 16 }}><CustomerStatusGuideClient /></div>;
}
