import Link from 'next/link';
import { requireCrmAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import { isInactiveRow, loadHunterFarmerActivity } from '@/lib/reports/inactive-customers';
import { LIVE_BOARD_RULES, normalizeName, ownerOrderCompare } from '@/lib/reports/live-board-shared';
import '@/styles/inactive.css';

// HAREKETSİZ FİRMALAR — Çağdaş Bey, 11.09.2026:
//   "15 gündür üzerinde işlem olmayan firma sayısı… Basınca gitsin o firmaları göreyim,
//    listesi açılsın… New Tab açsın."
// Canlı Ekran kişi slaydındaki "Hareketsiz Firma" sayacı bu sayfayı YENİ SEKMEDE açar
// (/crm/hareketsiz?satici=...&gun=15). TV'de açılacağı için sunucu bileşeni: istemci JS'i,
// yüklenme animasyonu ve ek istek yok — sayfa tek seferde basılır.
//
// Kapı: Müşteriler ekranıyla aynı (customer.read + screen.crm.customers.view) — liste
// firma adı ve son hareket tarihinden ibaret, künye verisi taşımaz.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATEGORY_LABEL: Record<'H' | 'F', string> = { H: 'Hunter', F: 'Farmer' };

function fmtDay(value: string | null) {
  if (!value) return 'hiç hareket yok';
  const [y, m, d] = value.split('-');
  return `${d}.${m}.${y}`;
}

export default async function InactiveCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ satici?: string; gun?: string }>;
}) {
  await requireCrmAccessOrThrow();
  await requireScreenAccessOrThrow('screen.crm.customers.view');

  const params = await searchParams;
  const ownerFilter = String(params.satici ?? '').trim();
  const days = Math.min(365, Math.max(1, Number(params.gun) || LIVE_BOARD_RULES.inactiveOwnerDays));

  const all = await loadHunterFarmerActivity();
  const scoped = ownerFilter ? all.filter((row) => normalizeName(row.owner) === normalizeName(ownerFilter)) : all;
  const rows = scoped.filter((row) => isInactiveRow(row, days))
    .sort((a, b) => ownerOrderCompare(a.owner, b.owner)
      || (b.days ?? 99_999) - (a.days ?? 99_999)
      || a.firma.localeCompare(b.firma, 'tr'));
  const unmatched = scoped.filter((row) => !row.matched);
  const owners = Array.from(new Set(rows.map((row) => row.owner)));

  return (
    <div className="iv-shell">
      <section className="iv-hero">
        <span className="iv-eyebrow">Operasyon · Hareketsiz Firmalar</span>
        <h1>{ownerFilter || 'Tüm satış ekibi'}</h1>
        <p>
          Müşteri Listesi’nde <b>Hunter</b> ya da <b>Farmer</b> olup <b>{days} gündür</b> üzerinde işlem
          olmayan firmalar. Planlanan (henüz yapılmamış) aksiyonlar hareket sayılmaz.
        </p>
      </section>

      <div className="iv-summary">
        <div><strong>{rows.length}</strong><span>hareketsiz firma</span></div>
        <div><strong>{owners.length}</strong><span>kişi</span></div>
        <div><strong>{scoped.length}</strong><span>Hunter + Farmer satırı</span></div>
      </div>

      {rows.length === 0 ? (
        <div className="iv-empty">Bu ölçüte uyan firma yok — {days} gün içinde hepsine dokunulmuş.</div>
      ) : (
        <div className="iv-table" role="table">
          <div className="iv-tr iv-th" role="row">
            <span role="columnheader">Firma</span>
            <span role="columnheader">Kişi</span>
            <span role="columnheader">Kategori</span>
            <span role="columnheader">Son hareket</span>
            <span role="columnheader">Gün</span>
          </div>
          {rows.map((row) => (
            <div className="iv-tr" role="row" key={`${row.owner}-${row.category}-${row.firma}`}>
              <span role="cell">
                {row.customerId
                  ? <Link href={`/crm/${row.customerId}`} target="_blank">{row.musteri ?? row.firma}</Link>
                  : row.firma}
              </span>
              <span role="cell">{row.owner}</span>
              <span role="cell"><i className={`iv-chip cat-${row.category}`}>{CATEGORY_LABEL[row.category]}</i></span>
              <span role="cell">{fmtDay(row.lastActivityAt)}</span>
              <span role="cell" className={`iv-days ${row.days == null || row.days >= days * 2 ? 'hot' : ''}`}>
                {row.days == null ? '—' : row.days}
              </span>
            </div>
          ))}
        </div>
      )}

      {unmatched.length ? (
        <div className="iv-note">
          <b>{unmatched.length} liste satırı</b> CRM künyesiyle eşleşmedi (ad farklı ya da firma kartı açılmamış);
          bu satırların aktivitesi bilinemediği için sayıya girmiyor:{' '}
          {unmatched.slice(0, 12).map((row) => row.firma).join(' · ')}
          {unmatched.length > 12 ? ` … +${unmatched.length - 12}` : ''}
        </div>
      ) : null}
    </div>
  );
}
