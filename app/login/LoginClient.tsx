'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { appToast } from '@/lib/app-toast';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/crm';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
        credentials: 'same-origin',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Giriş başarısız.');
        return;
      }

      appToast.success('Giriş sağlandı', 'Yönlendiriliyorsun.');

      router.refresh();
      window.location.assign(next);
    } catch {
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 360, display: 'grid', gap: 12 }}>
        <h1>PAX CRM Giriş</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 12, border: '1px solid #ccc', borderRadius: 8 }}
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 12, border: '1px solid #ccc', borderRadius: 8 }}
        />
        {error ? <p style={{ color: '#c00' }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={{ padding: 12, borderRadius: 8 }}>
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
        <a href="/forgot-password" style={{ fontSize: 14 }}>Şifremi unuttum</a>
      </form>
    </main>
  );
}
