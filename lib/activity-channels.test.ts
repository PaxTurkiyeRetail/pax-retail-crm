import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_CHANNEL_OPTIONS,
  isIntegrationProcessActivity,
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
