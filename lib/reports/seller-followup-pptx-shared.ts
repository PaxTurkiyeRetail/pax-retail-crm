// Takip Listesi sunumunun SAF yardımcıları (sunucuya bağımlı değil).
//
// Neden ayrı dosya: `seller-followup.ts` 'server-only' içerir, vitest yükleyemez
// (altın kural 11). Sayfalama ve etiket üretimi burada durur ki hem sunum
// üreticisi hem testler aynı kaynağı kullansın.

import { MONTH_NAMES_TR } from '@/lib/reports/seller-followup-shared';

/**
 * Bir slaytta kaç takip satırı gösterilir.
 * Sinan'ın gönderdiği örnek sunumda (27.08) tek slaytta 23 satır vardı; tablo
 * yüksekliği 22 satırda taşmadan sığıyor. Fazlası SONRAKİ SLAYTA taşar,
 * kırpılmaz (altın kural 19: veri kesilmez, sayfalanır).
 */
export const FOLLOWUP_ROWS_PER_SLIDE = 22;

/** Yakın vade alt etiketinde en fazla kaç firma adı yazılır. */
export const NEAR_TERM_NAME_LIMIT = 3;

export type FollowupDeckSummary = {
  openFollowupCount: number;
  totalQuantity: number;
  nearTermQuantity: number;
  nearTermCustomers: string[];
  nearTermLabel: string;
};

export type FollowupSlideRow = {
  musteri: string;
  konuKimde: string;
  modelAdetLabel: string;
  takipKonusu: string;
  cozumTarihi: string | null;
};

export type FollowupSlideSpec = {
  /** Slayt başlığındaki kişi adı. */
  owner: string;
  title: string;
  /** Aynı kişi birden çok slayta taşarsa "2 / 3" gibi; tek slaytsa null. */
  pageLabel: string | null;
  summary: FollowupDeckSummary;
  rows: FollowupSlideRow[];
};

/** "TAKİP LİSTESİ — FURKAN KIZILKURT PORTFÖYÜ" */
export function followupDeckTitle(owner: string) {
  const name = String(owner ?? '').trim();
  return name ? `TAKİP LİSTESİ — ${name.toLocaleUpperCase('tr-TR')} PORTFÖYÜ` : 'TAKİP LİSTESİ — TÜM PORTFÖY';
}

/** "Güncel durum: 16 Eylül 2026" */
export function followupSubtitle(today = new Date()) {
  return `Güncel durum: ${today.getDate()} ${MONTH_NAMES_TR[today.getMonth()]} ${today.getFullYear()}`;
}

/**
 * KPI kartının altındaki açıklama: "Eylül–Kasım: Damat, Gusto, Spx".
 * Firma yoksa yalnız ay aralığı yazılır — uydurma isim üretilmez (altın kural 34).
 */
export function nearTermSubLabel(summary: Pick<FollowupDeckSummary, 'nearTermLabel' | 'nearTermCustomers'>) {
  const names = (summary.nearTermCustomers ?? []).filter(Boolean);
  if (!names.length) return summary.nearTermLabel;
  const shown = names.slice(0, NEAR_TERM_NAME_LIMIT).join(', ');
  const rest = names.length - NEAR_TERM_NAME_LIMIT;
  return rest > 0 ? `${summary.nearTermLabel}: ${shown} +${rest}` : `${summary.nearTermLabel}: ${shown}`;
}

/** Çözüm tarihini "15 Eyl 2026" biçimine çevirir; boşsa "—". */
export function formatFollowupDate(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const parsed = new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  const month = MONTH_NAMES_TR[parsed.getMonth()].slice(0, 3);
  return `${parsed.getDate()} ${month} ${parsed.getFullYear()}`;
}

/**
 * Kişi listesini slayt listesine çevirir. Satırı olmayan kişi de BİR slayt alır
 * ("kayıt yok" yazar) — kişi sessizce kaybolmaz.
 */
export function buildFollowupSlideSpecs(
  decks: Array<{ owner: string; summary: FollowupDeckSummary; rows: FollowupSlideRow[] }>,
  rowsPerSlide = FOLLOWUP_ROWS_PER_SLIDE,
): FollowupSlideSpec[] {
  const specs: FollowupSlideSpec[] = [];
  for (const deck of decks) {
    const pages: FollowupSlideRow[][] = [];
    for (let index = 0; index < deck.rows.length; index += rowsPerSlide) {
      pages.push(deck.rows.slice(index, index + rowsPerSlide));
    }
    if (!pages.length) pages.push([]);
    pages.forEach((rows, index) => {
      specs.push({
        owner: deck.owner,
        title: followupDeckTitle(deck.owner),
        pageLabel: pages.length > 1 ? `${index + 1} / ${pages.length}` : null,
        summary: deck.summary,
        rows,
      });
    });
  }
  return specs;
}

/** İndirilen dosyanın adı: "takip-listesi-furkan-kizilkurt-2026-09-16.pptx" */
export function followupPptxFileName(owner: string, today = new Date()) {
  const slug = String(owner ?? '').trim()
    ? String(owner).trim().toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : 'hepsi';
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return `takip-listesi-${slug || 'hepsi'}-${stamp}.pptx`;
}
