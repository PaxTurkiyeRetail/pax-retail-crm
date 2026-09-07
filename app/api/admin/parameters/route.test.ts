import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/authz', () => ({ requireSystemParametersAccessOrThrow: async () => ({ id: 'admin' }), userHasPermission: () => false }));
vi.mock('@/lib/audit', () => ({ tryRecordAuditEvent: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }));
vi.mock('@/lib/system-parameters', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/system-parameters')>(),
  listSystemParameters: async () => [], listPhaseParameters: async () => [],
}));
import { GET } from './route';
describe('parameter editor metadata', () => {
  it('renders CRM, forecast and notification catalogs as lists', async () => {
    const { groups } = await (await GET()).json();
    for (const key of ['crm_customer_type', 'crm_sector', 'forecast_sales_channel', 'notify_request_cc', 'notify_allowed_domains']) {
      expect(groups.find((g: { key: string }) => g.key === key)?.editorKind).toBe('list');
    }
  });
  it('distinguishes phase catalogs from single-value system settings', async () => {
    const { groups } = await (await GET()).json();
    expect(groups.find((g: { key: string }) => g.key === 'is_ortagi_faz_tanimlari')?.editorKind).toBe('phase');
    expect(groups.find((g: { key: string }) => g.key === 'system_page_size')?.editorKind).toBe('setting');
  });
  it('retains identity-management visibility restrictions', async () => {
    const { groups } = await (await GET()).json();
    expect(groups.some((g: { key: string }) => g.key === 'system_oidc_app_role_mapping')).toBe(false);
  });
});
