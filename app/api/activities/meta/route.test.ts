import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  phaseStatus: { durum: 'Devam Ediyor', owner: 'Account', partner_owner: null } as Record<string, unknown> | null,
  latestWaitingParty: { partner_owner: 'Müşteri', created_at: '2026-09-11T09:00:00Z' } as Record<string, unknown> | null,
  customerPipeline: { aktif_faz_no: 9, durum: 'Devam Ediyor', owner: 'Account', partner_owner: null } as Record<string, unknown> | null,
  partnerPipeline: { active_phase_no: 9, status: 'Devam Ediyor', owner: 'İş Ortakları', partner_owner: null } as Record<string, unknown> | null,
  tables: [] as string[],
}));

vi.mock('@/lib/authz', () => ({
  requireActivityReadOrThrow: async () => ({ id: 'u1' }),
  assertOwnedResourceAccess: vi.fn(),
}));

vi.mock('@/lib/pg/admin', () => ({
  createPgAdminClient: () => ({
    from: (table: string) => {
      state.tables.push(table);
      let selected = '';
      const query: any = {
        select: (fields: string) => { selected = fields; return query; },
        eq: () => query,
        not: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({
          data: table === 'musteriler'
            ? { owner_user_id: 'u1', sorumlu: 'Account' }
            : table === 'pipeline_eventleri'
              ? (selected.includes('durum') ? state.phaseStatus : state.latestWaitingParty)
              : table === 'musteri_pipeline'
                ? state.customerPipeline
                : state.partnerPipeline,
          error: null,
        }),
      };
      return query;
    },
  }),
}));

import { GET } from './route';

const request = (context = 'customer') => new Request(`http://localhost/api/activities/meta?musteri_id=firm-a&faz_no=9&activity_context=${context}`);

describe('activity phase metadata', () => {
  beforeEach(() => {
    state.tables.length = 0;
    state.phaseStatus = { durum: 'Devam Ediyor', owner: 'Account', partner_owner: null };
    state.latestWaitingParty = { partner_owner: 'Müşteri', created_at: '2026-09-11T09:00:00Z' };
  });

  it('returns the latest non-empty waiting party from the customer activity history', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ partner_owner: 'Müşteri' }));
  });

  it('uses the customer pipeline table for customer activities', async () => {
    await GET(request());
    expect(state.tables).toContain('musteri_pipeline');
    expect(state.tables).not.toContain('organization_pipeline_states');
  });

  it('preserves a phase-specific waiting party when one exists', async () => {
    state.phaseStatus = { durum: 'Devam Ediyor', owner: 'Account', partner_owner: 'İş Ortağı' };
    const response = await GET(request());
    expect((await response.json()).partner_owner).toBe('İş Ortağı');
  });

  it('uses the organization pipeline table for business partner activities', async () => {
    await GET(request('business_partner'));
    expect(state.tables).toContain('organization_pipeline_states');
    expect(state.tables).not.toContain('musteri_pipeline');
  });
});
