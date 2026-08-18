export const BUSINESS_PARTNER_RESPONSIBLE = 'İş Ortakları';
export const BUSINESS_PARTNER_SECTOR = 'İŞ ORTAĞI';

export function normalizeTr(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

export function normalizeTrAscii(value: unknown) {
  return normalizeTr(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function normalizeResponsible(value: unknown) {
  return normalizeTrAscii(value).replace(/\s+/g, ' ').trim();
}

type CustomerClassification = {
  musteri?: unknown;
  sorumlu?: unknown;
  sektor?: unknown;
  report_only?: unknown;
  customer_type?: unknown;
};

export function isReportOnlyCustomer(customer: CustomerClassification | null | undefined) {
  if (!customer) return false;
  // Görünürlük veya işlem kısıtı kişi adı ya da sektör adından türetilmez.
  // Geriye dönük uyumluluk için yalnızca açıkça işaretlenmiş sentetik satırlar tanınır.
  return customer.report_only === true;
}

export function reportOnlyCustomerKind(customer: CustomerClassification | null | undefined) {
  if (!customer) return null;
  if (String(customer.customer_type ?? '').trim() === 'business_partner') return 'business-partner';
  return null;
}
