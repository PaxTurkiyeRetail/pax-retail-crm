// Satışçı Takip Raporu'nun saf (sunucuya bağımlı olmayan) yardımcıları.
//
// Veri katmanı (seller-followup.ts) 'server-only' ve DB bağlantısı içerdiği için
// test ortamında yüklenemez; sabitler ve tarih hesapları burada durur ki hem
// sunucu tarafı hem testler aynı kaynağı kullansın.

/** Görselde bir sayfada 10 firma listelenir; fazlası yeni sayfaya taşar. */
export const SELLER_FOLLOWUP_PAGE_SIZE = 10;

/**
 * Yakın vade penceresi: bu ay dahil önümüzdeki 3 takvim ayı
 * ("çözüm tarihi önümüzdeki iki ay olanların tarihleri bu ay dahil").
 */
export const NEAR_TERM_MONTH_WINDOW = 3;

export const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

/** Bu ay dahil N ayın son gününü (gün sonu) döndürür. */
export function nearTermBoundary(today = new Date(), monthWindow = NEAR_TERM_MONTH_WINDOW) {
  return new Date(today.getFullYear(), today.getMonth() + monthWindow, 0, 23, 59, 59, 999);
}

/** KPI altındaki ay etiketi, ör. "Eylül–Kasım". */
export function nearTermRangeLabel(today = new Date(), monthWindow = NEAR_TERM_MONTH_WINDOW) {
  const firstMonth = MONTH_NAMES_TR[today.getMonth()];
  const lastMonthIndex = (today.getMonth() + monthWindow - 1) % 12;
  return `${firstMonth}–${MONTH_NAMES_TR[lastMonthIndex]}`;
}

export type SellerFollowupModel = {
  productCode: string;
  productName: string;
  quantity: number;
};

/** "A80: 121, S210: 121" biçiminde model/adet metni. */
export function formatModelAdet(models: SellerFollowupModel[]) {
  if (!models.length) return '—';
  return models
    .map((model) => `${model.productCode}: ${model.quantity.toLocaleString('tr-TR')}`)
    .join(', ');
}
