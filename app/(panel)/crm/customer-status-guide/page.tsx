import { requireCrmAccessOrThrow } from '@/lib/authz';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import CustomerStatusGuideClient from '@/components/system/CustomerStatusGuideClient';

export default async function CustomerStatusGuidePage() {
  await requireCrmAccessOrThrow();
  return <div style={{ display: 'grid', gap: 16 }}><SystemRequirementStamp pageKey="customerGuide" /><CustomerStatusGuideClient /></div>;
}
