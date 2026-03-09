export type KunyePayload = {
  firma_adi?: string | null;
  magaza_sayisi?: string | null;
  toplam_pos_adedi?: string | null;
  pos_modeli?: string | null;
  pos_adedi?: string | null;
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
  saha_hizmeti_firmasi?: string | null;
  genel_memnuniyet?: string | null;
  problem_1?: string | null;
  problem_2?: string | null;
  problem_3?: string | null;
  degisim_nedeni?: string | null;
};

export const REQUIRED_KUNYE_FIELDS: (keyof KunyePayload)[] = [
  'magaza_sayisi',
  'toplam_pos_adedi',
  'erp',
  'pos_modeli',
  'bankalar',
];

export function trimOrNull(value: unknown) {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

export function normalizeKunyePayload(input: Record<string, unknown>): KunyePayload {
  return {
    firma_adi: trimOrNull(input.firma_adi),
    magaza_sayisi: trimOrNull(input.magaza_sayisi),
    toplam_pos_adedi: trimOrNull(input.toplam_pos_adedi),
    pos_modeli: trimOrNull(input.pos_modeli),
    pos_adedi: trimOrNull(input.pos_adedi),
    pos_notu: trimOrNull(input.pos_notu),
    el_terminali_modeli: trimOrNull(input.el_terminali_modeli),
    el_terminali_adedi: trimOrNull(input.el_terminali_adedi),
    reyon_cihazi_modeli: trimOrNull(input.reyon_cihazi_modeli),
    reyon_cihazi_adedi: trimOrNull(input.reyon_cihazi_adedi),
    sabit_kasa_yazilimi: trimOrNull(input.sabit_kasa_yazilimi),
    reyonda_odeme_yazilimi: trimOrNull(input.reyonda_odeme_yazilimi),
    erp: trimOrNull(input.erp),
    bankalar: trimOrNull(input.bankalar),
    pos_mulkiyet: trimOrNull(input.pos_mulkiyet),
    saha_hizmeti_firmasi: trimOrNull(input.saha_hizmeti_firmasi),
    genel_memnuniyet: trimOrNull(input.genel_memnuniyet),
    problem_1: trimOrNull(input.problem_1),
    problem_2: trimOrNull(input.problem_2),
    problem_3: trimOrNull(input.problem_3),
    degisim_nedeni: trimOrNull(input.degisim_nedeni),
  };
}

export function getKunyeStatus(kunye: Partial<KunyePayload> | null | undefined) {
  if (!kunye) return { status: 'Yok', complete: false, missing: REQUIRED_KUNYE_FIELDS.length };
  const missing = REQUIRED_KUNYE_FIELDS.filter((key) => !String((kunye as any)[key] ?? '').trim());
  if (missing.length === REQUIRED_KUNYE_FIELDS.length) return { status: 'Yok', complete: false, missing: missing.length };
  if (missing.length > 0) return { status: 'Eksik', complete: false, missing: missing.length };
  return { status: 'Var', complete: true, missing: 0 };
}
