export type KunyePayload = {
  franchise_sayisi?: string | null;
  magaza_sayisi?: string | null;
  toplam_pos_adedi?: string | null;
  sabit_kasa_adedi?: string | null;
  reyonda_kullanilan_cihaz_sayisi?: string | null;
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
};

export type KunyeStatusInput = Partial<KunyePayload> & {
  firma_adi?: string | null;
  has_kunye_record?: boolean;
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
    pos_mulkiyet_bankalari: ['Banka', 'Bankada'].includes(String(pos_mulkiyet ?? ''))
      ? normalizeDelimitedList(input.pos_mulkiyet_bankalari)
      : null,
    saha_hizmeti_firmasi: trimOrNull(input.saha_hizmeti_firmasi),
    genel_memnuniyet: trimOrNull(input.genel_memnuniyet),
    problem_1: trimOrNull(input.problem_1),
    problem_2: trimOrNull(input.problem_2),
    problem_3: trimOrNull(input.problem_3),
    degisim_nedeni: trimOrNull(input.degisim_nedeni),
  };
}

export function mapKunyeDbToUi(row: Record<string, any> | null | undefined): (KunyePayload & { has_kunye_record: boolean }) | null {
  if (!row) return null;
  return {
    has_kunye_record: true,
    franchise_sayisi: row.franchise_sayisi == null ? null : String(row.franchise_sayisi),
    magaza_sayisi: row.magaza_sayisi == null ? null : String(row.magaza_sayisi),
    toplam_pos_adedi: row.toplam_pos_adedi == null ? null : String(row.toplam_pos_adedi),
    sabit_kasa_adedi: row.sabit_kasa_adedi == null ? null : String(row.sabit_kasa_adedi),
    reyonda_kullanilan_cihaz_sayisi: row.reyonda_kullanilan_cihaz_sayisi == null ? null : String(row.reyonda_kullanilan_cihaz_sayisi),
    pos_modeli: trimOrNull(row.pos_modeli),
    pos_notu: trimOrNull(row.pos_notu),
    el_terminali_modeli: trimOrNull(row.el_terminali_modeli),
    el_terminali_adedi: row.el_terminali_adedi == null ? null : String(row.el_terminali_adedi),
    reyon_cihazi_modeli: trimOrNull(row.reyon_cihazi_modeli),
    reyon_cihazi_adedi: row.reyon_cihazi_adedi == null ? null : String(row.reyon_cihazi_adedi),
    sabit_kasa_yazilimi: trimOrNull(row.sabit_kasa_yazilimi),
    reyonda_odeme_yazilimi: trimOrNull(row.reyonda_odeme_yazilimi),
    erp: trimOrNull(row.erp),
    bankalar: normalizeDelimitedList(row.bankalar),
    pos_mulkiyet: trimOrNull(row.pos_mulkiyet),
    pos_mulkiyet_bankalari: normalizeDelimitedList(row.pos_mulkiyet_bankalari),
    saha_hizmeti_firmasi: trimOrNull(row.saha_hizmeti_firmasi),
    genel_memnuniyet: trimOrNull(row.genel_memnuniyet),
    problem_1: trimOrNull(row.problem_1),
    problem_2: trimOrNull(row.problem_2),
    problem_3: trimOrNull(row.problem_3),
    degisim_nedeni: trimOrNull(row.degisim_nedeni),
  };
}

export function mapKunyeUiToDb(payload: KunyePayload): Record<string, any> {
  return {
    franchise_sayisi: payload.franchise_sayisi == null ? null : Number(payload.franchise_sayisi),
    magaza_sayisi: payload.magaza_sayisi == null ? null : Number(payload.magaza_sayisi),
    toplam_pos_adedi: payload.toplam_pos_adedi == null ? null : Number(payload.toplam_pos_adedi),
    sabit_kasa_adedi: payload.sabit_kasa_adedi == null ? null : Number(payload.sabit_kasa_adedi),
    reyonda_kullanilan_cihaz_sayisi: payload.reyonda_kullanilan_cihaz_sayisi == null ? null : Number(payload.reyonda_kullanilan_cihaz_sayisi),
    pos_modeli: payload.pos_modeli,
    pos_notu: payload.pos_notu,
    el_terminali_modeli: payload.el_terminali_modeli,
    el_terminali_adedi: payload.el_terminali_adedi == null ? null : Number(payload.el_terminali_adedi),
    reyon_cihazi_modeli: payload.reyon_cihazi_modeli,
    reyon_cihazi_adedi: payload.reyon_cihazi_adedi == null ? null : Number(payload.reyon_cihazi_adedi),
    sabit_kasa_yazilimi: payload.sabit_kasa_yazilimi,
    reyonda_odeme_yazilimi: payload.reyonda_odeme_yazilimi,
    erp: payload.erp,
    bankalar: payload.bankalar ? payload.bankalar.split(',').map((s) => s.trim()).filter(Boolean) : null,
    pos_mulkiyet: payload.pos_mulkiyet,
    pos_mulkiyet_bankalari: payload.pos_mulkiyet_bankalari ? payload.pos_mulkiyet_bankalari.split(',').map((s) => s.trim()).filter(Boolean) : null,
    saha_hizmeti_firmasi: payload.saha_hizmeti_firmasi,
    genel_memnuniyet: payload.genel_memnuniyet,
    problem_1: payload.problem_1,
    problem_2: payload.problem_2,
    problem_3: payload.problem_3,
    degisim_nedeni: payload.degisim_nedeni,
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
  const explicitHasRecord = typeof kunye?.has_kunye_record === 'boolean' ? kunye.has_kunye_record : undefined;
  const hasAnyKunyeField = [
    kunye?.franchise_sayisi,
    kunye?.magaza_sayisi,
    kunye?.toplam_pos_adedi,
    kunye?.sabit_kasa_adedi,
    kunye?.reyonda_kullanilan_cihaz_sayisi,
    kunye?.pos_modeli,
    kunye?.pos_notu,
    kunye?.el_terminali_modeli,
    kunye?.el_terminali_adedi,
    kunye?.reyon_cihazi_modeli,
    kunye?.reyon_cihazi_adedi,
    kunye?.sabit_kasa_yazilimi,
    kunye?.reyonda_odeme_yazilimi,
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
  ].some((value) => Boolean(trimOrNull(value)));

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
  const hasStoreInfo = Boolean(trimOrNull(kunye?.magaza_sayisi)) || Boolean(trimOrNull(kunye?.franchise_sayisi));
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
