'use client';

import { useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      // Güvenlik: allowlist kontrolü
      const pre = await fetch('/api/auth/allow', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!pre.ok) {
        const j = await pre.json().catch(() => ({}));
        setMsg(j?.message || 'Bu email ile işlem yapamazsın.');
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg('Mail gönderildi. Gelen linke tıklayıp yeni şifre belirleyebilirsin.');
    } catch (e: any) {
      setMsg(e?.message || 'Beklenmeyen hata oluştu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 420, maxWidth: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Şifre Sıfırla</h1>
        <p style={{ marginTop: 8, color: '#4b5563', fontSize: 14 }}>
          Email adresini yaz, şifre sıfırlama linki gönderelim.
        </p>

        <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
              style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }}
            />
          </label>

          <button
            disabled={busy}
            type="submit"
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #111827',
              background: '#111827',
              color: 'white',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {busy ? '...' : 'Mail Gönder'}
          </button>

          {msg ? (
            <div
              style={{
                fontSize: 13,
                color: msg.startsWith('Mail') ? '#065f46' : '#b91c1c',
                background: '#f3f4f6',
                padding: 10,
                borderRadius: 10,
              }}
            >
              {msg}
            </div>
          ) : null}
        </form>

        <div style={{ marginTop: 12 }}>
          <a href="/login" style={{ fontSize: 13, color: '#111827' }}>
            Geri dön
          </a>
        </div>
      </div>
    </main>
  );
}
