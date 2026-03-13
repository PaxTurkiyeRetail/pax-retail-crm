export type KunyePayload = {
  franchise_sayisi?: string | null;
  magaza_sayisi?: string | null;
  toplam_pos_adedi?: string | null;
  sabit_kasa_adedi?: string | null;
  reyonda_kullanilan_cihaz_sayisi?: string | null;
  kasapos_firmasi?: string | null;
  kasa_pos_firmasi?: string | null;
  pos_modeli?: string | null;
  pos_notu?: string | null;
  el_terminali_modeli?: string | null;
  el_terminali_adedi?: string | null;
  reyon_cihazi_modeli?: string | null;
  reyon_cihazi_adedi?: string | null;
  sabit_kasa_yazilimi?: string | null;
  reyonda_odeme_yazilimi?: string | null;
  erp?: string | null;
  bankalar?: string | null;
  pos_mulkiyet?: string | null;
  pos_mulkiyet_bankalari?: string | null;
  saha_hizmeti_firmasi?: string | null;
  genel_memnuniyet?: string | null;
  problem_1?: string | null;
  problem_2?: string | null;
  problem_3?: string | null;
  degisim_nedeni?: string | null;
  firma_adi?: string | null;
  musteri?: string | null;
};

export const REQUIRED_KUNYE_RULE_FIELDS = ['firma_adi', 'magaza_veya_franchise', 'pos_modeli', 'toplam_pos_adedi'] as const;

type RequiredRuleField = typeof REQUIRED_KUNYE_RULE_FIELDS[number];

const REQUIRED_FIELD_LABELS: Record<RequiredRuleField, string> = {
  firma_adi: 'Firma Adı',
  magaza_veya_franchise: 'Mağaza veya Franchise Sayısı',
  pos_modeli: 'POS Modeli',
  toplam_pos_adedi: 'Toplam POS Adedi',
};

export function trimOrNull(value: unknown) {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

export function normalizeDelimitedList(value: unknown) {
  if (Array.isArray(value)) {
    const cleaned = value.map((item) => String(item ?? '').trim()).filter(Boolean);
    return cleaned.length ? cleaned.join(', ') : null;
  }
  return trimOrNull(value);
}

export function normalizeKunyePayload(input: Record<string, unknown>): KunyePayload {
  const pos_mulkiyet = trimOrNull(input.pos_mulkiyet);
  return {
    franchise_sayisi: trimOrNull(input.franchise_sayisi),
    magaza_sayisi: trimOrNull(input.magaza_sayisi),
    toplam_pos_adedi: trimOrNull(input.toplam_pos_adedi),
    sabit_kasa_adedi: trimOrNull(input.sabit_kasa_adedi),
    reyonda_kullanilan_cihaz_sayisi: trimOrNull(input.reyonda_kullanilan_cihaz_sayisi),
    kasapos_firmasi: trimOrNull(input.kasapos_firmasi ?? input.kasa_pos_firmasi),
    pos_modeli: trimOrNull(input.pos_modeli),
    pos_notu: trimOrNull(input.pos_notu),
    el_terminali_modeli: trimOrNull(input.el_terminali_modeli),
    el_terminali_adedi: trimOrNull(input.el_terminali_adedi),
    reyon_cihazi_modeli: trimOrNull(input.reyon_cihazi_modeli),
    reyon_cihazi_adedi: trimOrNull(input.reyon_cihazi_adedi),
    sabit_kasa_yazilimi: trimOrNull(input.sabit_kasa_yazilimi),
    reyonda_odeme_yazilimi: trimOrNull(input.reyonda_odeme_yazilimi),
    erp: trimOrNull(input.erp),
    bankalar: normalizeDelimitedList(input.bankalar),
    pos_mulkiyet,
    pos_mulkiyet_bankalari: ['Banka', 'Bankada'].includes(String(pos_mulkiyet ?? '')) ? normalizeDelimitedList(input.pos_mulkiyet_bankalari) : null,
    saha_hizmeti_firmasi: trimOrNull(input.saha_hizmeti_firmasi),
    genel_memnuniyet: trimOrNull(input.genel_memnuniyet),
    problem_1: trimOrNull(input.problem_1),
    problem_2: trimOrNull(input.problem_2),
    problem_3: trimOrNull(input.problem_3),
    degisim_nedeni: trimOrNull(input.degisim_nedeni),
  };
}

export function mapKunyeRow(row: any) {
  if (!row) return null;
  return {
    ...row,
    kasapos_firmasi: row.kasapos_firmasi ?? row.kasa_pos_firmasi ?? null,
  };
}

function hasValue(value: unknown) {
  if (value == null) return false;
  return String(value).trim().length > 0;
}

export function getKunyeStatus(kunye: Partial<KunyePayload> | null | undefined) {
  if (!kunye) {
    return {
      status: 'Yok' as const,
      complete: false,
      missing: REQUIRED_KUNYE_RULE_FIELDS.length,
      missingFields: REQUIRED_KUNYE_RULE_FIELDS.map((key) => REQUIRED_FIELD_LABELS[key]),
      present: 0,
      hasRecord: false,
    };
  }

  const firmaAdi = trimOrNull((kunye as any).firma_adi ?? (kunye as any).musteri);
  const magazaSayisi = trimOrNull((kunye as any).magaza_sayisi);
  const franchiseSayisi = trimOrNull((kunye as any).franchise_sayisi);
  const posModeli = trimOrNull((kunye as any).pos_modeli);
  const toplamPosAdedi = trimOrNull((kunye as any).toplam_pos_adedi);

  const checks: Record<RequiredRuleField, boolean> = {
    firma_adi: hasValue(firmaAdi),
    magaza_veya_franchise: hasValue(magazaSayisi) || hasValue(franchiseSayisi),
    pos_modeli: hasValue(posModeli),
    toplam_pos_adedi: hasValue(toplamPosAdedi),
  };

  const missingFields = REQUIRED_KUNYE_RULE_FIELDS.filter((key) => !checks[key]).map((key) => REQUIRED_FIELD_LABELS[key]);
  const present = REQUIRED_KUNYE_RULE_FIELDS.length - missingFields.length;

  if (present === 0) {
    return {
      status: 'Yok' as const,
      complete: false,
      missing: missingFields.length,
      missingFields,
      present,
      hasRecord: true,
    };
  }

  if (missingFields.length === 0) {
    return {
      status: 'Var' as const,
      complete: true,
      missing: 0,
      missingFields: [],
      present,
      hasRecord: true,
    };
  }

  return {
    status: 'Eksik' as const,
    complete: false,
    missing: missingFields.length,
    missingFields,
    present,
    hasRecord: true,
  };
}
