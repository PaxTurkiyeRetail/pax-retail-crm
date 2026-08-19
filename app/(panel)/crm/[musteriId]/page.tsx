import { requireCrmAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import CustomerDetailClient from './CustomerDetailClient';

export default async function CustomerDetailPage() {
  await requireCrmAccessOrThrow();
  await requireScreenAccessOrThrow('screen.crm.customers.view');
  return <CustomerDetailClient />;
}
