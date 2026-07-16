import { db } from "@/lib/db";

export type SystemParameter = {
  id: string;
  group_key: string;
  param_key: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
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

export const CRM_ACTIVITY_PARAMETER_GROUPS = [
  {
    key: "crm_phase_optional_responsibles",
    module: "CRM",
    category: "Aktivite Akışı",
    title: "Faz İstemeyecek Sorumlular",
    description:
      "Bu listede yer alan sorumlulara bağlı müşterilerde aktivite eklerken faz istenmez ve kayıt pipeline/faz değiştirmez.",
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
  ...CRM_ACTIVITY_PARAMETER_GROUPS,
  ...FORECAST_PARAMETER_GROUPS,
  ...SYSTEM_BEHAVIOR_PARAMETER_GROUPS,
] as const;

export const DEFAULT_CRM_ACTIVITY_OPTIONS: Record<string, ParameterOption[]> = {
  crm_phase_optional_responsibles: [],
};

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

export const DEFAULT_SYSTEM_BEHAVIOR_OPTIONS: Record<
  string,
  ParameterOption[]
> = {
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
  ...DEFAULT_CRM_ACTIVITY_OPTIONS,
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

export async function ensureSystemParametersTable() {
  await db.query(`
    create table if not exists public.system_parameters (
      id uuid primary key default gen_random_uuid(),
      group_key text not null,
      param_key text not null,
      label text not null,
      value text not null,
      sort_order integer not null default 0,
      is_active boolean not null default true,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (group_key, param_key)
    )
  `);
  await db.query(
    `create index if not exists idx_system_parameters_group_active_sort on public.system_parameters (group_key, is_active, sort_order, label)`,
  );
}

export async function seedDefaultKunyeParameters() {
  await ensureSystemParametersTable();
  for (const [groupKey, values] of Object.entries(DEFAULT_PARAMETER_OPTIONS)) {
    // CRM aktivite faz muafiyeti sadece DB/Parametreler ekranından yönetilir.
    // Burada default Seda/Cem seed edilirse kullanıcı silince tekrar aktif oluşur.
    if (groupKey === "crm_phase_optional_responsibles") continue;
    for (const item of values) {
      await db.query(
        `
          insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active, meta)
          values ($1, $2, $3, $4, $5, true, jsonb_build_object('source', 'default_seed'))
          on conflict (group_key, param_key) do nothing
        `,
        [
          groupKey,
          slugifyParamKey(item.value),
          item.label,
          item.value,
          item.sortOrder ?? 0,
        ],
      );
    }
  }
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

export async function getKunyeOptions() {
  try {
    await ensureSystemParametersTable();
    const groupKeys = Object.keys(DEFAULT_KUNYE_OPTIONS);
    const rows = await getActiveParametersByGroups(groupKeys);
    const grouped: Record<string, Array<{ label: string; value: string }>> = {};

    for (const key of groupKeys) grouped[key] = [];
    for (const row of rows) {
      if (!grouped[row.group_key]) grouped[row.group_key] = [];
      grouped[row.group_key].push({ label: row.label, value: row.value });
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

export async function ensureBusinessPartnerPhaseTable() {
  await db.query(`
    create table if not exists public.is_ortagi_faz_tanimlari (
      id uuid primary key default gen_random_uuid(),
      faz_no integer not null unique,
      asama_adi text not null,
      owner text null,
      is_active boolean not null default true,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await db.query(
    `create index if not exists idx_is_ortagi_faz_tanimlari_active_sort on public.is_ortagi_faz_tanimlari (is_active, sort_order, faz_no)`,
  );
}

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
  await ensureBusinessPartnerPhaseTable();
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
    await ensureBusinessPartnerPhaseTable();
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
    await ensureBusinessPartnerPhaseTable();
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
    await ensureBusinessPartnerPhaseTable();
    const result = await db.query(
      "delete from public.is_ortagi_faz_tanimlari where faz_no = $1 returning faz_no",
      [fazNo],
    );
    return (result.rowCount ?? 0) > 0;
  }
  const result = await db.query(
    "delete from public.faz_tanimlari where faz_no = $1 returning faz_no",
    [fazNo],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listPartnerPhaseOptions() {
  await ensureBusinessPartnerPhaseTable();
  const result = await db.query(`
    select faz_no, asama_adi, owner
    from public.is_ortagi_faz_tanimlari
    where is_active = true
    order by sort_order asc, faz_no asc
  `);
  return result.rows;
}

export async function listCrmResponsibleOptions() {
  const result = await db
    .query(
      `
    select distinct trim(sorumlu) as value
    from public.musteriler
    where sorumlu is not null
      and trim(sorumlu) <> ''
    order by trim(sorumlu) asc
  `,
    )
    .catch(() => ({ rows: [] }));
  return ((result as any).rows ?? [])
    .map((row: any) => String(row.value ?? "").trim())
    .filter(Boolean)
    .map((value: string) => ({ label: value, value }));
}

export async function listSystemParameters() {
  await seedDefaultKunyeParameters();
  const result = await db.query(
    `
      select id, group_key, param_key, label, value, sort_order, is_active, meta
      from public.system_parameters
      where group_key = any($1::text[])
      order by group_key asc, sort_order asc, label asc
    `,
    [Object.keys(DEFAULT_PARAMETER_OPTIONS)],
  );
  return result.rows as SystemParameter[];
}

export async function createSystemParameter(input: {
  groupKey: string;
  label: string;
  value?: string;
  sortOrder?: number;
}) {
  await ensureSystemParametersTable();
  const label = input.label.trim();
  const value = (input.value ?? input.label).trim();
  const paramKey = slugifyParamKey(value);
  const result = await db.query(
    `
      insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active, meta)
      values ($1, $2, $3, $4, $5, true, jsonb_build_object('source', 'admin'))
      on conflict (group_key, param_key) do nothing
      returning id, group_key, param_key, label, value, sort_order, is_active, meta
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
    await ensureSystemParametersTable();
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
  fallback = true,
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
}) {
  const result = await db.query(
    `
      update public.system_parameters
      set label = coalesce($2, label),
          value = coalesce($3, value),
          sort_order = coalesce($4, sort_order),
          is_active = coalesce($5, is_active),
          updated_at = now()
      where id = $1
      returning id, group_key, param_key, label, value, sort_order, is_active, meta
    `,
    [
      input.id,
      input.label?.trim() || null,
      input.value?.trim() || null,
      input.sortOrder ?? null,
      typeof input.isActive === "boolean" ? input.isActive : null,
    ],
  );
  return result.rows[0] as SystemParameter | undefined;
}

export async function deleteSystemParameter(id: string) {
  const result = await db.query(
    "delete from public.system_parameters where id = $1 returning id",
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
