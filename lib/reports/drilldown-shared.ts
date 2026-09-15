/**
 * KIRILIM SAYFASI — paylaşımlı tipler ve saf yardımcılar (sunucuya bağımlı değil).
 *
 * Çağdaş Bey, 15.09.2026: *"Portföy sağlığında yine yönlendirme yapılmış, linklenme — hareketsiz
 * firmalarda diğer kısımlarda da yapılsın, her şey için linkleme istiyoruz."* ve model kırılımı için
 * *"A80'in üzerine basınca gitsin, bu A80'den kime kaç tane satmışız görmek isterdim."*
 *
 * Tek gizli sayfa (`/crm/kirilim`) Canlı Ekran'daki HER kutunun arkasını açar; menüde görünmez,
 * yalnız yeni sekmede linkten gelinir. Böylece her sayaç için ayrı ekran açılmaz.
 */

export const DRILLDOWN_KINDS = ['cihaz', 'teklif', 'kapsama', 'portfoy', 'poc', 'fatura'] as const;
export type DrilldownKind = (typeof DRILLDOWN_KINDS)[number];

export function isDrilldownKind(value: unknown): value is DrilldownKind {
  return typeof value === 'string' && (DRILLDOWN_KINDS as readonly string[]).includes(value);
}

/** Teklif kırılımında hangi durum: açık (gönderilmiş + taslak) · kazanılan · kaybedilen. */
export const QUOTE_STATES = ['acik', 'kazanilan', 'kaybedilen'] as const;
export type QuoteState = (typeof QUOTE_STATES)[number];
export function isQuoteState(value: unknown): value is QuoteState {
  return typeof value === 'string' && (QUOTE_STATES as readonly string[]).includes(value);
}

/** Cihaz kırılımında satılan / kiralanan ayrımı; boş = ikisi birden. */
export const DEVICE_MODES = ['sale', 'rental'] as const;
export type DeviceMode = (typeof DEVICE_MODES)[number];
export function isDeviceMode(value: unknown): value is DeviceMode {
  return typeof value === 'string' && (DEVICE_MODES as readonly string[]).includes(value);
}

export type DrilldownParams = {
  kind: DrilldownKind;
  owner: string | null;
  /** teklif: durum · cihaz: satış/kiralama */
  state: QuoteState | null;
  mode: DeviceMode | null;
  /** cihaz: tek modele daralt (A80 gibi) */
  model: string | null;
  year: number;
};

export type DrilldownColumn = { key: string; label: string; align?: 'left' | 'right'; width?: string };

export type DrilldownRow = {
  /** Firma kartına bağlanır (varsa). */
  customerId: string | null;
  cells: Array<string | number | null>;
  /** Sıralama ve vurgulama için ham değer (ilk sayısal kolon). */
  sortValue?: number;
};

export type DrilldownPayload = {
  title: string;
  subtitle: string;
  columns: DrilldownColumn[];
  rows: DrilldownRow[];
  /** Üst şeritteki özet kutuları. */
  stats: Array<{ label: string; value: string }>;
  note: string | null;
};

const KIND_TITLE: Record<DrilldownKind, string> = {
  cihaz: 'Cihaz Kırılımı',
  teklif: 'Teklifler',
  kapsama: 'Kapsanan Firmalar',
  portfoy: 'Portföy',
  poc: 'Aktif POC · Pilot',
  fatura: 'Kesilen Faturalar',
};

const QUOTE_STATE_LABEL: Record<QuoteState, string> = {
  acik: 'Açık teklifler',
  kazanilan: 'Kazanılan teklifler',
  kaybedilen: 'Kaybedilen teklifler',
};

const DEVICE_MODE_LABEL: Record<DeviceMode, string> = { sale: 'Satılan', rental: 'Kiralanan' };

/** Sayfa başlığı: "Cihaz Kırılımı · Satılan · A80" gibi. */
export function drilldownTitle(params: DrilldownParams): string {
  const parts: string[] = [KIND_TITLE[params.kind]];
  if (params.kind === 'teklif' && params.state) parts.push(QUOTE_STATE_LABEL[params.state]);
  if (params.kind === 'cihaz' && params.mode) parts.push(DEVICE_MODE_LABEL[params.mode]);
  if (params.kind === 'cihaz' && params.model) parts.push(params.model);
  return parts.join(' · ');
}

/** Canlı Ekran kutusundan bu sayfaya giden adres. */
export function drilldownHref(params: {
  kind: DrilldownKind;
  owner?: string | null;
  state?: QuoteState | null;
  mode?: DeviceMode | null;
  model?: string | null;
  year?: number | null;
}): string {
  const query = new URLSearchParams({ tip: params.kind });
  if (params.owner) query.set('satisci', params.owner);
  if (params.state) query.set('durum', params.state);
  if (params.mode) query.set('cihaz', params.mode);
  if (params.model) query.set('model', params.model);
  if (params.year) query.set('yil', String(params.year));
  return `/crm/kirilim?${query.toString()}`;
}

/** URL parametrelerini güvenli değerlere indirger; bilinmeyen değer yok sayılır. */
export function parseDrilldownParams(
  raw: Record<string, string | string[] | undefined>,
  fallbackYear: number,
): DrilldownParams {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';
  const kindRaw = one(raw.tip).trim();
  const stateRaw = one(raw.durum).trim();
  const modeRaw = one(raw.cihaz).trim();
  const yearRaw = Number(one(raw.yil));
  return {
    kind: isDrilldownKind(kindRaw) ? kindRaw : 'portfoy',
    owner: one(raw.satisci).trim() || null,
    state: isQuoteState(stateRaw) ? stateRaw : null,
    mode: isDeviceMode(modeRaw) ? modeRaw : null,
    model: one(raw.model).trim().toLocaleUpperCase('tr-TR') || null,
    year: Number.isFinite(yearRaw) && yearRaw >= 2020 && yearRaw <= 2100 ? Math.floor(yearRaw) : fallbackYear,
  };
}
