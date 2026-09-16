import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_CHANNEL_OPTIONS,
  isIntegrationProcessActivity,
  isPureBusinessPartnerRelationship,
  normalizeChannel,
} from './activity-channels';

describe('integration process activity channel', () => {
  it('uses the new label in activity options', () => {
    expect(ACTIVITY_CHANNEL_OPTIONS).toContain('Entegrasyon Süreci');
    expect(ACTIVITY_CHANNEL_OPTIONS).not.toContain('İş Ortaklığı Aktivitesi');
  });

  it('keeps legacy activity records compatible', () => {
    expect(normalizeChannel('İş Ortaklığı Aktivitesi')).toBe('Entegrasyon Süreci');
    expect(isIntegrationProcessActivity('İş Ortaklığı Aktivitesi')).toBe(true);
    expect(isIntegrationProcessActivity('Entegrasyon Süreci')).toBe(true);
  });
});

describe('isPureBusinessPartnerRelationship (16.09 — ADAMPOS faz listesi)', () => {
  it('salt İş Ortağı firma (customer rolü yok) için true döner', () => {
    expect(isPureBusinessPartnerRelationship({ hasCustomerRole: false, hasBusinessPartnerRole: true })).toBe(true);
  });

  it('çift rollü firma (hem customer hem business_partner) için false döner — bağlam yine Aktivite Tipi ile seçilir', () => {
    expect(isPureBusinessPartnerRelationship({ hasCustomerRole: true, hasBusinessPartnerRole: true })).toBe(false);
  });

  it('sadece müşteri rolü olan (İş Ortağı olmayan) firma için false döner', () => {
    expect(isPureBusinessPartnerRelationship({ hasCustomerRole: true, hasBusinessPartnerRole: false })).toBe(false);
  });

  it('hiç rolü olmayan (eski/legacy) firma için false döner — mevcut davranış korunur', () => {
    expect(isPureBusinessPartnerRelationship({ hasCustomerRole: false, hasBusinessPartnerRole: false })).toBe(false);
  });

  it('null/undefined güvenli — eksik veri false sayılır', () => {
    expect(isPureBusinessPartnerRelationship({})).toBe(false);
    expect(isPureBusinessPartnerRelationship({ hasCustomerRole: null, hasBusinessPartnerRole: null })).toBe(false);
  });
});
