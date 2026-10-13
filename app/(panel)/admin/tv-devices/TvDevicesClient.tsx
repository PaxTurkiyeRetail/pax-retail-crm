'use client';

import { useCallback, useEffect, useState } from 'react';
import { TV_SCREENS, normalizeTvScreens, type TvScreen } from '@/lib/tv-screens-shared';

type Device = {
  id: string;
  name: string;
  approved_at: string | null;
  approved_by: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
  last_ip: string | null;
  screens: string[];
};

function ScreenPicker({ value, onChange, disabled }: { value: TvScreen[]; onChange: (next: TvScreen[]) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {TV_SCREENS.map((s) => (
        <label key={s.key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={value.includes(s.key)}
            disabled={disabled}
            onChange={(e) => onChange(normalizeTvScreens(e.target.checked ? [...value, s.key] : value.filter((k) => k !== s.key)))}
          />
          {s.label}
        </label>
      ))}
    </div>
  );
}

const fmt = (value: string | null) => (value ? new Date(value).toLocaleString('tr-TR') : '—');

export default function TvDevicesClient() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('Toplantı Odası TV');
  const [screens, setScreens] = useState<TvScreen[]>(TV_SCREENS.map((s) => s.key));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/tv-devices', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setDevices(data.devices ?? []);
    else setMessage({ ok: false, text: data?.message || 'Liste alınamadı.' });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/tv-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'İşlem yapılamadı.');
      return true;
    } catch (error: any) {
      setMessage({ ok: false, text: error?.message || 'İşlem yapılamadı.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const approve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await post({ code, name, screens })) {
      setMessage({ ok: true, text: 'TV bağlandı. Birkaç saniye içinde Canlı Ekran açılır.' });
      setCode('');
      void load();
    }
  };

  const saveScreens = async (device: Device, next: TvScreen[]) => {
    setDevices((list) => list.map((d) => (d.id === device.id ? { ...d, screens: next } : d)));
    if (await post({ action: 'screens', id: device.id, screens: next })) setMessage({ ok: true, text: 'Sekmeler kaydedildi. TV en geç 2 dk içinde güncellenir.' });
    else void load();
  };

  const revoke = async (device: Device) => {
    if (!window.confirm(`"${device.name}" erişimi kapatılsın mı?`)) return;
    if (await post({ action: 'revoke', id: device.id })) {
      setMessage({ ok: true, text: 'Erişim kapatıldı.' });
      void load();
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <form onSubmit={approve} className="pax-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: 16 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>TV kodu</span>
          <input
            className="pax-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="ABC123"
            style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 4, width: 140 }}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: 4, flex: '1 1 200px' }}>
          <span>Cihaz adı</span>
          <input className="pax-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <div style={{ display: 'grid', gap: 4, flexBasis: '100%' }}>
          <span>TV'de gösterilecek sekmeler</span>
          <ScreenPicker value={screens} onChange={setScreens} />
        </div>
        <button type="submit" className="pax-btn pax-btn-primary" disabled={busy}>Bağla</button>
      </form>

      {message && <div style={{ color: message.ok ? '#15803d' : '#b91c1c' }}>{message.text}</div>}

      <div className="pax-card" style={{ padding: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th>Cihaz</th><th>Sekmeler</th><th>Durum</th><th>Son görülme</th><th>IP</th><th>Bağlayan</th><th />
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 12, opacity: 0.6 }}>Bağlı TV yok.</td></tr>
            )}
            {devices.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid #e5e7eb', opacity: d.revoked_at ? 0.5 : 1 }}>
                <td style={{ padding: 8 }}>{d.name}</td>
                <td>
                  <ScreenPicker value={normalizeTvScreens(d.screens)} disabled={busy || Boolean(d.revoked_at)} onChange={(next) => void saveScreens(d, next)} />
                </td>
                <td>{d.revoked_at ? `Kapalı (${fmt(d.revoked_at)})` : 'Aktif'}</td>
                <td>{fmt(d.last_seen_at)}</td>
                <td>{d.last_ip ?? '—'}</td>
                <td>{d.approved_by ?? '—'} · {fmt(d.approved_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  {!d.revoked_at && (
                    <button type="button" className="pax-btn" onClick={() => void revoke(d)} disabled={busy}>Erişimi kapat</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
