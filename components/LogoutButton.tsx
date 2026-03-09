'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LogoutButton() {
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
      style={{
        width: '100%',
        minHeight: 46,
        padding: '10px 14px',
        borderRadius: 14,
        border: '1px solid rgba(148, 163, 184, 0.2)',
        background: 'rgba(255,255,255,0.08)',
        color: 'white',
        cursor: busy ? 'not-allowed' : 'pointer',
        fontWeight: 800,
        boxShadow: '0 10px 24px rgba(2, 6, 23, 0.16)',
      }}
    >
      {busy ? '...' : 'Çıkış'}
    </button>
  );
}
