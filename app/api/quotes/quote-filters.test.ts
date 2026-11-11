import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/authz', () => ({ getUserDepartments: vi.fn() }));

import { getUserDepartments } from '@/lib/authz';
import { applyQuoteScopeFilters, readQuoteScopeFilters } from './quote-filters';

const recorder = (data: any[] = []) => {
  const calls: any[] = [];
  const chain: any = new Proxy({}, {
    get: (_t, op) => op === 'then'
      ? (resolve: any) => resolve({ data, error: null })
      : (...args: any[]) => { calls.push([op, ...args]); return chain; },
  });
  return { chain, calls };
};

describe('readQuoteScopeFilters', () => {
  it('keeps valid dates/owner id, drops junk', () => {
    const f = readQuoteScopeFilters(new URL('http://x/?from=2026-01-01&to=bad&owner_id=u-1&owner=Ali%25,Veli&department=Retail'));
    expect(f).toEqual({ from: '2026-01-01', to: '', ownerId: 'u-1', ownerName: 'Ali  Veli', department: 'Retail' });
    expect(readQuoteScopeFilters(new URL('http://x/?owner_id=a;b')).ownerId).toBe('');
  });
});

describe('applyQuoteScopeFilters', () => {
  it('applies proposal_date range and owner id|name OR', async () => {
    vi.mocked(getUserDepartments).mockResolvedValue(null);
    const q = recorder();
    await applyQuoteScopeFilters(q.chain, {}, { id: 'me' }, { from: '2026-01-01', to: '2026-01-31', ownerId: 'u1', ownerName: 'Ali', department: null });
    expect(q.calls).toEqual([
      ['gte', 'proposal_date', '2026-01-01'],
      ['lte', 'proposal_date', '2026-01-31'],
      ['or', 'owner_user_id.eq.u1,owner_name.ilike.Ali'],
    ]);
  });

  it('restricts to department customers via musteriler.is_kolu', async () => {
    vi.mocked(getUserDepartments).mockResolvedValue(null);
    const q = recorder();
    const m = recorder([{ id: 'c1' }, { id: 'c2' }]);
    await applyQuoteScopeFilters(q.chain, { from: () => m.chain }, { id: 'me' }, { from: '', to: '', ownerId: '', ownerName: '', department: 'Bank' });
    expect(m.calls).toContainEqual(['in', 'is_kolu', ['Bank']]);
    expect(q.calls).toEqual([['in', 'customer_id', ['c1', 'c2']]]);
  });
});
