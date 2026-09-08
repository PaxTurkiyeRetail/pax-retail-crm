import { requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import SalesClient from './SalesClient';

export default async function SalesPage() {
  await requirePermissionOrThrow('quote.read');
  await requireScreenAccessOrThrow('screen.crm.quotes.view');
  return <SalesClient />;
}
