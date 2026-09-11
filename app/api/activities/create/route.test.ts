import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isResourceOwner } from '@/lib/resource-ownership';

const state = vi.hoisted(() => ({
  user: { id: 'u1', email: 'owner@example.com', full_name: 'Owner', role: 'account_manager', permissions: [] as string[] },
  existing: null as Record<string, unknown> | null,
  contact: null as Record<string, unknown> | null,
  phaseOptional: false,
  customerType: 'standard',
  integrationEnabled: false,
  relationships: [{ role_key: 'customer', is_active: true }] as Record<string, unknown>[],
  writes: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/authz', () => ({
  requireActivityCreateOrThrow: async () => state.user,
  userHasPermission: (u: typeof state.user, p: string) => u.permissions.includes(p),
  assertOwnedResourceAccess: ({ user, resource, ownPermission, anyPermission }: any) => {
    if (user.permissions.includes(anyPermission) || (user.permissions.includes(ownPermission) && isResourceOwner(user, resource))) return;
    throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  },
}));
vi.mock('@/lib/system-parameters', () => ({ assertActiveParameterValue: vi.fn() }));
vi.mock('@/lib/activity-phase-completion', () => ({ completeActivitiesForSamePhase: vi.fn(), completePreviousOpenActivities: vi.fn() }));
vi.mock('@/lib/pg/admin', () => ({ createPgAdminClient: () => ({
  from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const query: any = {
      select: () => query,
      not: () => query, order: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      maybeSingle: async () => ({ data: table === 'musteriler'
        ? { id: 'firm-a', owner_user_id: 'u1', customer_type: state.customerType, integration_enabled: state.integrationEnabled, pipeline_policy: state.phaseOptional ? 'phase_optional' : 'phase_required' }
        : table === 'customer_technical_contacts'
          ? state.contact && Object.entries(filters).every(([k, v]) => state.contact?.[k] === v) ? state.contact : null
          : state.existing && Object.entries(filters).every(([k, v]) => state.existing?.[k] === v) ? state.existing : null }),
      update: (payload: unknown) => { state.writes(payload); return query; },
      insert: (payload: unknown) => { state.writes(payload); return query; },
      upsert: (payload: unknown) => { state.writes(payload); return query; },
      single: async () => ({ data: { id: 'new-activity' }, error: null }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: table === 'organization_roles' ? state.relationships : null, error: null }).then(resolve),
    };
    return query;
  },
}) }));
import { POST } from './route';

function request(extra: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/activities/create', { method: 'POST', body: JSON.stringify({ activity_id: 'activity-1', musteri_id: 'firm-a', kanal: 'Telefon', ...extra }) });
}
describe('activity edits through the create endpoint', () => {
  beforeEach(() => { state.writes.mockClear(); state.phaseOptional = false; state.customerType = 'standard'; state.integrationEnabled = false; state.contact = null; state.relationships = [{ role_key: 'customer', is_active: true }]; state.user.role = 'account_manager'; state.user.permissions = ['activity.create', 'activity.update.own']; state.existing = { id: 'activity-1', musteri_id: 'firm-a', created_by_user_id: 'u1' }; });
  it('rejects an activity belonging to another firm before any writes', async () => {
    state.existing!.musteri_id = 'firm-b';
    expect((await POST(request())).status).toBe(404);
    expect(state.writes).not.toHaveBeenCalled();
  });
  it('does not treat create permission as edit permission', async () => {
    state.user.permissions = ['activity.create'];
    expect((await POST(request())).status).toBe(403);
    expect(state.writes).not.toHaveBeenCalled();
  });
  it('rejects another authors activity despite owning the firm', async () => {
    state.existing!.created_by_user_id = 'u2';
    expect((await POST(request())).status).toBe(403);
    expect(state.writes).not.toHaveBeenCalled();
  });
  it('cannot bypass technical permissions by changing the channel', async () => {
    state.existing!.activity_scope = 'technical';
    expect((await POST(request())).status).toBe(403);
    expect(state.writes).not.toHaveBeenCalled();
  });
  it('allows an authorized owner past the guard into normal phase validation', async () => {
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'faz_no gerekli' });
  });
  it('rejects a contact belonging to another firm before writing', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    state.contact = { id, customer_id: 'firm-b', is_active: true };
    const response = await POST(request({ technical_contact_id: id }));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain('aktif bir teknik yetkili');
    expect(state.writes).not.toHaveBeenCalled();
  });
  it('rejects newly selecting an inactive contact', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    state.contact = { id, customer_id: 'firm-a', is_active: false };
    expect((await (await POST(request({ technical_contact_id: id }))).json()).message).toContain('aktif bir teknik yetkili');
    expect(state.writes).not.toHaveBeenCalled();
  });
  it('preserves an existing inactive contact during an authorized edit', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    state.contact = { id, customer_id: 'firm-a', is_active: false };
    state.existing!.technical_contact_id = id;
    expect(await (await POST(request({ technical_contact_id: id }))).json()).toEqual({ message: 'faz_no gerekli' });
  });
  it('persists a valid contact on a new activity', async () => {
    state.phaseOptional = true;
    const id = '11111111-1111-4111-8111-111111111111';
    state.contact = { id, customer_id: 'firm-a', is_active: true };
    expect((await POST(request({ activity_id: null, technical_contact_id: id }))).status).toBe(200);
    expect(state.writes).toHaveBeenCalledWith(expect.objectContaining({ technical_contact_id: id, musteri_id: 'firm-a' }));
  });
  it('does not clear an existing contact when an older client omits the field', async () => {
    state.phaseOptional = true;
    expect((await POST(request())).status).toBe(200);
    expect(state.writes).toHaveBeenCalledOnce();
    expect(state.writes.mock.calls[0][0]).not.toHaveProperty('technical_contact_id');
  });
  it('clears the contact only when explicitly requested', async () => {
    state.phaseOptional = true;
    expect((await POST(request({ technical_contact_id: null }))).status).toBe(200);
    expect(state.writes).toHaveBeenCalledWith(expect.objectContaining({ technical_contact_id: null }));
  });
  it('allows a non-integration activity for a business-partner-only firm without integration capability', async () => {
    state.phaseOptional = true;
    state.customerType = 'business_partner';
    state.relationships = [];
    const response = await POST(request({ activity_id: null, kanal: 'Telefon' }));
    expect(response.status).toBe(200);
    expect(state.writes).toHaveBeenCalledWith(expect.objectContaining({ activity_context: 'business_partner' }));
  });
  it('still rejects an integration activity when the firm lacks integration capability', async () => {
    state.phaseOptional = true;
    state.customerType = 'business_partner';
    state.relationships = [];
    state.user.role = 'super_admin';
    const response = await POST(request({ activity_id: null, kanal: 'Entegrasyon Süreci' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Bu firma için Entegrasyon Süreci yeteneği açık değil.' });
    expect(state.writes).not.toHaveBeenCalled();
  });
});
