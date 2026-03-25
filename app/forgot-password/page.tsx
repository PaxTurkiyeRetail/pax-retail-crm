'use client';

import { FormEvent, useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setResetUrl(null);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'İşlem başarısız.');
        return;
      }
      setMessage(data?.message ?? 'Bağlantı oluşturuldu.');
      setResetUrl(data?.resetUrl ?? null);
    } catch {
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 12 }}>
        <h1>Şifremi Unuttum</h1>
        <p>Email adresini gir. Geliştirme ortamında oluşturulan sıfırlama linki ekranda gösterilir.</p>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: 12, border: '1px solid #ccc', borderRadius: 8 }} />
        {message ? <p style={{ color: '#0a7a33' }}>{message}</p> : null}
        {resetUrl ? <a href={resetUrl} style={{ wordBreak: 'break-all' }}>{resetUrl}</a> : null}
        {error ? <p style={{ color: '#c00' }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={{ padding: 12, borderRadius: 8 }}>
          {loading ? 'Oluşturuluyor...' : 'Sıfırlama bağlantısı oluştur'}
        </button>
        <a href="/login">Giriş sayfasına dön</a>
      </form>
    </main>
  );
}
