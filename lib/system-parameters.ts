import { db } from "@/lib/db";

export type SystemParameter = {
  id: string;
  group_key: string;
  param_key: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
  version?: number;
  meta?: Record<string, unknown>;
};

export type ParameterOption = {
  label: string;
  value: string;
  sortOrder?: number;
  isActive?: boolean;
};

export const KUNYE_PARAMETER_GROUPS = [
  {
    key: "kunye_magaza_sayisi",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Mağaza Yapısı",
    title: "Mağaza Sayısı",
    description: "Müşterinin toplam mağaza aralığı.",
  },
  {
    key: "kunye_franchise_sayisi",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Mağaza Yapısı",
    title: "Franchise Sayısı",
    description: "Franchise mağaza aralığı.",
  },
  {
    key: "kunye_sabit_kasa_adedi",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Mağaza Yapısı",
    title: "Sabit Kasa Adedi",
    description: "Mağaza genelindeki sabit kasa aralığı.",
  },

  {
    key: "kunye_kasapos_firmasi",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Kasa / POS",
    title: "KasaPOS Firması",
    description: "Kullanılan kasa yazılımı veya kasa çözümü sağlayıcısı.",
  },
  {
    key: "kunye_pos_modeli",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Kasa / POS",
    title: "POS Modeli",
    description: "ÖKC/EFT gibi POS model kırılımı.",
  },
  {
    key: "kunye_pos_markasi",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Kasa / POS",
    title: "POS Markası",
    description: "Sahadaki POS marka listesi.",
  },
  {
    key: "kunye_pos_mulkiyet",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Kasa / POS",
    title: "POS Mülkiyet",
    description: "POS cihazının kime ait olduğu.",
  },
  {
    key: "kunye_alim_yili",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Kasa / POS",
    title: "Alım Yılı Aralığı",
    description: "POS/kasa cihaz yaş aralığı.",
  },

  {
    key: "kunye_bilgisayar_markasi",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Donanım",
    title: "Sabit Bilgisayar Markası",
    description: "Sabit kasa bilgisayarı markaları.",
  },
  {
    key: "kunye_reyon_cihaz_modeli",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Donanım",
    title: "Reyon Cihaz Modeli",
    description: "Reyon cihazı/terminal markaları.",
  },
  {
    key: "kunye_el_terminali_modeli",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Donanım",
    title: "El Terminali Modeli",
    description: "El terminali marka/model kırılımı.",
  },

  {
    key: "kunye_odeme_yazilimi",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Yazılım / Entegrasyon",
    title: "Ödeme Yazılımı",
    description: "Ödeme yazılımı sağlayıcıları.",
  },
  {
    key: "kunye_erp",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Yazılım / Entegrasyon",
    title: "ERP",
    description: "ERP ve ana iş yazılımı listesi.",
  },
  {
    key: "kunye_evet_hayir",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Yazılım / Entegrasyon",
    title: "Evet / Hayır",
    description: "Künye içindeki ortak evet/hayır seçimleri.",
  },

  {
    key: "kunye_banka",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Finans / Hizmet",
    title: "Bankalar",
    description: "POS/banka ilişkisi için banka listesi.",
  },
  {
    key: "kunye_saha_hizmeti_firmasi",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Finans / Hizmet",
    title: "Saha Hizmeti Firması",
    description: "Saha hizmeti sağlayıcıları.",
  },
  {
    key: "kunye_memnuniyet",
    module: "Liste Yönetimleri",
    category: "Müşteri Künye · Finans / Hizmet",
    title: "Memnuniyet",
    description: "Memnuniyet değerlendirme seçenekleri.",
  },
] as const;

