'use client';

import { useMemo, useState } from 'react';
import { Download, FileBarChart2, History, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import type { ActivityReportMeta, ActivityReportUser, UserActivityPresentationPayload } from '@/lib/user-activity-presentation';
import '@/styles/reports-user-activity-presentation.css';

function todayInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function defaultRange(meta: ActivityReportMeta) {
  const today = todayInput();
  return {
    from: meta.min_date || `${new Date().getFullYear()}-01-01`,
    to: meta.max_date && meta.max_date > today ? meta.max_date : today,
  };
}

function statusClass(value: string) {
  if (value === 'Evet' || value === 'Tamamlandı') return 'success';
  if (value === 'Devam Ediyor') return 'info';
  if (value === 'Başlamadı') return 'muted';
  return 'neutral';
}

export default function UserActivityPresentationClient({ users, meta }: { users: ActivityReportUser[]; meta: ActivityReportMeta }) {
  const defaults = useMemo(() => defaultRange(meta), [meta]);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [userId, setUserId] = useState('');
  const [payload, setPayload] = useState<UserActivityPresentationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const validate = () => {
    if (!userId) return 'Rapor oluşturmak için kullanıcı seçiniz.';
    if (!from || !to) return 'Başlangıç ve bitiş tarihlerini seçiniz.';
    if (to < from) return 'Bitiş tarihi başlangıç tarihinden önce olamaz.';
    return null;
  };

  const buildParams = () => new URLSearchParams({ from, to, user_id: userId });

  const loadReport = async () => {
    const validation = validate();
    if (validation) {
      setMessage(validation);
      appToast.error('Rapor oluşturulamadı', validation);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/reports/user-activity-presentation?${buildParams().toString()}`, { cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.message || 'Rapor verisi alınamadı.');
      setPayload(json as UserActivityPresentationPayload);
      if (!(json?.rows ?? []).length) {
        setMessage('Seçilen kullanıcı ve tarih aralığı için geçmiş aktivite bulunamadı.');
      } else {
        appToast.success('Geçmiş rapor hazır', `${json.rows.length} firma ve ${json.summary.totalActivities} aktivite rapora eklendi.`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rapor verisi alınamadı.';
      setPayload(null);
      setMessage(errorMessage);
      appToast.error('Rapor oluşturulamadı', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    const validation = validate();
    if (validation) {
      setMessage(validation);
      appToast.error('PDF oluşturulamadı', validation);
      return;
    }
    if (!payload?.rows.length) {
      const emptyMessage = 'PDF indirmek için önce kayıt içeren bir rapor oluşturunuz.';
      setMessage(emptyMessage);
      appToast.error('PDF oluşturulamadı', emptyMessage);
      return;
    }
    setDownloading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/reports/user-activity-presentation/pdf?${buildParams().toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json?.message || 'PDF oluşturulamadı.');
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const disposition = response.headers.get('content-disposition') ?? '';
      const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const link = document.createElement('a');
      link.href = href;
      link.download = utf8Name ? decodeURIComponent(utf8Name) : `kullanici-aktivite-sunumu-${from}-${to}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      appToast.success('PDF hazır', 'Geçmiş aktivite yönetim sunumu indirildi.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'PDF oluşturulamadı.';
      setMessage(errorMessage);
      appToast.error('PDF oluşturulamadı', errorMessage);
    } finally {
      setDownloading(false);
    }
  };

  const summary = payload?.summary;
  const kpis = [
    { label: 'Toplam Aktivite', value: summary?.totalActivities ?? 0, icon: FileBarChart2 },
    { label: 'Temas Edilen Firma', value: summary?.distinctCustomers ?? 0, icon: Users },
    { label: 'Fiziki Ziyaret', value: summary?.physicalVisits ?? 0, icon: RefreshCw },
    { label: 'Online Görüşme', value: summary?.onlineMeetings ?? 0, icon: FileBarChart2 },
    { label: 'POC Yapılan Firma', value: summary?.pocCustomers ?? 0, icon: ShieldCheck },
    { label: 'Tamamlanan Entegrasyon', value: summary?.completedIntegrations ?? 0, icon: ShieldCheck },
  ];

  const directoryUsers = users.filter((user) => user.source === 'directory');
  const legacyUsers = users.filter((user) => user.source === 'legacy');

  return (
    <main className="uap-page pax-page-container">
      <section className="uap-hero">
        <div className="uap-hero-copy">
          <span className="uap-eyebrow">Rapor Merkezi · Geçmiş Veriler Dahil</span>
          <h1>Kullanıcı Aktivite Sunumu</h1>
          <p>CRM&apos;de daha önce kaydedilmiş aktiviteleri seçilen tarih aralığından çeker; firma account&apos;u farklı olsa bile aktiviteyi giren kullanıcıya göre raporlar.</p>
          <div className="uap-security"><ShieldCheck size={16} /> Yalnızca Admin ve Super Admin</div>
        </div>
        <div className="uap-hero-actions">
          <button type="button" className="uap-button secondary" onClick={() => void loadReport()} disabled={loading}>
            <RefreshCw size={17} className={loading ? 'spin' : ''} />
            {loading ? 'Geçmiş veriler taranıyor...' : 'Raporu Oluştur'}
          </button>
          <button type="button" className="uap-button primary" onClick={() => void downloadPdf()} disabled={downloading || !payload?.rows.length}>
            <Download size={17} />
            {downloading ? 'PDF hazırlanıyor...' : 'PDF İndir'}
          </button>
        </div>
      </section>

      <section className="uap-history-strip">
        <History size={19} />
        <div>
          <strong>{meta.historical_activity_count.toLocaleString('tr-TR')} geçmiş aktivite raporlanabilir</strong>
          <span>{meta.min_date && meta.max_date ? `${meta.min_date} ile ${meta.max_date} arasındaki mevcut CRM kayıtları` : 'CRM aktivite geçmişi henüz bulunamadı'}</span>
        </div>
      </section>

      <section className="uap-filter-card">
        <div className="uap-filter-heading">
          <div><span>Geçmiş Rapor Kapsamı</span><strong>Tarih ve aktiviteyi giren kullanıcı seçimi</strong></div>
          <small>Aktif ve pasif kullanıcılar ile kullanıcı diziniyle eşleşmeyen eski created_by kayıtları listelenir. Böylece yeni kayıtlarla sınırlı kalmaz.</small>
        </div>
        <div className="uap-filter-grid">
          <label><span>Başlangıç Tarihi</span><input type="date" value={from} min={meta.min_date || undefined} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
          <label><span>Bitiş Tarihi</span><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="uap-user-select">
            <span>Aktiviteyi Giren Kullanıcı</span>
            <select value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">Kullanıcı veya geçmiş kayıt seçiniz</option>
              {directoryUsers.length ? <optgroup label="Kullanıcılar">{directoryUsers.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}</optgroup> : null}
              {legacyUsers.length ? <optgroup label="Kullanıcıyla eşleşmeyen geçmiş kayıtlar">{legacyUsers.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}</optgroup> : null}
            </select>
          </label>
        </div>
      </section>

      {message ? <div className="uap-message" role="status">{message}</div> : null}
      {payload?.data_quality.warning ? <div className="uap-data-warning" role="status"><History size={17} /><span>{payload.data_quality.warning}</span></div> : null}

      <section className="uap-kpi-grid" aria-label="Rapor özeti">
        {kpis.map(({ label, value, icon: Icon }) => (
          <article className="uap-kpi" key={label}>
            <div className="uap-kpi-icon"><Icon size={18} /></div>
            <div><span>{label}</span><strong>{value.toLocaleString('tr-TR')}</strong></div>
          </article>
        ))}
      </section>

      <section className="uap-table-card">
        <div className="uap-table-heading">
          <div><span>Firma Bazlı Geçmiş Aktivite Görünümü</span><strong>{payload ? `${payload.filters.user_name} · ${payload.filters.date_range_label}` : 'Rapor oluşturulduğunda geçmiş sonuçlar burada görüntülenir'}</strong></div>
          <div className="uap-record-count">{payload?.rows.length ?? 0} firma</div>
        </div>
        <div className="uap-table-wrap">
          <table>
            <thead><tr><th>No</th><th>Firma Adı</th><th>Sektör</th><th>Kasa Firması</th><th>Fiziki Ziyaret Adedi</th><th>Online Görüşme</th><th>POC Durumu</th><th>Entegrasyon Durumu</th></tr></thead>
            <tbody>
              {payload?.rows.map((row) => (
                <tr key={row.musteri_id}>
                  <td className="uap-no">{row.no}</td>
                  <td className="uap-company">{row.firma_adi}<small>{row.toplam_aktivite} toplam aktivite</small></td>
                  <td>{row.sektor}</td>
                  <td>{row.kasa_firmasi}</td>
                  <td className="uap-number">{row.fiziki_ziyaret_adedi}</td>
                  <td className="uap-number">{row.online_gorusme_adedi}</td>
                  <td><span className={`uap-badge ${statusClass(row.poc_durumu)}`}>{row.poc_durumu}</span></td>
                  <td><span className={`uap-badge ${statusClass(row.entegrasyon_durumu)}`}>{row.entegrasyon_durumu}</span></td>
                </tr>
              ))}
              {!payload?.rows.length ? <tr><td colSpan={8} className="uap-empty"><History size={27} /><strong>Geçmiş rapor için seçim yapın</strong><span>Tarih aralığı ve kullanıcı seçerek mevcut CRM aktivitelerini raporlayın.</span></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
