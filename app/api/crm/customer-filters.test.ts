import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/authz', () => ({ getUserDepartments: vi.fn(), userHasPermission: vi.fn() }));

import { getUserDepartments, userHasPermission } from '@/lib/authz';
import { applyCustomerDbFilters, effectiveIntegration, parseFazNoFilter, resolveVisibleCustomerIds } from './customer-filters';

describe('parseFazNoFilter', () => {
  it('parses single, range, reversed range and rejects junk', () => {
    expect(parseFazNoFilter('7')).toEqual({ from: 7, to: 7 });
    expect(parseFazNoFilter('1-4')).toEqual({ from: 1, to: 4 });
    expect(parseFazNoFilter('9 - 5')).toEqual({ from: 5, to: 9 });
    expect(parseFazNoFilter('')).toBeNull();
    expect(parseFazNoFilter('abc')).toBeNull();
  });
});

describe('applyCustomerDbFilters', () => {
  const builder = () => {
    const calls: any[] = [];
    const q: any = new Proxy({}, { get: (_t, op) => (...args: any[]) => { calls.push([op, ...args]); return q; } });
    return { q, calls };
  };

  it('uses gte/lte for phase ranges and eq for single phase', () => {
    const a = builder();
    applyCustomerDbFilters(a.q, { owner: '', sector: '', fazNo: { from: 1, to: 4 }, q: '' });
    expect(a.calls).toEqual([['gte', 'aktif_faz_no', 1], ['lte', 'aktif_faz_no', 4]]);
    const b = builder();
    applyCustomerDbFilters(b.q, { owner: '', sector: '', fazNo: { from: 3, to: 3 }, q: '' });
    expect(b.calls).toEqual([['eq', 'aktif_faz_no', 3]]);
  });
});

describe('effectiveIntegration', () => {
  it('prefers integration_type_key, falls back to entegrasyon_tipi', () => {
    expect(effectiveIntegration({ integration_type_key: 'api', entegrasyon_tipi: 'legacy' })).toBe('api');
    expect(effectiveIntegration({ integration_type_key: null, entegrasyon_tipi: 'legacy' })).toBe('legacy');
    expect(effectiveIntegration(null)).toBeNull();
  });
});

describe('resolveVisibleCustomerIds', () => {
  // Sahte admin: her from() çağrısı zincirlenebilir, await edilince tabloya göre veri döner.
  const fakeAdmin = (rowsByCall: any[][]) => {
    const calls: any[][] = [];
    let n = 0;
    const admin = {
      from: (table: string) => {
        const log: any[] = [table];
        calls.push(log);
        const data = rowsByCall[n++] ?? [];
        const chain: any = new Proxy({}, {
          get: (_t, op) => op === 'then'
            ? (resolve: any) => resolve({ data, error: null })
            : (...args: any[]) => { log.push([op, ...args]); return chain; },
        });
        return chain;
      },
    };
    return { admin, calls };
  };

  it('returns null (no restriction) for read.any without filters', async () => {
    vi.mocked(userHasPermission).mockReturnValue(true);
    vi.mocked(getUserDepartments).mockResolvedValue(null);
    const { admin, calls } = fakeAdmin([]);
    expect(await resolveVisibleCustomerIds({ id: 'u1' }, admin, null)).toEqual({ ids: null });
    expect(calls).toEqual([]);
  });

  it('owner filter ORs owner_user_id and sorumlu, intersects with department', async () => {
    vi.mocked(userHasPermission).mockReturnValue(true);
    vi.mocked(getUserDepartments).mockResolvedValue(null);
    const { admin, calls } = fakeAdmin([[{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]]);
    const result = await resolveVisibleCustomerIds({ id: 'u1' }, admin, 'Retail', { ownerId: 'u9', ownerName: 'Ali Veli' });
    expect(result).toEqual({ ids: ['b'] });
    expect(calls[0]).toContainEqual(['in', 'is_kolu', ['Retail']]);
    expect(calls[1]).toContainEqual(['or', 'owner_user_id.eq.u9,sorumlu.ilike.Ali Veli']);
  });

  it('ignores owner filter without read.any (own customers only)', async () => {
    vi.mocked(userHasPermission).mockReturnValue(false);
    vi.mocked(getUserDepartments).mockResolvedValue(null);
    const { admin, calls } = fakeAdmin([[{ id: 'x' }]]);
    const result = await resolveVisibleCustomerIds({ id: 'u1' }, admin, null, { ownerId: 'u9' });
    expect(result).toEqual({ ids: ['x'] });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContainEqual(['eq', 'owner_user_id', 'u1']);
  });

  it('integration filter matches effective integration (key first, legacy fallback)', async () => {
    vi.mocked(userHasPermission).mockReturnValue(true);
    vi.mocked(getUserDepartments).mockResolvedValue(null);
    const { admin } = fakeAdmin([[
      { id: '1', integration_type_key: 'Entegre', entegrasyon_tipi: 'Manuel' },
      { id: '2', integration_type_key: null, entegrasyon_tipi: 'Entegre' },
      { id: '3', integration_type_key: 'Manuel', entegrasyon_tipi: 'Entegre' },
    ]]);
    expect(await resolveVisibleCustomerIds({ id: 'u1' }, admin, null, { integration: 'entegre' })).toEqual({ ids: ['1', '2'] });
  });
});
