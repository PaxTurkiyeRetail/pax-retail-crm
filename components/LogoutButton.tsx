'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      title={compact ? 'Çıkış' : undefined}
      style={{
        width: '100%',
        minHeight: 48,
        padding: compact ? '10px 0' : '10px 14px',
        borderRadius: 16,
        border: '1px solid #d8e1ec',
        background: '#ffffff',
        color: '#334155',
        cursor: busy ? 'not-allowed' : 'pointer',
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)',
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      {!compact ? (busy ? 'Çıkış yapılıyor...' : 'Çıkış') : null}
    </button>
  );
}
