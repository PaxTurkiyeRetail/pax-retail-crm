export type KunyePayload = {
  franchise_sayisi?: string | null;
  magaza_sayisi?: string | null;
  toplam_pos_adedi?: string | null;
  sabit_kasa_adedi?: string | null;
  reyonda_kullanilan_cihaz_sayisi?: string | null;
  kasapos_firmasi?: string | null;
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

export const REQUIRED_KUNYE_FIELDS: (keyof KunyePayload)[] = ['kasapos_firmasi','pos_modeli','pos_mulkiyet'];

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
franchise_sayisi: trimOrNull(input.franchise_sayisi), magaza_sayisi: trimOrNull(input.magaza_sayisi), toplam_pos_adedi: trimOrNull(input.toplam_pos_adedi), sabit_kasa_adedi: trimOrNull(input.sabit_kasa_adedi), reyonda_kullanilan_cihaz_sayisi: trimOrNull(input.reyonda_kullanilan_cihaz_sayisi), kasapos_firmasi: trimOrNull(input.kasapos_firmasi), pos_modeli: trimOrNull(input.pos_modeli), pos_notu: trimOrNull(input.pos_notu), el_terminali_modeli: trimOrNull(input.el_terminali_modeli), el_terminali_adedi: trimOrNull(input.el_terminali_adedi), reyon_cihazi_modeli: trimOrNull(input.reyon_cihazi_modeli), reyon_cihazi_adedi: trimOrNull(input.reyon_cihazi_adedi), sabit_kasa_yazilimi: trimOrNull(input.sabit_kasa_yazilimi), reyonda_odeme_yazilimi: trimOrNull(input.reyonda_odeme_yazilimi), erp: trimOrNull(input.erp), bankalar: normalizeDelimitedList(input.bankalar), pos_mulkiyet, pos_mulkiyet_bankalari: ['Banka','Bankada'].includes(String(pos_mulkiyet ?? '')) ? normalizeDelimitedList(input.pos_mulkiyet_bankalari) : null, saha_hizmeti_firmasi: trimOrNull(input.saha_hizmeti_firmasi), genel_memnuniyet: trimOrNull(input.genel_memnuniyet), problem_1: trimOrNull(input.problem_1), problem_2: trimOrNull(input.problem_2), problem_3: trimOrNull(input.problem_3), degisim_nedeni: trimOrNull(input.degisim_nedeni),
  };
}

export function getKunyeStatus(
  kunye: (Partial<KunyePayload> & { firma_adi?: string | null }) | null | undefined
) {
  if (!kunye) return { status: 'Yok', complete: false, missing: 4 };

  const firmaAdi = String((kunye as any).firma_adi ?? '').trim();
  const magazaSayisi = String((kunye as any).magaza_sayisi ?? '').trim();
  const franchiseSayisi = String((kunye as any).franchise_sayisi ?? '').trim();
  const posModeli = String((kunye as any).pos_modeli ?? '').trim();
  const toplamPosAdedi = String((kunye as any).toplam_pos_adedi ?? '').trim();

  const hasFirmaAdi = !!firmaAdi;
  const hasStoreInfo = !!magazaSayisi || !!franchiseSayisi;
  const hasPosModeli = !!posModeli;
  const hasToplamPosAdedi = !!toplamPosAdedi;

  const filledCount =
    Number(hasFirmaAdi) +
    Number(hasStoreInfo) +
    Number(hasPosModeli) +
    Number(hasToplamPosAdedi);

  if (filledCount === 0) {
    return { status: 'Yok', complete: false, missing: 4 };
  }

  if (hasFirmaAdi && hasStoreInfo && hasPosModeli && hasToplamPosAdedi) {
    return { status: 'Var', complete: true, missing: 0 };
  }

  return { status: 'Eksik', complete: false, missing: 4 - filledCount };
}
