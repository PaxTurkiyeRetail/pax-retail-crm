'use client';

import { useState } from 'react';

type BackupResult = {
  ok: boolean;
  fileName?: string;
  filePath?: string;
  message?: string;
};

export default function DbBackupClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BackupResult | null>(null);

  async function createBackup() {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/admin/db-backup', { method: 'POST' });
      const data = (await response.json()) as BackupResult;
      setResult(data.ok ? data : { ok: false, message: data.message || 'DB yedeği alınamadı.' });
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : 'DB yedeği alınamadı.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="pax-card" style={{ maxWidth: 760 }}>
      <div className="pax-card-header">
        <div>
          <h2 className="pax-card-title">Manuel DB Yedeği Al</h2>
          <p className="pax-card-description">Çalışan sunucuda pg_dump ile custom format .bak dosyası oluşturur.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <button type="button" className="pax-btn pax-btn-primary" onClick={createBackup} disabled={loading} style={{ width: 'fit-content' }}>
          {loading ? 'Yedek alınıyor...' : 'DB Yedeği Al (.bak)'}
        </button>

        {result?.ok && (
          <div style={{ border: '1px solid var(--chip-green-bd)', background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', borderRadius: 14, padding: 14 }}>
            <strong>Yedek alındı.</strong>
            <div>Dosya: {result.fileName}</div>
            <div>Konum: {result.filePath}</div>
          </div>
        )}

        {result && !result.ok && (
          <div style={{ border: '1px solid var(--chip-red-bd)', background: 'var(--chip-red-bg)', color: 'var(--chip-red-color)', borderRadius: 14, padding: 14 }}>
            <strong>Yedek alınamadı.</strong>
            <div>{result.message}</div>
          </div>
        )}
      </div>
    </section>
  );
}
