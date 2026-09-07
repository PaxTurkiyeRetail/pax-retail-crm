import { describe, expect, it } from 'vitest';
import { ACTIVITY_BACKDATE_DAYS, ACTIVITY_DATE_PICKER_ENABLED, activityDateBounds, dateKeyDiff, shiftDateKey, validateActivityDate } from './activity-date';

describe('aktivite tarihi (07.09 ara yolu)', () => {
  const today = '2026-09-07';
  it('boş tarih bugün sayılır, geç değildir', () => {
    expect(validateActivityDate('', today)).toEqual({ ok: true, value: today, late: false });
    expect(validateActivityDate(undefined, today)).toEqual({ ok: true, value: today, late: false });
  });
  it('ara yol açıkken (2 gün) geriye izin verir ve geç girişi işaretler', () => {
    const opt = { maxBackDays: 2 };
    expect(validateActivityDate('2026-09-06', today, opt)).toEqual({ ok: true, value: '2026-09-06', late: true });
    expect(validateActivityDate('2026-09-05', today, opt)).toEqual({ ok: true, value: '2026-09-05', late: true });
    const tooOld = validateActivityDate('2026-09-04', today, opt);
    expect(tooOld.ok).toBe(false);
    if (!tooOld.ok) expect(tooOld.message).toContain('2 gün');
  });
  it('karar gelene kadar kapalı: varsayılan 0 gün, geçmiş tarih reddedilir, form alanı gizli', () => {
    expect(ACTIVITY_BACKDATE_DAYS).toBe(0);
    expect(ACTIVITY_DATE_PICKER_ENABLED).toBe(false);
    const past = validateActivityDate('2026-09-06', today);
    expect(past.ok).toBe(false);
    if (!past.ok) expect(past.message).toContain('geçmiş tarihe girilemez');
    expect(validateActivityDate(today, today)).toEqual({ ok: true, value: today, late: false });
  });
  it('ileri tarihi ve bozuk girdiyi reddeder', () => {
    expect(validateActivityDate('2026-09-08', today).ok).toBe(false);
    expect(validateActivityDate('07.09.2026', today).ok).toBe(false);
    expect(validateActivityDate('2026-13-40', today).ok).toBe(false);
  });
  it('düzenlemede eski tarih korunur (allowOld), ileri tarih yine yasak', () => {
    expect(validateActivityDate('2026-08-01', today, { allowOld: true })).toEqual({ ok: true, value: '2026-08-01', late: true });
    expect(validateActivityDate('2026-09-09', today, { allowOld: true }).ok).toBe(false);
  });
  it('form sınırları ve gün aritmetiği', () => {
    expect(activityDateBounds(today, 2)).toEqual({ min: '2026-09-05', max: today });
    expect(activityDateBounds(today)).toEqual({ min: today, max: today });
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(dateKeyDiff('2026-09-05', '2026-09-07')).toBe(2);
  });
});
