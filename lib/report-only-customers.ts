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

export function isBusinessPartnerSector(sektor: unknown) {
  return normalizeResponsible(sektor) === normalizeResponsible(BUSINESS_PARTNER_SECTOR);
}

// Sektor "IS ORTAGI" secildiginde musteri tipi de Is Ortagi olmalidir: aktivite
// ekrani is ortagi fazlarini (14 fazli liste) SEKTORE degil musteri tipine
// bakarak getirir. Tip 'standard' kalirsa is ortagina musteri pipeline'inin 25
// fazi gosterilir; kaydi acan kisi bunu fark etmez ve faz numarasi yanlis
// olcekte kaydedilir (Nexivox / PAKKOD / ELRA / macro tr vakasi, 01.09.2026).
//
// Yalnizca dokunulmamis varsayilan ('standard') duzeltilir; 'report_only' gibi
// bilincli bir secim asla ezilmez.
export function resolveCustomerTypeForSector(args: { sektor: unknown; customerType: unknown }) {
  const customerType = String(args.customerType ?? '').trim() || 'standard';
  if (customerType !== 'standard') return customerType;
  return isBusinessPartnerSector(args.sektor) ? 'business_partner' : customerType;
}
