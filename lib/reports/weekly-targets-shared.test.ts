import { describe, expect, it } from 'vitest';
import {
  achievementPct,
  activityTargetKind,
  addWeeklyCounters,
  emptyWeeklyCounters,
  endOfWeek,
  startOfWeek,
  toDateInput,
} from './weekly-targets-shared';

describe('activityTargetKind', () => {
  it('maps sales channels to their target buckets', () => {
    expect(activityTargetKind('Yerinde Ziyaret')).toBe('salesPhysical');
    expect(activityTargetKind('Online Toplantı')).toBe('salesOnline');
    expect(activityTargetKind('Telefon')).toBe('salesPhone');
    expect(activityTargetKind('E-posta')).toBe('salesEmail');
  });

  it('maps technical channels separately', () => {
    expect(activityTargetKind('Teknik Ziyaret')).toBe('technicalPhysical');
    expect(activityTargetKind('Teknik Online')).toBe('technicalOnline');
    expect(activityTargetKind('POM')).toBe('technicalOnline');
  });

  it('keeps technical visits out of the sales buckets', () => {
    // "Teknik Ziyaret" hem 'teknik' hem 'ziyaret' içerir; satışa sayılmamalı.
    expect(activityTargetKind('Teknik Ziyaret')).not.toBe('salesPhysical');
  });

  it('is tolerant of case and Turkish characters', () => {
    expect(activityTargetKind('TELEFON')).toBe('salesPhone');
    expect(activityTargetKind('online toplanti')).toBe('salesOnline');
    expect(activityTargetKind('  Yerinde  Ziyaret ')).toBe('salesPhysical');
  });

  it('returns other for unrelated or empty values', () => {
    expect(activityTargetKind('Faz Durumu Güncellendi')).toBe('other');
    expect(activityTargetKind('-')).toBe('other');
    expect(activityTargetKind('')).toBe('other');
    expect(activityTargetKind(null)).toBe('other');
  });
});

describe('week boundaries', () => {
  it('starts the week on Monday', () => {
    // 2 Eylül 2026 Çarşamba → hafta başı 31 Ağustos Pazartesi
    const monday = startOfWeek(new Date(2026, 8, 2));
    expect(toDateInput(monday)).toBe('2026-08-31');
    expect(monday.getDay()).toBe(1);
  });

  it('treats Sunday as the last day of the same week', () => {
    // 6 Eylül 2026 Pazar → hafta başı yine 31 Ağustos
    expect(toDateInput(startOfWeek(new Date(2026, 8, 6)))).toBe('2026-08-31');
  });

  it('ends the week on Sunday night', () => {
    const sunday = endOfWeek(new Date(2026, 8, 2));
    expect(toDateInput(sunday)).toBe('2026-09-06');
    expect(sunday.getDay()).toBe(0);
    expect(sunday.getHours()).toBe(23);
  });
});

describe('counters', () => {
  it('adds two counter sets field by field', () => {
    const a = { ...emptyWeeklyCounters(), salesPhone: 3, totalActivities: 3 };
    const b = { ...emptyWeeklyCounters(), salesPhone: 2, salesEmail: 1, totalActivities: 3 };
    const sum = addWeeklyCounters(a, b);
    expect(sum.salesPhone).toBe(5);
    expect(sum.salesEmail).toBe(1);
    expect(sum.totalActivities).toBe(6);
  });
});

describe('achievementPct', () => {
  it('returns the rounded percentage against the target', () => {
    expect(achievementPct(7, 8)).toBe(88);
    expect(achievementPct(54, 20)).toBe(270);
  });

  it('returns null when no target is set (kartta oran gösterilmez)', () => {
    expect(achievementPct(5, 0)).toBeNull();
  });
});
