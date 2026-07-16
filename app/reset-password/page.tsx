import { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>Yükleniyor...</main>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
