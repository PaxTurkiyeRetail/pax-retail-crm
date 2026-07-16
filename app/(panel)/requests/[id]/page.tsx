import { redirect } from 'next/navigation';

export default function RequestsDisabledPage() {
  redirect('/crm');
}
