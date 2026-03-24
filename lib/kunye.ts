export type KunyePayload = {
  firma_adi?: string | null;
  magaza_sayisi?: string | null;
  franchise_sayisi?: string | null;

  sabit_kasa_adedi?: string | null;
  kasapos_firmasi?: string | null;
  pos_modeli?: string | null;
  pos_markasi?: string | null;
  toplam_pos_adedi?: string | null;
  pos_alim_yili?: string | null;
  sabit_bilgisayar_markasi?: string | null;
  pos_notu?: string | null;

  reyon_kullaniliyor?: string | null;
  reyon_odeme_yazilimi?: string | null;
  reyon_cihaz_modeli?: string | null;
  reyon_cihaz_sayisi?: string | null;
  reyon_alim_yili?: string | null;

  el_terminali_kullaniliyor?: string | null;
  el_terminali_modeli?: string | null;
  el_terminali_yazilimi?: string | null;
  el_terminali_adedi?: string | null;
  el_terminali_alim_yili?: string | null;

  erp?: string | null;
  bankalar?: string[] | string | null;
  pos_mulkiyet?: string | null;
  pos_mulkiyet_bankalari?: string[] | string | null;
  saha_hizmeti_firmasi?: string | null;

  genel_memnuniyet?: string | null;
  risk?: string | null;
  entegrasyon_yapisi?: string | null;
  account?: string | null;
  problem_1?: string | null;
  problem_2?: string | null;
  problem_3?: string | null;
  degisim_nedeni?: string | null;
};

export type KunyeStatusInput = Partial<KunyePayload> & {
  has_kunye_record?: boolean;
};

