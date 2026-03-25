'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!token) {
      setError('Geçersiz bağlantı.');
      setLoading(false);
      return;
    }
    if (password !== password2) {
      setError('Şifreler eşleşmiyor.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Şifre güncellenemedi.');
        return;
      }
      setMessage('Şifren güncellendi. Giriş sayfasına yönlendiriliyorsun...');
      setTimeout(() => router.replace('/login'), 1200);
    } catch {
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 12 }}>
        <h1>Yeni Şifre Belirle</h1>
        <input type="password" placeholder="Yeni şifre" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ padding: 12, border: '1px solid #ccc', borderRadius: 8 }} />
        <input type="password" placeholder="Yeni şifre tekrar" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={8} style={{ padding: 12, border: '1px solid #ccc', borderRadius: 8 }} />
        {message ? <p style={{ color: '#0a7a33' }}>{message}</p> : null}
        {error ? <p style={{ color: '#c00' }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={{ padding: 12, borderRadius: 8 }}>
          {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
        </button>
      </form>
    </main>
  );
}
