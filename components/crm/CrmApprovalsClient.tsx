'use client';
import { formatDateTime as formatDate } from '@/lib/utils';

import { useEffect, useState } from 'react';

type PendingRequest = {
  id: string;
  musteri: string;
  current_account: string | null;
  requested_account: string;
  requested_by: string;
  created_at: string;
};



export default function CrmApprovalsClient() {
  const [rows, setRows] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/account-change-requests', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.message || 'Onay kayıtları alınamadı.');
        setRows([]);
        return;
      }
      setRows(json.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRows(); }, []);

  async function handleAction(requestId: string, action: 'approve' | 'reject') {
    setBusyId(requestId);
    setMsg(null);
    try {
      const res = await fetch('/api/crm/account-change-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.message || 'İşlem tamamlanamadı.');
        return;
      }
      setMsg(action === 'approve' ? 'Talep onaylandı.' : 'Talep reddedildi.');
      await loadRows();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Hero Header - Standart */}
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Onay Yönetimi</span>
        <h1 className="pax-hero-title">Account Değişiklik Onayları</h1>
        <p className="pax-hero-description">
          Müşteri sorumlusu değişiklik talepleri sadece bu ekrandan onaylanır veya reddedilir.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="pax-grid-4">
        <div className="pax-card" style={{ textAlign: 'center' }}>
          <div className="pax-label" style={{ marginBottom: 8 }}>Bekleyen Talep</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{rows.length}</div>
        </div>
        <div className="pax-card" style={{ textAlign: 'center' }}>
          <div className="pax-label" style={{ marginBottom: 8 }}>İşlem Tipi</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Account</div>
        </div>
        <div className="pax-card" style={{ textAlign: 'center' }}>
          <div className="pax-label" style={{ marginBottom: 8 }}>Onay Yetkisi</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Admin</div>
        </div>
        <div className="pax-card" style={{ textAlign: 'center' }}>
          <div className="pax-label" style={{ marginBottom: 8 }}>Durum</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Aktif</div>
        </div>
      </div>

      {/* Success Message */}
      {msg && (
        <div style={{ 
          background: '#ecfdf3', 
          border: '1px solid #bbf7d0', 
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          fontSize: 13,
          color: '#166534',
          fontWeight: 600
        }}>
          {msg}
        </div>
      )}

      {/* Approvals List */}
      <div className="pax-card">
        {loading && (
          <div className="pax-loading">Onay kayıtları yükleniyor...</div>
        )}
        
        {!loading && !rows.length && (
          <div className="pax-empty">Bekleyen account değişiklik talebi bulunmuyor.</div>
        )}

        {!loading && rows.length > 0 && (
          <div style={{ display: 'grid', gap: 16 }}>
            {rows.map((row) => (
              <div 
                key={row.id}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 20,
                  display: 'grid',
                  gap: 14
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                      {row.musteri}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      Talep eden: {row.requested_by} · {formatDate(row.created_at)}
                    </div>
                  </div>
                  <span className="chip chip-red">Bekleyen Onay</span>
                </div>

                {/* Details */}
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Mevcut sorumlu: <strong style={{ color: 'var(--text)' }}>{row.current_account || '-'}</strong>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Talep edilen sorumlu: <strong style={{ color: 'var(--text)' }}>{row.requested_account}</strong>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button 
                    className="pax-btn pax-btn-primary"
                    disabled={busyId === row.id}
                    onClick={() => handleAction(row.id, 'approve')}
                  >
                    Onayla
                  </button>
                  <button 
                    className="pax-btn pax-btn-secondary"
                    disabled={busyId === row.id}
                    onClick={() => handleAction(row.id, 'reject')}
                  >
                    Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
