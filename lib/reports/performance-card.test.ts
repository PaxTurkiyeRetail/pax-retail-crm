import { describe, expect, it } from 'vitest';
import {
  attainmentPct, attainmentTone, paceRatio, perfGrade, perfRange, perfTotal, trendMonths, type PerfDimension,
} from './performance-card';

describe('attainmentPct / attainmentTone', () => {
  it('hedef yoksa N/A (null), 0 değil', () => {
    expect(attainmentPct({ actual: 5, target: null })).toBeNull();
    expect(attainmentPct({ actual: 5, target: 0 })).toBeNull();
    expect(attainmentTone(null)).toBe('neutral');
  });
  it('renk eşikleri: ≥100 yeşil, 80-99 turuncu, <80 kırmızı', () => {
    expect(attainmentTone(100)).toBe('ok');
    expect(attainmentTone(80)).toBe('warn');
    expect(attainmentTone(99)).toBe('warn');
    expect(attainmentTone(79)).toBe('danger');
  });
});

describe('paceRatio', () => {
  it('dönemin %50si geçtiyse %50 gerçekleşme tam puan', () => {
    expect(paceRatio({ actual: 50, target: 100 }, 50)).toBe(1);
    expect(paceRatio({ actual: 25, target: 100 }, 50)).toBe(0.5);
  });
});

describe('perfTotal', () => {
  const dim = (weight: number, score: number | null): PerfDimension => ({ key: 'commercial', label: '', weight, score, hint: '' });
  it('ölçülemeyen boyut toplamı düşürmez, 100e ölçeklenir', () => {
    expect(perfTotal([dim(40, 30), dim(20, null), dim(40, 40)])).toBe(88);
  });
  it('hiç ölçüt yoksa null', () => {
    expect(perfTotal([dim(40, null)])).toBeNull();
  });
});

describe('perfGrade', () => {
  it('bantlar 90/80/70/60', () => {
    expect(perfGrade(90).label).toBe('Üstün Performans');
    expect(perfGrade(85).label).toBe('Güçlü Performans');
    expect(perfGrade(70).label).toBe('Beklentiyi Karşılıyor');
    expect(perfGrade(60).label).toBe('Gelişim Gerekiyor');
    expect(perfGrade(59).label).toBe('Kritik Gelişim Alanı');
    expect(perfGrade(null).tone).toBe('neutral');
  });
});

describe('perfRange / trendMonths', () => {
  it('dönem anahtarları', () => {
    expect(perfRange('month', '2026-10-05').periodKey).toBe('m-2026-10');
    expect(perfRange('quarter', '2026-10-05').periodKey).toBe('q4-2026');
    const ytd = perfRange('ytd', '2026-10-05');
    expect(ytd.periodKey).toBe('ytd-2026');
    expect(ytd.from).toBe('2026-01-01');
  });
  it('son 6 ay, eskiden yeniye', () => {
    const m = trendMonths('2026-03-15');
    expect(m).toHaveLength(6);
    expect(m[5].startsWith('2026-03')).toBe(true);
    expect(m[0].startsWith('2025-10')).toBe(true);
  });
});
