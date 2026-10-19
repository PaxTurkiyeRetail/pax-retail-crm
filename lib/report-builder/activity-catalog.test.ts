import { describe, expect, it } from 'vitest';
import { ACTIVITY_CHANNEL_OPTIONS, normalizeChannel } from '@/lib/activity-channels';
import { DURUM_CANONICAL } from '@/lib/activities/presentation';
import { datasetCatalog, getDataset } from './datasets';
import { compileReport } from './compiler';
import { parseReportDefinition } from './types';
describe('activity filter catalog alignment', () => {
  const dataset = getDataset('activities')!;
  it('publishes canonical activity channels including online and technical online', () => {
    expect(dataset.dimensions.channel.options).toEqual(ACTIVITY_CHANNEL_OPTIONS);
    for (const value of ACTIVITY_CHANNEL_OPTIONS) {
      expect(normalizeChannel(value)).toBe(value);
      expect(dataset.dimensions.channel.sql).toContain(`'${value}'`);
    }
    expect(dataset.dimensions.channel.sql).toContain("'İş Ortaklığı Aktivitesi'");
    expect(normalizeChannel('İş Ortaklığı Aktivitesi')).toBe('Entegrasyon Süreci');
  });
  it('keeps Online Toplantı as a parameterized field/value filter', () => {
    const query = compileReport(parseReportDefinition({ dataset: 'activities', measures: ['activity_count'], filters: [{ field: 'channel', op: 'eq', value: 'Online Toplantı' }] }), { scope: { kind: 'own', userId: 'user', email: 'user@example.test', fullName: null }, today: '2026-10-19' });
    expect(query.params).toContain('Online Toplantı');
    expect(query.params).toContain('user');
    expect(query.sql).toContain('pe.owner_user_id');
    expect(query.sql).toContain('pe.hedef_tarihi is not null');
  });
  it('exposes status and stored context values to the generic filter UI', () => {
    const catalog = datasetCatalog(() => true).find(d => d.key === 'activities')!;
    expect(catalog.dimensions.find(d => d.key === 'status')?.options).toEqual(Object.values(DURUM_CANONICAL));
    expect(catalog.dimensions.find(d => d.key === 'activity_context')?.options).toEqual(['customer', 'business_partner']);
    const query = compileReport(parseReportDefinition({ dataset: 'activities', measures: ['activity_count'], filters: [{ field: 'activity_context', op: 'eq', value: 'business_partner' }] }), { scope: { kind: 'all' }, today: '2026-10-19' });
    expect(query.params).toContain('business_partner');
    expect(query.sql).toContain('pe.activity_context');
  });
});
