export const INTEGRATION_PROCESS_ACTIVITY = 'Entegrasyon Süreci' as const;
export const LEGACY_BUSINESS_PARTNER_ACTIVITY = 'İş Ortaklığı Aktivitesi' as const;

export const ACTIVITY_CHANNEL_OPTIONS = ['Telefon', 'Yerinde Ziyaret', 'Online Toplantı', 'Teknik Ziyaret', 'Teknik Online', 'POM', 'E-posta', INTEGRATION_PROCESS_ACTIVITY, 'Diğer'] as const;
export type ActivityChannel = (typeof ACTIVITY_CHANNEL_OPTIONS)[number];

export const TECHNICAL_ACTIVITY_CHANNELS = ['Teknik Ziyaret', 'Teknik Online', 'POM'] as const;
export type TechnicalActivityChannel = (typeof TECHNICAL_ACTIVITY_CHANNELS)[number];

export function normalizeChannel(value: string | null | undefined): ActivityChannel {
  const raw = String(value ?? '').trim();
  if (raw === 'Telefon') return 'Telefon';
  if (raw === 'Yerinde Ziyaret') return 'Yerinde Ziyaret';
  if (raw === 'Online Toplantı') return 'Online Toplantı';
  if (raw === 'Teknik Ziyaret') return 'Teknik Ziyaret';
  if (raw === 'Teknik Online') return 'Teknik Online';
  if (raw === 'POM') return 'POM';
  if (raw === 'E-posta') return 'E-posta';
  // Eski kayıtların etiketi değiştirilmez; uygulama onları yeni adla yorumlar.
  if (raw === INTEGRATION_PROCESS_ACTIVITY || raw === LEGACY_BUSINESS_PARTNER_ACTIVITY) return INTEGRATION_PROCESS_ACTIVITY;
  return 'Diğer';
}

export function isSalesChannel(channel: string | null | undefined) {
  const normalized = normalizeChannel(channel);
  return normalized === 'Telefon' || normalized === 'Yerinde Ziyaret' || normalized === 'Online Toplantı';
}

export function isTechnicalChannel(channel: string | null | undefined) {
  const normalized = normalizeChannel(channel);
  return normalized === 'Teknik Ziyaret' || normalized === 'Teknik Online' || normalized === 'POM';
}

export function isBusinessPartnerActivity(channel: string | null | undefined) {
  return normalizeChannel(channel) === INTEGRATION_PROCESS_ACTIVITY;
}

export const isIntegrationProcessActivity = isBusinessPartnerActivity;

export function activityScopeForChannel(channel: string | null | undefined): 'technical' | 'account' {
  return isTechnicalChannel(channel) ? 'technical' : 'account';
}

export function affectsPhaseForChannel(channel: string | null | undefined): boolean {
  return activityScopeForChannel(channel) === 'account';
}

/**
 * Salt İş Ortağı firma: organization_roles'ta 'business_partner' rolü aktif ama
 * 'customer' rolü yok. Bu firmalarda "müşteri" bağlamında hiç satış süreci
 * olmadığı için, Aktivite Tipi ne olursa olsun (Entegrasyon Süreci seçilmese
 * bile) aktivite İş Ortağı faz listesini/bağlamını kullanmalı (Sinan, 16.09).
 * Çift rollü (hem customer hem business_partner) firmalarda bu fonksiyon
 * false döner — hangi bağlamda işlem yapıldığı yine Aktivite Tipi ile seçilir,
 * aksi halde bir firmanın müşteri ve iş ortağı fazları birbirine karışır.
 * Tek tanım: hem QuickActivityClient.tsx (hangi faz listesi gösterilecek) hem
 * de activities/create route'u (activity_context neye yazılacak) burayı kullanır.
 */
export function isPureBusinessPartnerRelationship(roles: {
  hasCustomerRole?: boolean | null;
  hasBusinessPartnerRole?: boolean | null;
}): boolean {
  return Boolean(roles.hasBusinessPartnerRole) && !roles.hasCustomerRole;
}
