import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { portalSigningText, signPortalRequest } from '@/lib/integrations/portal-auth';

type Step = { match: RegExp; rows: unknown[] };
const state = vi.hoisted(() => ({ sql: [] as { sql: string; params?: unknown[] }[], steps: [] as Step[], released: 0 }));
vi.mock('@/lib/db', () => ({
  db: {
    connect: async () => ({
      query: async (sql: string, params?: unknown[]) => {
        state.sql.push({ sql, params });
        const step = state.steps.find((s) => s.match.test(sql));
        const rows = step?.rows ?? [];
        return { rows, rowCount: rows.length };
      },
      release: () => { state.released += 1; },
    }),
  },
}));
import { POST, portalEventNote } from './route';

const SECRET = 'test-secret';
const URL_ = 'http://crm.local/api/integrations/portal/events';
const FIRM = '0b6b6c2e-3f5a-4d7e-9a1b-2c3d4e5f6a7b';
const EVENT = '5d1f2e3a-4b5c-4d6e-8f70-112233445566';
const base = { eventId: EVENT, type: 'partner.line_granted', occurredAt: '2026-11-01T22:30:00Z', crmFirmId: FIRM, productLine: 'D2D_JAR', version: '2.4.1', userEmail: 'dev@ortak.com', backfill: false };

