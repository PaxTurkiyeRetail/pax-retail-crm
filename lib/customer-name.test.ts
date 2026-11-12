import { describe, expect, it } from 'vitest';
import { customerNameKey } from './customer-name';

describe('customerNameKey', () => {
  it('matches Turkish case and punctuation/space variants', () => {
    expect(customerNameKey('İMZA BARKOD (MİZAN YAZILIM)')).toBe(customerNameKey('imza barkod(mizan yazılım)'));
  });
  it('distinguishes different company names', () => {
    expect(customerNameKey('İMZA')).not.toBe(customerNameKey('İMZA BARKOD'));
  });
  it('uses the same Turkish transliteration as account assignment', () => {
    expect(customerNameKey('Çağdaş Öğün İŞİ')).toBe(customerNameKey('CAGDAS OGUN ISI'));
  });
});
