'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { appToast } from '@/lib/app-toast';

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/crm';
  if (!value.startsWith('/crm')) return '/crm';
  return value;
}

export default function LoginClient() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get('next')), [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

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

      // Set-Cookie yanıtının tarayıcı tarafından kabul edildiğini doğrula.
      const sessionCheck = await fetch('/api/me', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });

      if (!sessionCheck.ok) {
        setError('Oturum çerezi oluşturulamadı. Adresin HTTP/HTTPS ve AUTH_COOKIE_SECURE ayarını kontrol edin.');
        return;
      }

      appToast.success('Giriş sağlandı', 'Yönlendiriliyorsun.');
      window.location.replace(nextPath);
    } catch (caught) {
      console.error('Login request failed:', caught);
      setError('Beklenmeyen bir bağlantı hatası oluştu.');
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
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          style={{ padding: 12, border: '1px solid #ccc', borderRadius: 8 }}
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          style={{ padding: 12, border: '1px solid #ccc', borderRadius: 8 }}
        />
        {error ? <p role="alert" style={{ color: '#c00' }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={{ padding: 12, borderRadius: 8 }}>
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
        <a href="/forgot-password" style={{ fontSize: 14 }}>Şifremi unuttum</a>
      </form>
    </main>
  );
}
