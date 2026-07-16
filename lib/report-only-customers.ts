export const REPORT_ONLY_RESPONSIBLES = [] as const;
export const BUSINESS_PARTNER_RESPONSIBLE = 'İş Ortakları';
export const REPORT_ONLY_SECTORS = ['iş ortağı'] as const;
export const BUSINESS_PARTNER_SECTOR = 'İŞ ORTAĞI';

export const BUSINESS_PARTNER_CUSTOMERS = [
  'Toshiba',
  'Nebim',
  'Teknonet',
  'Tepepos',
  'Seripos',
  'Param',
  'Paramtech',
  'Robotpos',
  'Posback',
  'Barsoft',
  'Enpos',
  'Encore',
  'Logo',
  'Microsoft D365',
  'Başarı Yazılım',
  'Birikim Bilgisayar',
  'Tera Yazılım',
  'Verimsoft',
] as const;

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


export const PHASE_OPTIONAL_RESPONSIBLE_GROUP = 'crm_phase_optional_responsibles';
export function normalizeResponsible(value: unknown) {
  return normalizeTrAscii(value).replace(/\s+/g, ' ').trim();
}

export function isPhaseOptionalResponsible(sorumlu: unknown, responsibles: readonly string[] = []) {
  const normalized = normalizeResponsible(sorumlu);
  if (!normalized) return false;
  return responsibles.some((item) => normalizeResponsible(item) === normalized);
}
export function isPhaseOptionalCustomerByResponsible(customer: { sorumlu?: unknown } | null | undefined, responsibles: readonly string[]) {
  return Boolean(customer) && isPhaseOptionalResponsible(customer?.sorumlu, responsibles);
}

export function isReportOnlyResponsible(_sorumlu: unknown) {
  return false;
}

export function isReportOnlySector(sektor: unknown) {
  const normalized = normalizeTrAscii(sektor);
  // Fazsız/rapor-only kararını artık BANKA/VERTICAL sektör adına göre vermiyoruz.
  // Aksi halde Trendyol gibi normal pipeline müşterileri yanlışlıkla fazsız olur.
  return normalized === 'is ortagi';
}

export function isBusinessPartnerSector(sektor: unknown) {
  return normalizeTrAscii(sektor) === 'is ortagi';
}

export function isBusinessPartnerName(value: unknown) {
  const normalized = normalizeTrAscii(value);
  return BUSINESS_PARTNER_CUSTOMERS.some((name) => normalizeTrAscii(name) === normalized);
}

export function isReportOnlyCustomer(customer: { musteri?: unknown; sorumlu?: unknown; sektor?: unknown } | null | undefined) {
  if (!customer) return false;
  return isBusinessPartnerSector(customer.sektor) || isBusinessPartnerName(customer.musteri);
}

export function reportOnlyCustomerKind(customer: { musteri?: unknown; sorumlu?: unknown; sektor?: unknown } | null | undefined) {
  if (!customer) return null;
  if (isBusinessPartnerSector(customer.sektor) || isBusinessPartnerName(customer.musteri)) return 'business-partner';
  return null;
}
