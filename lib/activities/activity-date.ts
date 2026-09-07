// Aktivite tarihi (Çağdaş Bey'in 07.09 toplantısı — ara yol):
//   * Ekip geçmiş tarihe aktivite girmek istedi; Çağdaş "her gün girin, üç günü
//     tek günde girmeyin" dedi. Uzlaşı: en fazla ACTIVITY_BACKDATE_DAYS gün geriye
//     tarih seçilebilir, ileri tarih seçilemez; geç girilen kayıt raporlarda
//     "geç girildi" olarak işaretlenir (aktivite_tarihi < kayıt günü).
//   * Sayaçlar (haftalık hedef, Canlı Ekran) artık AKTİVİTE TARİHİNE bakar; böylece
//     Pazartesi girilen Cuma aktivitesi geçen haftaya sayılır.
//   * KARAR BEKLİYOR (Sinan → Çağdaş, 07.09): onay gelene kadar ACTIVITY_BACKDATE_DAYS = 0
//     → formda tarih alanı görünmez, API geçmiş tarihi reddeder (eski davranış).
//     Onay gelince 2 yapılıp deploy edilir; başka değişiklik gerekmez.
// Saf yardımcılar; API + form + testler ortak kullanır.

export const ACTIVITY_BACKDATE_DAYS = 0;
/** Tarih alanı yalnız geriye giriş açıksa gösterilir. */
export const ACTIVITY_DATE_PICKER_ENABLED = ACTIVITY_BACKDATE_DAYS > 0;

const TZ = 'Europe/Istanbul';

/** İstanbul yerel gün anahtarı (YYYY-MM-DD). */
export function istanbulDateKey(value: Date | string = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function shiftDateKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function dateKeyDiff(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export type ActivityDateCheck =
  | { ok: true; value: string; late: boolean }
  | { ok: false; message: string };

/**
 * Aktivite tarihini doğrular. Boş → bugün. İleri tarih ve
 * ACTIVITY_BACKDATE_DAYS günden eski tarih reddedilir.
 */
export function validateActivityDate(
  input: unknown,
  today = istanbulDateKey(),
  options: {
    /** Düzenlemede eski kaydın tarihi korunabilir; geri sınır uygulanmaz. */
    allowOld?: boolean;
    /** Kaç gün geriye izin var (varsayılan ACTIVITY_BACKDATE_DAYS; 0 = yalnız bugün). */
    maxBackDays?: number;
  } = {},
): ActivityDateCheck {
  const maxBack = options.maxBackDays ?? ACTIVITY_BACKDATE_DAYS;
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, value: today, late: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime())) {
    return { ok: false, message: 'Aktivite tarihi geçersiz (YYYY-AA-GG bekleniyor).' };
  }
  const diff = dateKeyDiff(raw, today); // pozitif = geçmiş
  if (diff < 0) return { ok: false, message: 'Aktivite tarihi ileri bir gün olamaz.' };
  if (diff > maxBack && !options.allowOld) {
    return {
      ok: false,
      message: maxBack > 0
        ? `Aktivite en fazla ${maxBack} gün geriye girilebilir. Daha eski aktiviteler için yöneticinize başvurun.`
        : 'Aktivite geçmiş tarihe girilemez; aktiviteler gün içinde girilir.',
    };
  }
  return { ok: true, value: raw, late: diff > 0 };
}

/** Form için izin verilen aralık. */
export function activityDateBounds(today = istanbulDateKey(), maxBackDays = ACTIVITY_BACKDATE_DAYS) {
  return { min: shiftDateKey(today, -maxBackDays), max: today };
}
