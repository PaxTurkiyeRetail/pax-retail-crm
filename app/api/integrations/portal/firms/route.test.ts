import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { portalSigningText, signPortalRequest } from '@/lib/integrations/portal-auth';

const state = vi.hoisted(() => ({ calls: [] as { sql: string; params: unknown[] }[], rows: [] as unknown[] }));
vi.mock('@/lib/db', () => ({
  db: { query: async (sql: string, params: unknown[]) => { state.calls.push({ sql, params }); return { rows: state.rows }; } },
}));
import { GET } from './route';

const SECRET = 'test-secret';
function signed(path: string, opts: { secret?: string; skew?: number; signature?: string } = {}) {
  const url = new URL(`http://crm.local${path}`);
  const ts = String(Math.floor(Date.now() / 1000) + (opts.skew ?? 0));
  const sig = opts.signature ?? signPortalRequest(opts.secret ?? SECRET, portalSigningText(ts, 'GET', url));
  return new Request(url, { headers: { 'x-pax-timestamp': ts, 'x-pax-signature': sig } });
}

describe('GET /api/integrations/portal/firms', () => {
  beforeEach(() => {
    vi.stubEnv('PAX_CRM_SHARED_SECRET', SECRET);
    state.calls = [];
    state.rows = [
      { id: 'f1', name: 'Ortak A', phase_no: 3, phase_name: 'Test', account_manager: 'Ali', owner_user_id: 'u1', domains: ['ortaka.com'] },
      { id: 'f2', name: 'Ortak B', phase_no: null, phase_name: null, account_manager: null, owner_user_id: null, domains: null },
    ];
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns business partners for a valid signature', async () => {
    const res = await GET(signed('/api/integrations/portal/firms?q=ortak'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ firms: [
      { id: 'f1', name: 'Ortak A', partnerPhase: { no: 3, name: 'Test' }, accountManager: 'Ali', ownerUserId: 'u1', contactEmailDomains: ['ortaka.com'], city: null },
      { id: 'f2', name: 'Ortak B', partnerPhase: null, accountManager: null, ownerUserId: null, contactEmailDomains: [], city: null },
    ] });
  });

  it('queries only active business_partner roles, read-only, never full emails', async () => {
    await GET(signed('/api/integrations/portal/firms'));
    const { sql } = state.calls[0];
    expect(sql).toMatch(/role_key = 'business_partner' and r\.is_active/);
    expect(sql).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(sql).not.toMatch(/full_name/);
  });

  it('caps limit at 50 and trims q to 100 chars', async () => {
    await GET(signed(`/api/integrations/portal/firms?limit=500&q=${'x'.repeat(150)}`));
    expect(state.calls[0].params[1]).toBe(50);
    expect((state.calls[0].params[0] as string).length).toBe(100);
    await GET(signed('/api/integrations/portal/firms?limit=10'));
    expect(state.calls[1].params[1]).toBe(10);
  });

  it('rejects a wrong signature with 401 and no detail', async () => {
    const res = await GET(signed('/api/integrations/portal/firms', { secret: 'other' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: 'unauthorized' });
    expect(state.calls).toHaveLength(0);
  });

  it('rejects a tampered query string', async () => {
    const req = signed('/api/integrations/portal/firms?q=a');
    const tampered = new Request('http://crm.local/api/integrations/portal/firms?q=b', { headers: req.headers });
    expect((await GET(tampered)).status).toBe(401);
  });

  it('rejects an expired timestamp', async () => {
    expect((await GET(signed('/api/integrations/portal/firms', { skew: -301 }))).status).toBe(401);
    expect((await GET(signed('/api/integrations/portal/firms', { skew: 301 }))).status).toBe(401);
  });

  it('fails closed with 503 when the secret is not configured', async () => {
    vi.stubEnv('PAX_CRM_SHARED_SECRET', '');
    const res = await GET(signed('/api/integrations/portal/firms'));
    expect(res.status).toBe(503);
    expect(state.calls).toHaveLength(0);
  });
});