export function trimOrNull(value: unknown) {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

export function normalizeDelimitedList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const cleaned = value.map((item) => String(item ?? '').trim()).filter(Boolean);
    return cleaned.length ? cleaned : null;
  }
  const s = trimOrNull(value);
  if (!s) return null;
  const cleaned = s.split(',').map((item) => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

const RANGE_VALUES = ['Kullanılmıyor', 'Yok', '1-25', '26-200', '201-500', '500+'] as const;
const POS_MARKASI_OPTIONS = ['ÖKC', 'Ingenico', 'Verifone', 'PAX', 'Pavo', 'Hugin', 'Sunmi', 'Diğer'] as const;
const KASAPOS_OPTIONS = ['Toshiba', 'NCR', 'Encore', 'Enpos', 'Logo', 'Nebim', 'Diğer'] as const;
const BILGISAYAR_MARKA_OPTIONS = ['HP', 'Dell', 'Lenovo', 'Asus', 'Casper', 'Apple', 'Diğer'] as const;
const ALIM_YILI_OPTIONS = ['1 yıldan az', '1-3 yıl', '3-5 yıl', '5+ yıl'] as const;
const MEMNUNIYET_OPTIONS = ['Memnun', 'Orta', 'Memnun Değil'] as const;

function normalizeSelectValue(
  value: unknown,
  options: readonly string[],
  fallback: string | null = null,
) {
  const raw = trimOrNull(value);
  if (!raw) return null;
  const found = options.find(
    (option) => option.toLocaleLowerCase('tr-TR') === raw.toLocaleLowerCase('tr-TR'),
  );
  if (found) return found;
  return fallback;
}

function normalizeRangeValue(value: unknown, allowYok = false) {
  const raw = trimOrNull(value);
  if (!raw) return null;

  const exact = RANGE_VALUES.find(
    (option) => option.toLocaleLowerCase('tr-TR') === raw.toLocaleLowerCase('tr-TR'),
  );
  if (exact) {
    if (exact === 'Yok' && !allowYok) return 'Kullanılmıyor';
    return exact;
  }

  const normalized = raw.toLocaleLowerCase('tr-TR');
  if (normalized === 'kullanilmiyor') return 'Kullanılmıyor';
  if (normalized === 'yok') return allowYok ? 'Yok' : 'Kullanılmıyor';

  const digits = raw.replace(/[^0-9]/g, '');
  const num = digits ? Number(digits) : NaN;
  if (!Number.isFinite(num)) return null;

  if (num <= 0) return allowYok ? 'Yok' : 'Kullanılmıyor';
  if (num <= 25) return '1-25';
  if (num <= 200) return '26-200';
  if (num <= 500) return '201-500';
  return '500+';
}

function normalizeAlimYiliValue(value: unknown) {
  const raw = trimOrNull(value);
  if (!raw) return null;

  const exact = normalizeSelectValue(raw, ALIM_YILI_OPTIONS);
  if (exact) return exact;

  const normalized = raw.toLocaleLowerCase('tr-TR');
  if (
    normalized.includes('1 yıldan az') ||
    normalized.includes('1 yildan az') ||
    normalized.includes('0-1')
  ) {
    return '1 yıldan az';
  }
  if (normalized.includes('1-3')) return '1-3 yıl';
  if (normalized.includes('3-5')) return '3-5 yıl';
  if (normalized.includes('5+') || normalized.includes('5 +')) return '5+ yıl';

  const onlyYear = raw.match(/^(19|20)\d{2}$/);
  if (onlyYear) {
    const year = Number(raw);
    const age = new Date().getFullYear() - year;
    if (age < 1) return '1 yıldan az';
    if (age <= 3) return '1-3 yıl';
    if (age <= 5) return '3-5 yıl';
    return '5+ yıl';
  }

  return null;
}

function normalizePosMarkasi(value: unknown) {
  const raw = trimOrNull(value);
  if (!raw) return null;

  const normalized = raw.toLocaleLowerCase('tr-TR');

  if (normalized.includes('ökc') || normalized.includes('okc')) return 'ÖKC';
  if (normalized.includes('ingenico')) return 'Ingenico';
  if (normalized.includes('verifone')) return 'Verifone';
  if (normalized.includes('pax')) return 'PAX';
  if (normalized.includes('pavo')) return 'Pavo';
  if (normalized.includes('hugin')) return 'Hugin';
  if (normalized.includes('sunmi')) return 'Sunmi';

  const exact = normalizeSelectValue(raw, POS_MARKASI_OPTIONS);
  if (exact) return exact;

  return 'Diğer';
}

function normalizeKasaposFirmasi(value: unknown) {
  const raw = trimOrNull(value);
  if (!raw) return null;

  const normalized = raw.toLocaleLowerCase('tr-TR');

  if (normalized.includes('toshiba')) return 'Toshiba';
  if (normalized.includes('ncr')) return 'NCR';
  if (normalized.includes('encore')) return 'Encore';
  if (normalized.includes('enpos')) return 'Enpos';
  if (normalized.includes('logo')) return 'Logo';
  if (normalized.includes('nebim')) return 'Nebim';

  const exact = normalizeSelectValue(raw, KASAPOS_OPTIONS);
  if (exact) return exact;

  return 'Diğer';
}

function normalizeGenelMemnuniyet(value: unknown) {
  const raw = trimOrNull(value);
  if (!raw) return null;

  const exact = normalizeSelectValue(raw, MEMNUNIYET_OPTIONS);
  if (exact) return exact;

  const n = Number(raw);
  if (Number.isFinite(n)) {
    if (n >= 4) return 'Memnun';
    if (n === 3) return 'Orta';
    return 'Memnun Değil';
  }

  const normalized = raw.toLocaleLowerCase('tr-TR');
  if (normalized.includes('memnun değil') || normalized.includes('memnun degil')) {
    return 'Memnun Değil';
  }
  if (normalized.includes('orta')) return 'Orta';
  if (normalized.includes('memnun')) return 'Memnun';

  return null;
}

function nullableText(value: unknown) {
  return trimOrNull(value);
}

function nullableInt(value: unknown) {
  const s = trimOrNull(value);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizeKunyePayload(input: Record<string, unknown>): KunyePayload {
  const reyon_kullaniliyor = trimOrNull(input.reyon_kullaniliyor) ?? 'Hayır';
  const el_terminali_kullaniliyor = trimOrNull(input.el_terminali_kullaniliyor) ?? 'Hayır';
  const pos_mulkiyet = trimOrNull(input.pos_mulkiyet);

  return {
    firma_adi: trimOrNull(input.firma_adi),
    magaza_sayisi: trimOrNull(input.magaza_sayisi),
    franchise_sayisi: trimOrNull(input.franchise_sayisi),

    sabit_kasa_adedi: trimOrNull(input.sabit_kasa_adedi),
    kasapos_firmasi: trimOrNull(input.kasapos_firmasi),
    pos_modeli: trimOrNull(input.pos_modeli),
    pos_markasi: trimOrNull(input.pos_markasi),
    toplam_pos_adedi: trimOrNull(input.toplam_pos_adedi),
    pos_alim_yili: trimOrNull(input.pos_alim_yili),
    sabit_bilgisayar_markasi: trimOrNull(input.sabit_bilgisayar_markasi),
    pos_notu: trimOrNull(input.pos_notu),

    reyon_kullaniliyor,
    reyon_odeme_yazilimi:
      reyon_kullaniliyor === 'Evet' ? trimOrNull(input.reyon_odeme_yazilimi) : null,
    reyon_cihaz_modeli:
      reyon_kullaniliyor === 'Evet' ? trimOrNull(input.reyon_cihaz_modeli) : null,
    reyon_cihaz_sayisi:
      reyon_kullaniliyor === 'Evet' ? trimOrNull(input.reyon_cihaz_sayisi) : null,
    reyon_alim_yili:
      reyon_kullaniliyor === 'Evet' ? trimOrNull(input.reyon_alim_yili) : null,

    el_terminali_kullaniliyor,
    el_terminali_modeli:
      el_terminali_kullaniliyor === 'Evet' ? trimOrNull(input.el_terminali_modeli) : null,
    el_terminali_yazilimi:
      el_terminali_kullaniliyor === 'Evet' ? trimOrNull(input.el_terminali_yazilimi) : null,
    el_terminali_adedi:
      el_terminali_kullaniliyor === 'Evet' ? trimOrNull(input.el_terminali_adedi) : null,
    el_terminali_alim_yili:
      el_terminali_kullaniliyor === 'Evet' ? trimOrNull(input.el_terminali_alim_yili) : null,

    erp: trimOrNull(input.erp),
    bankalar: normalizeDelimitedList(input.bankalar),
    pos_mulkiyet,
    pos_mulkiyet_bankalari:
      pos_mulkiyet === 'Banka' ? normalizeDelimitedList(input.pos_mulkiyet_bankalari) : null,
    saha_hizmeti_firmasi: trimOrNull(input.saha_hizmeti_firmasi),

    genel_memnuniyet: trimOrNull(input.genel_memnuniyet),
    risk: trimOrNull(input.risk),
    entegrasyon_yapisi: trimOrNull(input.entegrasyon_yapisi),
    account: trimOrNull(input.account),
    problem_1: trimOrNull(input.problem_1),
    problem_2: trimOrNull(input.problem_2),
    problem_3: trimOrNull(input.problem_3),
    degisim_nedeni: trimOrNull(input.degisim_nedeni),
  };
}

export function mapKunyeDbToUi(
  row: Record<string, any> | null | undefined,
): (KunyePayload & { has_kunye_record: boolean }) | null {
  if (!row) return null;

  const reyonCihazSayisi =
    row.reyon_cihaz_sayisi ?? row.reyon_cihazi_adedi ?? row.reyonda_kullanilan_cihaz_sayisi ?? null;
  const reyonCihazModeli = row.reyon_cihaz_modeli ?? row.reyon_cihazi_modeli ?? null;
  const reyonOdemeYazilimi = row.reyon_odeme_yazilimi ?? row.reyonda_odeme_yazilimi ?? null;
  const kasaposFirmasi = row.kasapos_firmasi ?? row.sabit_kasa_yazilimi ?? null;
  const posMarkasiSource = row.pos_markasi ?? row.pos_modeli ?? null;

  const derivedReyon =
    trimOrNull(row.reyon_kullaniliyor) ??
    (
      trimOrNull(reyonOdemeYazilimi) ||
      trimOrNull(reyonCihazModeli) ||
      reyonCihazSayisi != null ||
      trimOrNull(row.reyon_alim_yili)
        ? 'Evet'
        : 'Hayır'
    );

  const derivedElTerminali =
    trimOrNull(row.el_terminali_kullaniliyor) ??
    (
      trimOrNull(row.el_terminali_modeli) ||
      trimOrNull(row.el_terminali_yazilimi) ||
      row.el_terminali_adedi != null ||
      trimOrNull(row.el_terminali_alim_yili)
        ? 'Evet'
        : 'Hayır'
    );

  return {
    has_kunye_record: true,
    firma_adi: trimOrNull(row.firma_adi),
    magaza_sayisi: normalizeRangeValue(row.magaza_sayisi),
    franchise_sayisi: normalizeRangeValue(row.franchise_sayisi, true),

    sabit_kasa_adedi: normalizeRangeValue(row.sabit_kasa_adedi),
    kasapos_firmasi: normalizeKasaposFirmasi(kasaposFirmasi),
    pos_modeli: trimOrNull(row.pos_modeli),
    pos_markasi: normalizePosMarkasi(posMarkasiSource),
    toplam_pos_adedi: row.toplam_pos_adedi == null ? null : String(row.toplam_pos_adedi),
    pos_alim_yili: normalizeAlimYiliValue(row.pos_alim_yili),
    sabit_bilgisayar_markasi: normalizeSelectValue(
      row.sabit_bilgisayar_markasi,
      BILGISAYAR_MARKA_OPTIONS,
      'Diğer',
    ),
    pos_notu: trimOrNull(row.pos_notu),

    reyon_kullaniliyor: derivedReyon,
    reyon_odeme_yazilimi: trimOrNull(reyonOdemeYazilimi),
    reyon_cihaz_modeli: trimOrNull(reyonCihazModeli),
    reyon_cihaz_sayisi: reyonCihazSayisi == null ? null : String(reyonCihazSayisi),
    reyon_alim_yili: normalizeAlimYiliValue(row.reyon_alim_yili),

    el_terminali_kullaniliyor: derivedElTerminali,
    el_terminali_modeli: trimOrNull(row.el_terminali_modeli),
    el_terminali_yazilimi: trimOrNull(row.el_terminali_yazilimi),
    el_terminali_adedi: row.el_terminali_adedi == null ? null : String(row.el_terminali_adedi),
    el_terminali_alim_yili: normalizeAlimYiliValue(row.el_terminali_alim_yili),

    erp: trimOrNull(row.erp),
    bankalar: normalizeDelimitedList(row.bankalar),
    pos_mulkiyet: trimOrNull(row.pos_mulkiyet),
    pos_mulkiyet_bankalari: normalizeDelimitedList(row.pos_mulkiyet_bankalari),
    saha_hizmeti_firmasi: trimOrNull(row.saha_hizmeti_firmasi),

    genel_memnuniyet: normalizeGenelMemnuniyet(row.genel_memnuniyet),
    risk: trimOrNull(row.risk),
    entegrasyon_yapisi: trimOrNull(row.entegrasyon_yapisi),
    account: trimOrNull(row.account ?? row.musteri_account),
    problem_1: trimOrNull(row.problem_1),
    problem_2: trimOrNull(row.problem_2),
    problem_3: trimOrNull(row.problem_3),
    degisim_nedeni: trimOrNull(row.degisim_nedeni),
  };
}

export function mapKunyeUiToDb(payload: KunyePayload): Record<string, any> {
  return {
    magaza_sayisi: nullableText(payload.magaza_sayisi),
    franchise_sayisi: nullableText(payload.franchise_sayisi),

    sabit_kasa_adedi: nullableText(payload.sabit_kasa_adedi),
    kasapos_firmasi: nullableText(payload.kasapos_firmasi),
    pos_modeli: nullableText(payload.pos_modeli),
    pos_markasi: nullableText(payload.pos_markasi),
    toplam_pos_adedi: nullableInt(payload.toplam_pos_adedi),
    pos_alim_yili: nullableText(payload.pos_alim_yili),
    sabit_bilgisayar_markasi: nullableText(payload.sabit_bilgisayar_markasi),
    pos_notu: nullableText(payload.pos_notu),

    reyon_kullaniliyor: nullableText(payload.reyon_kullaniliyor) ?? 'Hayır',
    reyon_odeme_yazilimi:
      payload.reyon_kullaniliyor === 'Evet' ? nullableText(payload.reyon_odeme_yazilimi) : null,
    reyon_cihaz_modeli:
      payload.reyon_kullaniliyor === 'Evet' ? nullableText(payload.reyon_cihaz_modeli) : null,
    reyon_cihaz_sayisi:
      payload.reyon_kullaniliyor === 'Evet' ? nullableInt(payload.reyon_cihaz_sayisi) : null,
    reyon_alim_yili:
      payload.reyon_kullaniliyor === 'Evet' ? nullableText(payload.reyon_alim_yili) : null,

    el_terminali_kullaniliyor: nullableText(payload.el_terminali_kullaniliyor) ?? 'Hayır',
    el_terminali_modeli:
      payload.el_terminali_kullaniliyor === 'Evet'
        ? nullableText(payload.el_terminali_modeli)
        : null,
    el_terminali_yazilimi:
      payload.el_terminali_kullaniliyor === 'Evet'
        ? nullableText(payload.el_terminali_yazilimi)
        : null,
    el_terminali_adedi:
      payload.el_terminali_kullaniliyor === 'Evet'
        ? nullableInt(payload.el_terminali_adedi)
        : null,
    el_terminali_alim_yili:
      payload.el_terminali_kullaniliyor === 'Evet'
        ? nullableText(payload.el_terminali_alim_yili)
        : null,

    erp: nullableText(payload.erp),
    bankalar: normalizeDelimitedList(payload.bankalar),
    pos_mulkiyet: nullableText(payload.pos_mulkiyet),
    pos_mulkiyet_bankalari:
      payload.pos_mulkiyet === 'Banka'
        ? normalizeDelimitedList(payload.pos_mulkiyet_bankalari)
        : null,
    saha_hizmeti_firmasi: nullableText(payload.saha_hizmeti_firmasi),

    genel_memnuniyet: nullableText(payload.genel_memnuniyet),
    risk: nullableText(payload.risk),
    entegrasyon_yapisi: nullableText(payload.entegrasyon_yapisi),
    account: nullableText(payload.account),
    problem_1: nullableText(payload.problem_1),
    problem_2: nullableText(payload.problem_2),
    problem_3: nullableText(payload.problem_3),
    degisim_nedeni: nullableText(payload.degisim_nedeni),
  };
}

export function normalizeKunyeStatusFilter(value: unknown) {
  const normalized = String(value ?? '').trim().toLocaleLowerCase('tr');
  if (!normalized) return '';
  if (normalized === 'tamam' || normalized === 'var') return 'Var';
  if (normalized === 'eksik') return 'Eksik';
  if (normalized === 'yok') return 'Yok';
  return '';
}

export function presentKunyeStatus(value: unknown) {
  const normalized = normalizeKunyeStatusFilter(value);
  if (normalized === 'Var') return 'Tamam';
  return normalized || 'Yok';
}

export function getKunyeStatus(kunye: KunyeStatusInput | null | undefined) {
  const explicitHasRecord =
    typeof kunye?.has_kunye_record === 'boolean' ? kunye.has_kunye_record : undefined;

  const hasAnyKunyeField = [
    kunye?.magaza_sayisi,
    kunye?.franchise_sayisi,
    kunye?.sabit_kasa_adedi,
    kunye?.kasapos_firmasi,
    kunye?.pos_modeli,
    kunye?.pos_markasi,
    kunye?.toplam_pos_adedi,
    kunye?.pos_alim_yili,
    kunye?.sabit_bilgisayar_markasi,
    kunye?.reyon_kullaniliyor,
    kunye?.reyon_odeme_yazilimi,
    kunye?.reyon_cihaz_modeli,
    kunye?.reyon_cihaz_sayisi,
    kunye?.reyon_alim_yili,
    kunye?.el_terminali_kullaniliyor,
    kunye?.el_terminali_modeli,
    kunye?.el_terminali_yazilimi,
    kunye?.el_terminali_adedi,
    kunye?.el_terminali_alim_yili,
    kunye?.erp,
    kunye?.bankalar,
    kunye?.pos_mulkiyet,
    kunye?.pos_mulkiyet_bankalari,
    kunye?.saha_hizmeti_firmasi,
    kunye?.genel_memnuniyet,
    kunye?.problem_1,
    kunye?.problem_2,
    kunye?.problem_3,
    kunye?.degisim_nedeni,
  ].some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(trimOrNull(value));
  });

  const hasRecord = explicitHasRecord ?? hasAnyKunyeField;

  if (!hasRecord) {
    return {
      status: 'Yok',
      complete: false,
      missing: 4,
      missingFields: ['firma_adi', 'magaza_veya_franchise', 'pos_modeli', 'toplam_pos_adedi'],
    };
  }

  const hasFirmaAdi = Boolean(trimOrNull(kunye?.firma_adi));
  const hasStoreInfo =
    Boolean(trimOrNull(kunye?.magaza_sayisi)) || Boolean(trimOrNull(kunye?.franchise_sayisi));
  const hasPosModeli = Boolean(trimOrNull(kunye?.pos_modeli));
  const hasToplamPosAdedi = Boolean(trimOrNull(kunye?.toplam_pos_adedi));

  const missingFields = [
    !hasFirmaAdi ? 'firma_adi' : null,
    !hasStoreInfo ? 'magaza_veya_franchise' : null,
    !hasPosModeli ? 'pos_modeli' : null,
    !hasToplamPosAdedi ? 'toplam_pos_adedi' : null,
  ].filter(Boolean) as string[];

  return {
    status: missingFields.length === 0 ? 'Var' : 'Eksik',
    complete: missingFields.length === 0,
    missing: missingFields.length,
    missingFields,
  };
}