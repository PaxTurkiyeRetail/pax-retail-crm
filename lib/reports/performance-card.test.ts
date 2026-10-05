import { describe, expect, it } from 'vitest';
import { goalRatio, paceRatio, perfGrade, perfTotal, type PerfDimension } from './performance-card';

describe('goalRatio / paceRatio', () => {
  it('hedef yoksa null', () => {
    expect(goalRatio({ actual: 5, target: null, pct: null })).toBeNull();
    expect(goalRatio({ actual: 5, target: 0, pct: null })).toBeNull();
  });
  it('oran 0..1 arasında kırpılır', () => {
    expect(goalRatio({ actual: 150, target: 100, pct: null })).toBe(1);
    expect(goalRatio({ actual: 25, target: 100, pct: null })).toBe(0.25);
  });
  it('hıza göre: yılın %50si geçtiyse %50 gerçekleşme tam puan', () => {
    expect(paceRatio({ actual: 50, target: 100, pct: null }, 50)).toBe(1);
    expect(paceRatio({ actual: 25, target: 100, pct: null }, 50)).toBe(0.5);
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
  it('eşikler', () => {
    expect(perfGrade(90).label).toBe('Beklentinin Üstünde');
    expect(perfGrade(78).label).toBe('Beklentiyi Karşılıyor');
    expect(perfGrade(60).label).toBe('Gelişim Gerekli');
    expect(perfGrade(40).label).toBe('Risk');
    expect(perfGrade(null).label).toBe('Veri yetersiz');
  });
});
