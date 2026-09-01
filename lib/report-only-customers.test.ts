import { describe, expect, it } from 'vitest';
import {
  BUSINESS_PARTNER_SECTOR,
  isBusinessPartnerSector,
  resolveCustomerTypeForSector,
} from './report-only-customers';

describe('business partner sector normalization', () => {
  it('recognises the partner sector regardless of case or Turkish characters', () => {
    expect(isBusinessPartnerSector(BUSINESS_PARTNER_SECTOR)).toBe(true);
    expect(isBusinessPartnerSector('İŞ ORTAĞI')).toBe(true);
    expect(isBusinessPartnerSector('iş ortağı')).toBe(true);
    expect(isBusinessPartnerSector('IS ORTAGI')).toBe(true);
    expect(isBusinessPartnerSector('  İş   Ortağı  ')).toBe(true);
  });

  it('does not match other sectors', () => {
    expect(isBusinessPartnerSector('Perakende')).toBe(false);
    expect(isBusinessPartnerSector('EV Charge')).toBe(false);
    expect(isBusinessPartnerSector('')).toBe(false);
    expect(isBusinessPartnerSector(null)).toBe(false);
  });
});

describe('resolveCustomerTypeForSector', () => {
  it('upgrades the untouched default to business_partner for the partner sector', () => {
    expect(resolveCustomerTypeForSector({ sektor: 'İŞ ORTAĞI', customerType: 'standard' })).toBe('business_partner');
    expect(resolveCustomerTypeForSector({ sektor: 'İŞ ORTAĞI', customerType: '' })).toBe('business_partner');
    expect(resolveCustomerTypeForSector({ sektor: 'İŞ ORTAĞI', customerType: null })).toBe('business_partner');
  });

  it('never overrides a deliberate classification', () => {
    // report_only bilincli bir secimdir: banka/vertical rapor satirlari bozulmamali.
    expect(resolveCustomerTypeForSector({ sektor: 'İŞ ORTAĞI', customerType: 'report_only' })).toBe('report_only');
    expect(resolveCustomerTypeForSector({ sektor: 'İŞ ORTAĞI', customerType: 'business_partner' })).toBe('business_partner');
  });

  it('leaves non-partner sectors untouched', () => {
    expect(resolveCustomerTypeForSector({ sektor: 'Perakende', customerType: 'standard' })).toBe('standard');
    expect(resolveCustomerTypeForSector({ sektor: 'Otopark', customerType: 'standard' })).toBe('standard');
    expect(resolveCustomerTypeForSector({ sektor: null, customerType: 'standard' })).toBe('standard');
  });
});
