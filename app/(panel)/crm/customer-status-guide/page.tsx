import { requireCrmAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import CustomerStatusGuideClient from '@/components/system/CustomerStatusGuideClient';

export default async function CustomerStatusGuidePage() {
  await requireCrmAccessOrThrow();
  await requireScreenAccessOrThrow('screen.crm.customer_status_guide.view');
  return <div style={{ display: 'grid', gap: 16 }}><CustomerStatusGuideClient /></div>;
}
