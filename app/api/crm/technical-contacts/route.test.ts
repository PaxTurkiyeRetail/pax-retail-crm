import { beforeEach, describe, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({
  user: { id: 'u1', email: 'a@example.com', full_name: 'Owner', role: 'account_manager', permissions: ['customer.read', 'customer.update.own'] },
  owner: 'u1', contact: null as Record<string, unknown> | null,
  query: vi.fn(), audit: vi.fn(), release: vi.fn(),
}));
vi.mock('@/lib/authz', () => ({ requireAllowedUserOrThrow: async () => s.user }));
vi.mock('@/lib/db', () => ({ db: { query: s.query, connect: async () => ({ query: s.query, release: s.release }) } }));
vi.mock('@/lib/audit', () => ({ recordAuditEvent: s.audit }));
import { GET, POST, PATCH } from './route';
const customer_id = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const fields = { full_name: 'Test Yetkili', phone: '+90 555 123 45 67', email: 'test@example.com', title: 'Teknik Müdür' };
const request = (method: string, body: object) => new Request('http://localhost/api/crm/technical-contacts', { method, body: JSON.stringify(body) });
describe('technical contacts access and atomic updates', () => {
  beforeEach(() => {
    vi.clearAllMocks(); s.audit.mockResolvedValue(undefined); s.owner = 'u1';
    s.user.permissions = ['customer.read', 'customer.update.own'];
    s.contact = { id, customer_id, ...fields, version: 1, is_active: true };
    s.query.mockImplementation(async (sql: string) => ({ rows:
      sql.includes('from public.musteriler') ? [{ id: customer_id, owner_user_id: s.owner }]
      : sql.includes('customer_technical_contacts') ? (s.contact ? [s.contact] : []) : [] }));
  });
  it('denies reading another owners contacts before querying them', async () => {
    s.owner = 'u2';
    expect((await GET(new Request(`http://localhost/api?customer_id=${customer_id}`))).status).toBe(403);
    expect(s.query.mock.calls.some(([sql]) => sql.includes('customer_technical_contacts'))).toBe(false);
  });
  it('denies a read-only user from creating contacts', async () => {
    s.user.permissions = ['customer.read'];
    expect((await POST(request('POST', { customer_id, ...fields }))).status).toBe(403);
    expect(s.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
  });
  it('validates fields before database writes', async () => {
    expect((await POST(request('POST', { customer_id, ...fields, email: 'invalid' }))).status).toBe(400);
    expect(s.query).not.toHaveBeenCalled();
  });
  it('creates and audits in the same transaction', async () => {
    expect((await POST(request('POST', { customer_id, ...fields }))).status).toBe(201);
    expect(s.audit).toHaveBeenCalledOnce();
    expect(s.query).toHaveBeenLastCalledWith('commit');
    expect(s.release).toHaveBeenCalledOnce();
  });
  it('rolls back when the required audit fails', async () => {
    s.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await POST(request('POST', { customer_id, ...fields }))).status).toBe(500);
    expect(s.query).toHaveBeenLastCalledWith('rollback'); log.mockRestore();
  });
  it('rejects stale updates without overwriting the contact', async () => {
    expect((await PATCH(request('PATCH', { customer_id, id, expected_version: 2, is_active: false }))).status).toBe(409);
    expect(s.query.mock.calls.some(([sql]) => sql.startsWith('update'))).toBe(false);
  });
  it('scopes the locked contact lookup to the requested firm', async () => {
    s.contact = null;
    expect((await PATCH(request('PATCH', { customer_id, id, expected_version: 1, is_active: false }))).status).toBe(404);
    expect(s.query).toHaveBeenCalledWith(expect.stringContaining('where id=$1 and customer_id=$2 for update'), [id, customer_id]);
  });
  it('deactivates without deleting historical contacts', async () => {
    expect((await PATCH(request('PATCH', { customer_id, id, expected_version: 1, is_active: false }))).status).toBe(200);
    expect(s.query).toHaveBeenCalledWith(expect.stringContaining('version=version+1'), [id, customer_id, fields.full_name, fields.phone, fields.email, fields.title, false, 'u1']);
  });
});
