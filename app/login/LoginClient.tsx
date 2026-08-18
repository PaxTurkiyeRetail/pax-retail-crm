'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { appToast } from '@/lib/app-toast';
import Image from 'next/image';

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/crm';
  const allowedPrefixes = ['/crm', '/requests', '/activities', '/admin'];
  if (!allowedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) return '/crm';
  return value;
}

export default function LoginClient({
  localLoginEnabled,
  oidcEnabled,
}: {
  localLoginEnabled: boolean;
  oidcEnabled: boolean;
}) {
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
        setError(data?.error?.message ?? data?.message ?? 'Giriş başarısız.');
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
    <main className="crm-auth-page">
      <form onSubmit={onSubmit} className="crm-auth-card">
        <div className="crm-auth-brand">
          <Image src="/pax-logo.svg" alt="PAX Türkiye" width={150} height={58} priority />
          <span>Kurumsal CRM</span>
        </div>
        <div>
          <h1>Tekrar hoş geldiniz</h1>
          <p className="crm-auth-subtitle">Müşteri, teklif ve taleplerinizi güvenli çalışma alanından yönetin.</p>
        </div>
        {localLoginEnabled ? <>
        <label htmlFor="login-email">E-posta</label>
        <input
          id="login-email"
          name="email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          className="crm-auth-input"
        />
        <label htmlFor="login-password">Şifre</label>
        <input
          id="login-password"
          name="password"
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="crm-auth-input"
        />
        {error ? <p role="alert" aria-live="polite" style={{ color: '#c00' }}>{error}</p> : null}
        <button type="submit" disabled={loading} className="crm-auth-primary">
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
        </> : null}
        {oidcEnabled && localLoginEnabled ? (
          <div className="crm-auth-divider"><span>veya</span></div>
        ) : null}
        {oidcEnabled ? (
          <a href={`/api/auth/oidc/start?next=${encodeURIComponent(nextPath)}`} className="crm-auth-secondary">
            Kurumsal Hesapla Giriş
          </a>
        ) : null}
        {localLoginEnabled ? <a href="/forgot-password" className="crm-auth-link">Şifremi unuttum</a> : null}
        <p className="crm-auth-security">Yetkisiz erişimler kayıt altına alınır. Oturum bilgilerinizi paylaşmayın.</p>
      </form>
    </main>
  );
}