function signed(body: unknown, opts: { secret?: string; skew?: number; raw?: string } = {}) {
  const raw = opts.raw ?? JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000) + (opts.skew ?? 0));
  const sig = signPortalRequest(opts.secret ?? SECRET, portalSigningText(ts, 'POST', new URL(URL_), raw));
  return new Request(URL_, { method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-pax-timestamp': ts, 'x-pax-signature': sig } });
}
const happy = (phase: number | null = 4, firm: Record<string, unknown> = {}): Step[] => [
  { match: /for update of m/, rows: [{ integration_enabled: true, partner_active: true, phase_no: phase, ...firm }] },
  { match: /insert into public\.portal_event_receipts/, rows: [{ event_id: EVENT }] },
  { match: /insert into public\.pipeline_eventleri/, rows: [{ id: 'pe-1' }] },
  { match: /select active_phase_no/, rows: [{ phase_no: phase || 3 }] },
];
const inserts = () => state.sql.filter((s) => /insert into public\.pipeline_eventleri/.test(s.sql));
const ran = (re: RegExp) => state.sql.some((s) => re.test(s.sql));

describe('POST /api/integrations/portal/events', () => {
  beforeEach(() => { vi.stubEnv('PAX_CRM_SHARED_SECRET', SECRET); state.sql = []; state.steps = happy(); state.released = 0; });
  afterEach(() => vi.unstubAllEnvs());

  it('writes an Entegrasyon Süreci activity that does not affect the phase', async () => {
    const res = await POST(signed(base));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ pipelineEventId: 'pe-1', partnerRoleOpened: false, integrationEnabled: false, phaseStarted: false });
    expect(inserts()).toHaveLength(1);
    expect(ran(/insert into public\.organization_roles|update public\.musteriler/)).toBe(false);
    const insert = inserts()[0];
    expect(insert.sql).toMatch(/'note_added', 'Tamamlandı'/);
    expect(insert.sql).toMatch(/'account', false, 'business_partner'/);
    expect(insert.sql).toMatch(/at time zone 'Europe\/Istanbul'/);
    const [firm, phase, aksiyon, occurred, note, payload, createdBy] = insert.params!;
    expect([firm, phase, aksiyon, occurred, createdBy]).toEqual([FIRM, 4, 'AKTIVITE:Entegrasyon Süreci', base.occurredAt, 'PAX Portal']);
    expect(note).toBe('Ürün hattı erişimi verildi · D2D-JAR · sürüm 2.4.1 (Portal)');
    expect(JSON.parse(payload as string)).toMatchObject({ source: 'portal', channel: 'Portal', eventId: EVENT, backfill: false });
    expect(ran(/^commit$/)).toBe(true);
    expect(state.released).toBe(1);
  });

  it('opens partner role and capability, starts phase 3 when no phase, then logs a non-phase activity', async () => {
    for (const phase of [null, 0]) {
      state.sql = [];
      state.steps = happy(phase, { integration_enabled: false, partner_active: null });
      const res = await POST(signed({ ...base, type: 'partner.registered', productLine: null, version: null, backfill: true }));
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ pipelineEventId: 'pe-1', partnerRoleOpened: true, integrationEnabled: true, phaseStarted: true });
      const role = state.sql.find((s) => /insert into public\.organization_roles/.test(s.sql))!;
      expect(role.sql).toMatch(/on conflict \(customer_id, role_key\) do update/);
      expect(role.params).toEqual([FIRM, 'Entegrasyon Firması']);
      expect(ran(/update public\.musteriler set integration_enabled = true/)).toBe(true);
      const [start, activity] = inserts();
      expect(start.sql).toMatch(/'Devam Ediyor'/);
      expect(start.sql).toMatch(/'account', true, 'business_partner'/);
      expect(start.params![1]).toBe(3);
      expect(activity.sql).toMatch(/'account', false, 'business_partner'/);
      expect(activity.params![1]).toBe(3);
      expect(activity.params![4]).toBe('[Portal geçmiş aktarımı] Portal kaydı oluşturuldu (Portal)');
    }
  });

  it('returns duplicate without writing an activity for a repeated eventId', async () => {
    state.steps = happy().map((s) => (/portal_event_receipts/.test(s.match.source) ? { ...s, rows: [] } : s));
    const res = await POST(signed(base));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ duplicate: true });
    expect(ran(/insert into public\.pipeline_eventleri/)).toBe(false);
    expect(ran(/^rollback$/)).toBe(true);
  });

  it('returns 404 for unknown firms', async () => {
    state.steps = [];
    expect((await POST(signed(base))).status).toBe(404);
    expect(ran(/portal_event_receipts/)).toBe(false);
  });

  it('does not open role or phase for a duplicate on a new firm', async () => {
    state.steps = happy(null, { integration_enabled: false, partner_active: false })
      .map((s) => (/portal_event_receipts/.test(s.match.source) ? { ...s, rows: [] } : s));
    expect((await POST(signed(base))).status).toBe(200);
    expect(ran(/insert into public\.organization_roles|update public\.musteriler|pipeline_eventleri/)).toBe(false);
  });

  it('rolls back with 409 if the partner phase changed during the write', async () => {
    state.steps = happy().map((s) => (/active_phase_no/.test(s.match.source) ? { ...s, rows: [{ phase_no: 8 }] } : s));
    expect((await POST(signed(base))).status).toBe(409);
    expect(ran(/^commit$/)).toBe(false);
  });

  it('rejects invalid bodies with 400 before touching the database', async () => {
    expect((await POST(signed(null, { raw: '{not json' }))).status).toBe(400);
    const res = await POST(signed({ ...base, type: 'partner.deleted', crmFirmId: 'nope' }));
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toEqual(expect.arrayContaining(['type', 'crmFirmId']));
    expect(state.sql).toHaveLength(0);
  });

  it('rejects bad signatures, tampered bodies, stale timestamps and missing secret', async () => {
    expect((await POST(signed(base, { secret: 'other' }))).status).toBe(401);
    const req = signed(base);
    const tampered = new Request(URL_, { method: 'POST', body: JSON.stringify({ ...base, backfill: true }), headers: req.headers });
    expect((await POST(tampered)).status).toBe(401);
    expect((await POST(signed(base, { skew: -301 }))).status).toBe(401);
    vi.stubEnv('PAX_CRM_SHARED_SECRET', '');
    expect((await POST(signed(base))).status).toBe(503);
    expect(state.sql).toHaveLength(0);
  });

  it('builds readable notes for every event type', () => {
    expect(portalEventNote({ ...base, type: 'partner.artifact_downloaded', productLine: 'A2A', version: null } as never)).toBe('SDK/paket indirildi · A2A (Portal)');
    expect(portalEventNote({ ...base, type: 'partner.line_revoked', productLine: 'D2D_DLL', version: null } as never)).toBe('Ürün hattı erişimi kaldırıldı · D2D-DLL (Portal)');
  });
});
