'use client';

import { useCallback, useEffect, useState } from 'react';
import SellerFollowupClient from '@/app/(panel)/crm/reports/seller-followup/SellerFollowupClient';
import { normalizeTvScreens, type TvScreen } from '@/lib/tv-screens-shared';

// TV ekranı (kullanıcı girişi yok): eşleşmemişse kod gösterir, admin onaylayınca Dashboard'un seçili sekmeleri açılır.
type State =
  | { kind: 'loading' }
  | { kind: 'pending'; code: string; expiresAt: number }
  | { kind: 'active'; screens: TvScreen[] }
  | { kind: 'revoked' }
  | { kind: 'error'; message: string };

export default function TvPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [now, setNow] = useState(() => Date.now());

  // Durum + izinli sekmeler; aktifken sekme listesi aynıysa state'i değiştirmez (ekran yeniden kurulmasın).
  const checkStatus = useCallback(async () => {
    const res = await fetch('/api/tv/pair', { cache: 'no-store' });
    const data = await res.json();
    if (data.status === 'active') {
      const screens = normalizeTvScreens(data.screens);
      setState((prev) => (prev.kind === 'active' && prev.screens.join() === screens.join() ? prev : { kind: 'active', screens }));
    } else if (data.status === 'revoked') setState({ kind: 'revoked' });
    return data.status as string;
  }, []);

  const requestCode = useCallback(async () => {
    try {
      const res = await fetch('/api/tv/pair', { method: 'POST', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Kod alınamadı.');
      if (data.status === 'active') { await checkStatus(); return; }
      if (data.status === 'revoked') setState({ kind: 'revoked' });
      else setState({ kind: 'pending', code: data.code, expiresAt: new Date(data.expiresAt).getTime() });
    } catch (error: any) {
      setState({ kind: 'error', message: error?.message || 'Bağlantı hatası.' });
    }
  }, [checkStatus]);

  useEffect(() => { void requestCode(); }, [requestCode]);

  // Aktifken 2 dk'da bir: admin sekme değiştirdiyse/erişimi kapattıysa TV kendini günceller.
  useEffect(() => {
    if (state.kind !== 'active') return;
    const timer = setInterval(() => { void checkStatus().catch(() => {}); }, 120000);
    return () => clearInterval(timer);
  }, [state.kind, checkStatus]);

  // Bekleme: 3 sn'de bir onay kontrolü; kod süresi dolunca yenisi.
  useEffect(() => {
    if (state.kind !== 'pending') return;
    const timer = setInterval(async () => {
      setNow(Date.now());
      if (Date.now() >= state.expiresAt) { void requestCode(); return; }
      try { await checkStatus(); } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, [state, requestCode, checkStatus]);

  // Hata/iptal: 30 sn sonra tekrar dene (ağ geri gelince kendini toparlar).
  useEffect(() => {
    if (state.kind !== 'error') return;
    const timer = setTimeout(() => void requestCode(), 30000);
    return () => clearTimeout(timer);
  }, [state, requestCode]);

  if (state.kind === 'active') return <SellerFollowupClient key={state.screens.join()} tvScreens={state.screens} />;

  const box: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 24, background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24,
  };

  if (state.kind === 'pending') {
    const left = Math.max(0, Math.round((state.expiresAt - now) / 1000));
    return (
      <div style={box}>
        <div style={{ fontSize: 28, opacity: 0.8 }}>PAX CRM · Canlı Ekran</div>
        <div style={{ fontSize: 22 }}>Bu TV&apos;yi bağlamak için CRM&apos;de <b>TV Cihazları</b> ekranına bu kodu girin</div>
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: 18, fontFamily: 'ui-monospace, monospace', color: '#fff' }}>
          {state.code}
        </div>
        <div style={{ fontSize: 18, opacity: 0.6 }}>Kod {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} içinde yenilenir</div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 28 }}>
        {state.kind === 'loading' ? 'Bağlanıyor…' : state.kind === 'revoked' ? 'Bu TV cihazının erişimi kapatıldı.' : state.message}
      </div>
      {state.kind === 'revoked' && (
        <button type="button" onClick={() => void requestCode()} style={{ fontSize: 20, padding: '12px 24px', borderRadius: 10 }}>
          Yeni kod al
        </button>
      )}
    </div>
  );
}