export const DEFAULT_KUNYE_OPTIONS: Record<string, ParameterOption[]> = {
  kunye_magaza_sayisi: ["1-25", "26-200", "201-500", "500+"].map(
    (value, index) => ({ label: value, value, sortOrder: (index + 1) * 10 }),
  ),
  kunye_franchise_sayisi: ["Yok", "1-25", "26-200", "201-500", "500+"].map(
    (value, index) => ({ label: value, value, sortOrder: (index + 1) * 10 }),
  ),
  kunye_sabit_kasa_adedi: [
    "Kullanılmıyor",
    "1-25",
    "26-200",
    "201-500",
    "500+",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_kasapos_firmasi: [
    "Nebim",
    "Toshiba",
    "Echopos",
    "NCR",
    "Encore",
    "Enpos",
    "Logo",
    "Posback",
    "Smartpos",
    "Barsoft",
    "Protel",
    "Avion",
    "Inhouse",
    "Denpos",
    "Diğer",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_pos_modeli: ["ÖKC", "EFT"].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_pos_markasi: [
    "Ingenico",
    "Verifone",
    "PAX",
    "Pavo",
    "Hugin",
    "Sunmi",
    "Profilo",
    "Beko",
    "Vera",
    "Inpos",
    "Diğer",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_alim_yili: ["1 yıldan az", "1-3 yıl", "3-5 yıl", "5+ yıl"].map(
    (value, index) => ({ label: value, value, sortOrder: (index + 1) * 10 }),
  ),
  kunye_bilgisayar_markasi: [
    "HP",
    "Posback",
    "Echopos",
    "Toshiba",
    "Enpos",
    "NCR",
    "Encore",
    "D&N",
    "OEM",
    "Diğer",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_evet_hayir: ["Hayır", "Evet"].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_odeme_yazilimi: [
    "Logo",
    "Nebim",
    "Genius",
    "NCR",
    "Tera",
    "Enpos",
    "In House",
    "Diğer",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_reyon_cihaz_modeli: [
    "Zebra",
    "Honeywell",
    "Datalogic",
    "Newland",
    "Sunmi",
    "PAX",
    "Diğer",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_el_terminali_modeli: [
    "Honeywell",
    "iData",
    "Disc",
    "Zebra",
    "Newland",
    "Point Mobile",
    "Urovo",
    "Telefon",
    "Diğer",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_erp: [
    "Logo",
    "Nebim",
    "Genius",
    "NCR",
    "Tera",
    "Enpos",
    "Mikro",
    "Posback",
    "SAP",
    "AXAPTA",
    "Oracle",
    "Uyumsoft",
    "Giz",
    "In House",
    "Diğer",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_banka: [
    "Akbank",
    "Garanti BBVA",
    "İş Bankası",
    "Yapı Kredi",
    "Halkbank",
    "VakıfBank",
    "Ziraat Bankası",
    "QNB",
    "TEB",
    "DenizBank",
    "AktifBank",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_pos_mulkiyet: ["Kendisi", "Banka", "Bankada"].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_saha_hizmeti_firmasi: [
    "Bilinmiyor",
    "Teknoser",
    "IBM",
    "Payser",
    "Diğer",
  ].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  kunye_memnuniyet: ["Memnun", "Orta", "Memnun Değil"].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
};
export const PHASE_PARAMETER_GROUPS = [
  {
    key: "faz_tanimlari",
    module: "Liste Yönetimleri",
    category: "Faz Yönetimi · Müşteri Pipeline",
    title: "Müşteri Faz Tanımları",
    description:
      "Normal müşteri pipeline fazları. Faz no, ad ve owner burada yönetilir.",
    type: "phase",
  },
  {
    key: "is_ortagi_faz_tanimlari",
    module: "Liste Yönetimleri",
    category: "Faz Yönetimi · İş Ortakları",
    title: "İş Ortağı Faz Tanımları",
    description:
      "İş ortakları aktivitelerinde Account ekibinin kullanacağı ayrı faz listesi.",
    type: "phase",
  },
] as const;

export const CRM_MASTER_DATA_PARAMETER_GROUPS = [
  {
    key: "crm_sector",
    module: "CRM",
    category: "Ana Veri",
    title: "Sektörler",
    description: "Müşteri oluşturma, düzenleme ve filtrelemede kullanılan sektör kataloğu.",
    type: "text",
  },
  {
    key: "crm_integration_type",
    module: "CRM",
    category: "Ana Veri",
    title: "Entegrasyon Tipleri",
    description: "Müşterilerde seçilebilen entegrasyon yapıları.",
    type: "text",
  },
  {
    key: "crm_sales_probability",
    module: "CRM",
    category: "Ana Veri",
    title: "Satış Olasılıkları",
    description: "Müşteri ve fırsat kayıtlarında kullanılabilen satış olasılığı değerleri.",
    type: "text",
  },
  {
    key: "crm_customer_type",
    module: "CRM",
    category: "Müşteri Politikası",
    title: "Müşteri Tipleri",
    description: "Sektörden bağımsız müşteri iş akışı sınıflandırması.",
    type: "text",
  },
  {
    key: "crm_pipeline_policy",
    module: "CRM",
    category: "Müşteri Politikası",
    title: "Pipeline Politikaları",
    description: "Müşterinin aktivite sırasında faz kullanıp kullanmayacağını açıkça belirler.",
    type: "text",
  },
  {
    key: "quote_probability",
    module: "Teklif",
    category: "Ticari Politika",
    title: "Teklif Olasılıkları",
    description: "Teklif oluşturma ve düzenlemede kullanılabilen yüzde değerleri.",
    type: "text",
  },
  {
    key: "activity_waiting_party",
    module: "CRM",
    category: "Aktivite Politikası",
    title: "Bekleyen Taraflar",
    description: "Aktivite kaydında sorumluluğun kimde beklediğini belirleyen kanonik liste.",
    type: "text",
  },
] as const;

export const FORECAST_PARAMETER_GROUPS = [
  {
    key: "forecast_sales_channel",
    module: "CRM",
    category: "Forecast",
    title: "Forecast Satis Kanallari",
    description: "Forecast girisinde secilecek satis kanali listesi.",
    type: "text",
  },
  {
    key: "forecast_probability",
    module: "CRM",
    category: "Forecast",
    title: "Forecast Gerceklesme Oranlari",
    description: "Forecast kaydi icin secilecek olasilik yuzdeleri.",
    type: "text",
  },
] as const;

export const SYSTEM_BEHAVIOR_PARAMETER_GROUPS = [
  {
    key: "system_oidc_enabled",
    module: "Kimlik ve Erişim",
    category: "Active Directory / OIDC",
    title: "Kurumsal Giriş",
    description: "IT bilgileri tamamlandıktan sonra Active Directory / OIDC girişini açar. Şimdilik kapalı tutulmalıdır.",
    type: "boolean",
  },
  {
    key: "system_oidc_group_role_sync_enabled",
    module: "Kimlik ve Erişim",
    category: "Active Directory / OIDC",
    title: "AD Grup-Rol Senkronizasyonu",
    description: "AD grup üyeliklerinin CRM rollerine uygulanmasını açar. Eşlemeler doğrulanmadan etkinleştirilmemelidir.",
    type: "boolean",
  },
  {
    key: "system_jira_enabled",
    module: "Entegrasyonlar",
    category: "Jira",
    title: "Jira Entegrasyonu",
    description: "Jira veri çekme ve rapor entegrasyonunu aç/kapatır.",
    type: "boolean",
  },
  {
    key: "system_jira_weekly_pptx_enabled",
    module: "Entegrasyonlar",
    category: "Jira",
    title: "Yönetim Sunumu Jira Slaytı",
    description:
      "Haftalık yönetim sunumuna Jira slaytı eklenip eklenmeyeceğini belirler.",
    type: "boolean",
  },
  {
    key: "system_jira_debug_enabled",
    module: "Güvenlik ve Tanı",
    category: "Teknik İzleme",
    title: "Jira Tanı Bilgisi",
    description: "Jira sorunlarında teknik tanı bilgilerini görünür tutar.",
    type: "boolean",
  },
  {
    key: "system_pptx_download_enabled",
    module: "Sistem Ayarları",
    category: "Raporlama",
    title: "PPTX İndirme",
    description: "Sunum/PPTX dışa aktarımını merkezi olarak aç/kapatır.",
    type: "boolean",
  },
  {
    key: "system_page_size",
    module: "Sistem Ayarları",
    category: "Performans",
    title: "Varsayılan Sayfa Boyutu",
    description: "Sayfalı listelerde varsayılan kayıt adedini belirler.",
    type: "number",
  },
] as const;

export const ALL_PARAMETER_GROUPS = [
  ...KUNYE_PARAMETER_GROUPS,
  ...PHASE_PARAMETER_GROUPS,
  ...CRM_MASTER_DATA_PARAMETER_GROUPS,
  ...FORECAST_PARAMETER_GROUPS,
  ...SYSTEM_BEHAVIOR_PARAMETER_GROUPS,
] as const;

export const DEFAULT_FORECAST_OPTIONS: Record<string, ParameterOption[]> = {
  forecast_sales_channel: [
    { label: "Banka", value: "Banka", sortOrder: 10 },
    { label: "Direkt Satis", value: "Direkt Satis", sortOrder: 20 },
    { label: "Kanal", value: "Kanal", sortOrder: 30 },
  ],
  forecast_probability: [
    { label: "%30", value: "30", sortOrder: 10 },
    { label: "%60", value: "60", sortOrder: 20 },
    { label: "%90", value: "90", sortOrder: 30 },
  ],
};

export const DEFAULT_CRM_MASTER_DATA_OPTIONS: Record<string, ParameterOption[]> = {
  crm_sector: [
    "Elektronik & Beyaz Eşya",
    "Ev & Yaşam / Yapı Market",
    "FMCG Dağıtım Kanalları",
    "Gıda Perakendesi",
    "Hazır Giyim",
    "Lojistik & Kargo",
    "Yeme-İçme",
    "BANKA",
    "VERTICAL",
    "İŞ ORTAĞI",
  ].map((value, index) => ({ label: value, value, sortOrder: (index + 1) * 10 })),
  crm_integration_type: ["A2A", "D2D", "D2D+A2A"].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  crm_sales_probability: ["Düşük", "Orta", "Yüksek"].map((value, index) => ({
    label: value,
    value,
    sortOrder: (index + 1) * 10,
  })),
  crm_customer_type: [
    { label: "Standart Müşteri", value: "standard", sortOrder: 10 },
    { label: "İş Ortağı", value: "business_partner", sortOrder: 20 },
  ],
  crm_pipeline_policy: [
    { label: "Faz Zorunlu", value: "phase_required", sortOrder: 10 },
    { label: "Yalnız Aktivite / Fazsız", value: "phase_optional", sortOrder: 20 },
  ],
  quote_probability: [10, 30, 60, 90].map((value, index) => ({
    label: `%${value}`,
    value: String(value),
    sortOrder: (index + 1) * 10,
  })),
  activity_waiting_party: [
    "Müşteri",
    "Müşteri IT",
    "Müşteri (Finance Owner)",
    "PAX RS(Support)",
  ].map((value, index) => ({ label: value, value, sortOrder: (index + 1) * 10 })),
};

export const DEFAULT_SYSTEM_BEHAVIOR_OPTIONS: Record<
  string,
  ParameterOption[]
> = {
  system_oidc_enabled: [{ label: "Kapalı", value: "false", sortOrder: 10 }],
  system_oidc_group_role_sync_enabled: [{ label: "Kapalı", value: "false", sortOrder: 10 }],
  system_jira_enabled: [{ label: "Aktif", value: "true", sortOrder: 10 }],
  system_jira_weekly_pptx_enabled: [
    { label: "Aktif", value: "true", sortOrder: 10 },
  ],
  system_jira_debug_enabled: [{ label: "Aktif", value: "true", sortOrder: 10 }],
  system_pptx_download_enabled: [
    { label: "Aktif", value: "true", sortOrder: 10 },
  ],
  system_page_size: [{ label: "25", value: "25", sortOrder: 10 }],
};

export const DEFAULT_PARAMETER_OPTIONS: Record<string, ParameterOption[]> = {
  ...DEFAULT_KUNYE_OPTIONS,
  ...DEFAULT_CRM_MASTER_DATA_OPTIONS,
  ...DEFAULT_FORECAST_OPTIONS,
  ...DEFAULT_SYSTEM_BEHAVIOR_OPTIONS,
};

export type ParameterGroupDefinition = (typeof ALL_PARAMETER_GROUPS)[number];

function slugifyParamKey(value: string) {
  return (
    String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "parametre"
  );
}

export function fallbackKunyeOptions() {
  return Object.fromEntries(
    Object.entries(DEFAULT_KUNYE_OPTIONS).map(([key, values]) => [
      key,
      values.map((item) => ({ label: item.label, value: item.value })),
    ]),
  ) as Record<string, Array<{ label: string; value: string }>>;
}

export async function getActiveParametersByGroups(groupKeys: string[]) {
  if (!groupKeys.length) return [] as SystemParameter[];
  const result = await db.query(
    `
      select id, group_key, param_key, label, value, sort_order, is_active, meta
      from public.system_parameters
      where group_key = any($1::text[])
        and is_active = true
      order by group_key asc, sort_order asc, label asc
    `,
    [groupKeys],
  );
  return result.rows as SystemParameter[];
}

export type ParameterOptionsByGroup = Record<string, Array<{ label: string; value: string }>>;

export const PARAMETER_GROUPS_REQUIRING_ACTIVE_VALUE = new Set([
  "crm_sector",
  "crm_integration_type",
  "crm_customer_type",
  "crm_pipeline_policy",
  "quote_probability",
  "activity_waiting_party",
  "forecast_sales_channel",
  "forecast_probability",
  "system_page_size",
]);

function fallbackOptionsForGroups(groupKeys: readonly string[]): ParameterOptionsByGroup {
  return Object.fromEntries(
    groupKeys.map((groupKey) => [
      groupKey,
      (DEFAULT_PARAMETER_OPTIONS[groupKey] ?? []).map((item) => ({ label: item.label, value: item.value })),
    ]),
  );
}

export async function getParameterOptionsByGroups(groupKeys: readonly string[]) {
  const keys = Array.from(new Set(groupKeys.map((key) => String(key).trim()).filter(Boolean)));
  if (!keys.length) return {} as ParameterOptionsByGroup;

  try {
    const rows = await getActiveParametersByGroups(keys);
    const grouped: ParameterOptionsByGroup = Object.fromEntries(keys.map((key) => [key, []]));
    for (const row of rows) grouped[row.group_key]?.push({ label: row.label, value: row.value });
    const fallback = fallbackOptionsForGroups(keys);
    for (const key of keys) {
      if (!grouped[key]?.length) grouped[key] = fallback[key] ?? [];
    }
    return grouped;
  } catch {
    // Migration öncesi geriye uyum: uygulama eski sürümle aynı kanonik
    // değerlerle çalışır. Migration sonrası DB tek gerçek kaynak olur.
    return fallbackOptionsForGroups(keys);
  }
}

export async function getCrmMasterDataOptions() {
  return getParameterOptionsByGroups(Object.keys(DEFAULT_CRM_MASTER_DATA_OPTIONS));
}

export async function assertActiveParameterValue(
  groupKey: string,
  value: string | null | undefined,
  options: { optional: true },
): Promise<string | null>;
export async function assertActiveParameterValue(
  groupKey: string,
  value: string | null | undefined,
  options?: { optional?: false },
): Promise<string>;
export async function assertActiveParameterValue(
  groupKey: string,
  value: string | null | undefined,
  options?: { optional?: boolean },
) {
  const normalized = String(value ?? "").trim();
  if (!normalized && options?.optional) return null;
  if (!normalized) throw Object.assign(new Error("Parametre değeri zorunlu."), { status: 400 });

  const grouped = await getParameterOptionsByGroups([groupKey]);
  const allowed = new Set((grouped[groupKey] ?? []).map((item) => item.value));
  if (!allowed.has(normalized)) {
    throw Object.assign(new Error(`Geçersiz veya pasif parametre değeri: ${groupKey}`), { status: 400 });
  }
  return normalized;
}

export async function getKunyeOptions() {
  try {
    const groupKeys = Object.keys(DEFAULT_KUNYE_OPTIONS);
    const rows = await getActiveParametersByGroups(groupKeys);
    const grouped: Record<string, Array<{ label: string; value: string }>> = {};

    for (const key of groupKeys) grouped[key] = [];
    for (const row of rows) {
      if (!grouped[row.group_key]) grouped[row.group_key] = [];
      grouped[row.group_key].push({ label: row.label, value: row.value });
    }
    const fallback = fallbackKunyeOptions();
    for (const key of groupKeys) {
      if (!grouped[key]?.length) grouped[key] = fallback[key] ?? [];
    }
    return grouped;
  } catch {
    return fallbackKunyeOptions();
  }
}

export type PhaseParameterRow = {
  id: string;
  source: "customer" | "business_partner";
  group_key: "faz_tanimlari" | "is_ortagi_faz_tanimlari";
  faz_no: number;
  asama_adi: string;
  owner: string | null;
  is_active: boolean;
  sort_order: number;
};

function mapPhaseRow(
  row: any,
  source: "customer" | "business_partner",
): PhaseParameterRow {
  const group_key =
    source === "business_partner" ? "is_ortagi_faz_tanimlari" : "faz_tanimlari";
  return {
    id: String(row.id ?? `${group_key}:${row.faz_no}`),
    source,
    group_key,
    faz_no: Number(row.faz_no),
    asama_adi: String(row.asama_adi ?? "").trim(),
    owner: row.owner == null ? null : String(row.owner).trim(),
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    sort_order: Number(row.sort_order ?? row.faz_no ?? 0) || 0,
  };
}

export async function listPhaseParameters() {
  const [customerPhases, partnerPhases] = await Promise.all([
    db
      .query(
        `
      select coalesce(id::text, faz_no::text) as id, faz_no, asama_adi, owner, true as is_active, faz_no as sort_order
      from public.faz_tanimlari
      order by faz_no asc
    `,
      )
      .catch(() => ({ rows: [] })),
    db.query(`
      select id::text, faz_no, asama_adi, owner, is_active, sort_order
      from public.is_ortagi_faz_tanimlari
      order by sort_order asc, faz_no asc
    `),
  ]);
  return [
    ...((customerPhases as any).rows ?? []).map((row: any) =>
      mapPhaseRow(row, "customer"),
    ),
    ...((partnerPhases as any).rows ?? []).map((row: any) =>
      mapPhaseRow(row, "business_partner"),
    ),
  ];
}

export async function createPhaseParameter(input: {
  groupKey: string;
  fazNo: number;
  asamaAdi: string;
  owner?: string | null;
  sortOrder?: number;
}) {
  const fazNo = Number(input.fazNo);
  if (!Number.isFinite(fazNo) || fazNo <= 0)
    throw Object.assign(new Error("Faz no pozitif sayı olmalı."), {
      status: 400,
    });
  const asamaAdi = String(input.asamaAdi ?? "").trim();
  if (!asamaAdi)
    throw Object.assign(new Error("Faz adı zorunlu."), { status: 400 });
  const owner = String(input.owner ?? "").trim() || null;
  if (input.groupKey === "is_ortagi_faz_tanimlari") {
    const result = await db.query(
      `
      insert into public.is_ortagi_faz_tanimlari (faz_no, asama_adi, owner, is_active, sort_order)
      values ($1, $2, $3, true, $4)
      on conflict (faz_no) do nothing
      returning id::text, faz_no, asama_adi, owner, is_active, sort_order
    `,
      [fazNo, asamaAdi, owner, Number(input.sortOrder ?? fazNo)],
    );
    if (!result.rows[0])
      throw Object.assign(
        new Error("Bu iş ortağı faz no zaten var. Düzenle butonuyla güncelle."),
        { status: 409 },
      );
    return mapPhaseRow(result.rows[0], "business_partner");
  }
  const result = await db.query(
    `
    insert into public.faz_tanimlari (faz_no, asama_adi, owner)
    values ($1, $2, $3)
    on conflict (faz_no) do nothing
    returning coalesce(id::text, faz_no::text) as id, faz_no, asama_adi, owner, true as is_active, faz_no as sort_order
  `,
    [fazNo, asamaAdi, owner],
  );
  if (!result.rows[0])
    throw Object.assign(
      new Error("Bu müşteri faz no zaten var. Düzenle butonuyla güncelle."),
      { status: 409 },
    );
  return mapPhaseRow(result.rows[0], "customer");
}

export async function updatePhaseParameter(input: {
  groupKey: string;
  id?: string;
  fazNo?: number;
  asamaAdi?: string;
  owner?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const fazNo = Number(input.fazNo);
  if (!Number.isFinite(fazNo) || fazNo <= 0)
    throw Object.assign(new Error("Faz no zorunlu."), { status: 400 });
  const asamaAdi =
    typeof input.asamaAdi === "string" ? input.asamaAdi.trim() : null;
  const owner =
    typeof input.owner === "string" ? input.owner.trim() || null : undefined;
  if (input.groupKey === "is_ortagi_faz_tanimlari") {
    const result = await db.query(
      `
      update public.is_ortagi_faz_tanimlari
      set asama_adi = coalesce($2, asama_adi),
          owner = coalesce($3, owner),
          sort_order = coalesce($4, sort_order),
          is_active = coalesce($5, is_active),
          updated_at = now()
      where faz_no = $1
      returning id::text, faz_no, asama_adi, owner, is_active, sort_order
    `,
      [
        fazNo,
        asamaAdi,
        owner,
        input.sortOrder ?? null,
        typeof input.isActive === "boolean" ? input.isActive : null,
      ],
    );
    return result.rows[0]
      ? mapPhaseRow(result.rows[0], "business_partner")
      : null;
  }
  const result = await db.query(
    `
    update public.faz_tanimlari
    set asama_adi = coalesce($2, asama_adi),
        owner = coalesce($3, owner)
    where faz_no = $1
    returning coalesce(id::text, faz_no::text) as id, faz_no, asama_adi, owner, true as is_active, faz_no as sort_order
  `,
    [fazNo, asamaAdi, owner],
  );
  return result.rows[0] ? mapPhaseRow(result.rows[0], "customer") : null;
}

export async function deletePhaseParameter(input: {
  groupKey: string;
  fazNo: number;
}) {
  const fazNo = Number(input.fazNo);
  if (input.groupKey === "is_ortagi_faz_tanimlari") {
    const result = await db.query(
      "update public.is_ortagi_faz_tanimlari set is_active = false, updated_at = now() where faz_no = $1 returning faz_no",
      [fazNo],
    );
    return (result.rowCount ?? 0) > 0;
  }
  throw Object.assign(
    new Error('Müşteri faz tanımları geçmiş kayıtları korumak için silinemez; adını güncelleyin.'),
    { status: 409 },
  );
}

export async function listPartnerPhaseOptions() {
  const result = await db.query(`
    select faz_no, asama_adi, owner
    from public.is_ortagi_faz_tanimlari
    where is_active = true
    order by sort_order asc, faz_no asc
  `);
  return result.rows;
}

export async function listSystemParameters() {
  const result = await db.query(
    `
      select id, group_key, param_key, label, value, sort_order, is_active, version, meta
      from public.system_parameters
      where group_key = any($1::text[])
      order by group_key asc, sort_order asc, label asc
    `,
    [Object.keys(DEFAULT_PARAMETER_OPTIONS)],
  );
  return result.rows as SystemParameter[];
}

export async function getSystemParameterGroupKey(id: string) {
  const result = await db.query(
    "select group_key from public.system_parameters where id = $1 limit 1",
    [id],
  );
  return result.rows[0]?.group_key ? String(result.rows[0].group_key) : null;
}

export async function createSystemParameter(input: {
  groupKey: string;
  label: string;
  value?: string;
  sortOrder?: number;
}) {
  const label = input.label.trim();
  const value = (input.value ?? input.label).trim();
  const paramKey = slugifyParamKey(value);
  const result = await db.query(
    `
      insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active, meta)
      values ($1, $2, $3, $4, $5, true, jsonb_build_object('source', 'admin'))
      on conflict (group_key, param_key) do nothing
      returning id, group_key, param_key, label, value, sort_order, is_active, version, meta
    `,
    [input.groupKey, paramKey, label, value, Number(input.sortOrder ?? 999)],
  );
  const row = result.rows[0] as SystemParameter | undefined;
  if (!row)
    throw Object.assign(
      new Error(
        "Bu parametre zaten var. Düzenle butonuyla mevcut kaydı güncellemelisin.",
      ),
      { status: 409 },
    );
  return row;
}

export async function getSystemParameterValue(
  groupKey: string,
  fallback: string,
) {
  try {
    const result = await db.query(
      `
        select value
        from public.system_parameters
        where group_key = $1 and is_active = true
        order by sort_order asc, label asc
        limit 1
      `,
      [groupKey],
    );
    return String(result.rows[0]?.value ?? fallback);
  } catch {
    return fallback;
  }
}

export async function getSystemParameterBoolean(
  groupKey: string,
  fallback = false,
) {
  const raw = (
    await getSystemParameterValue(groupKey, fallback ? "true" : "false")
  )
    .trim()
    .toLocaleLowerCase("tr-TR");
  return ["1", "true", "evet", "aktif", "yes", "on"].includes(raw);
}

export async function updateSystemParameter(input: {
  id: string;
  label?: string;
  value?: string;
  sortOrder?: number;
  isActive?: boolean;
  updatedByUserId?: string | null;
  expectedVersion?: number;
}) {
  if (input.isActive === false) {
    await assertParameterCanBeDeactivated(input.id);
  }
  const currentResult = await db.query(
    "select value, version from public.system_parameters where id = $1",
    [input.id],
  );
  const currentRow = currentResult.rows[0] as { value?: string; version?: number } | undefined;
  if (!currentRow) return undefined;
  if (input.expectedVersion !== undefined && Number(currentRow.version) !== input.expectedVersion) {
    throw Object.assign(new Error("Parametre başka bir kullanıcı tarafından güncellendi. Listeyi yenileyip tekrar deneyin."), { status: 409 });
  }
  if (input.value !== undefined) {
    const currentValue = String(currentRow.value ?? "");
    if (input.value.trim() !== currentValue) {
      throw Object.assign(
        new Error("Kanonik parametre kodu değiştirilemez. Yeni bir değer oluşturup eski değeri pasife alın."),
        { status: 409 },
      );
    }
  }
  const result = await db.query(
    `
      update public.system_parameters
      set label = coalesce($2, label),
          value = value,
          sort_order = coalesce($3, sort_order),
          is_active = coalesce($4, is_active),
          version = version + 1,
          updated_by_user_id = coalesce($5::uuid, updated_by_user_id),
          updated_at = now()
      where id = $1
        and ($6::integer is null or version = $6)
      returning id, group_key, param_key, label, value, sort_order, is_active, version, meta
    `,
    [
      input.id,
      input.label?.trim() || null,
      input.sortOrder ?? null,
      typeof input.isActive === "boolean" ? input.isActive : null,
      input.updatedByUserId ?? null,
      input.expectedVersion ?? null,
    ],
  );
  if (!result.rows[0] && input.expectedVersion !== undefined) {
    throw Object.assign(new Error("Parametre başka bir kullanıcı tarafından güncellendi. Listeyi yenileyip tekrar deneyin."), { status: 409 });
  }
  return result.rows[0] as SystemParameter | undefined;
}

export async function assertParameterCanBeDeactivated(id: string) {
  const rowResult = await db.query(
    "select group_key, is_active from public.system_parameters where id = $1",
    [id],
  );
  const row = rowResult.rows[0] as { group_key?: string; is_active?: boolean } | undefined;
  if (!row?.is_active || !row.group_key || !PARAMETER_GROUPS_REQUIRING_ACTIVE_VALUE.has(row.group_key)) return;

  const countResult = await db.query(
    "select count(*)::integer as count from public.system_parameters where group_key = $1 and is_active = true and id <> $2",
    [row.group_key, id],
  );
  if (Number(countResult.rows[0]?.count ?? 0) < 1) {
    throw Object.assign(new Error("Bu parametre grubunda en az bir aktif değer kalmalıdır."), { status: 409 });
  }
}

export async function deleteSystemParameter(id: string, updatedByUserId?: string | null) {
  await assertParameterCanBeDeactivated(id);
  const result = await db.query(
    "update public.system_parameters set is_active = false, version = version + 1, updated_by_user_id = coalesce($2::uuid, updated_by_user_id), updated_at = now() where id = $1 returning id",
    [id, updatedByUserId ?? null],
  );
  return (result.rowCount ?? 0) > 0;
}
