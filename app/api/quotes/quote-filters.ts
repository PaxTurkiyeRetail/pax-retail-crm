// /api/quotes/list ve /api/quotes/stats ortak filtreleri: sayılar tutarlı kalsın.
import { getUserDepartments } from '@/lib/authz';
import { resolveDepartmentFilter } from '@/lib/departments';
import { isIsoDate } from '@/lib/filters/period';

export type QuoteScopeFilters = {
  from: string;
  to: string;
  ownerId: string;
  ownerName: string;
  department: string | null;
};

export function readQuoteScopeFilters(url: URL): QuoteScopeFilters {
  const get = (key: string) => String(url.searchParams.get(key) ?? '').trim();
  const from = get('from');
  const to = get('to');
  const ownerId = get('owner_id');
  return {
    from: isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
    ownerId: /^[A-Za-z0-9_-]{1,64}$/.test(ownerId) ? ownerId : '',
    ownerName: get('owner').replace(/[\%_,()]/g, ' ').trim(),
    department: get('department') || null,
  };
}

/**
 * Dönem (proposal_date), Satıcı (owner_user_id | owner_name) ve Departman
 * (musteriler.is_kolu → customer_id) filtrelerini quotes sorgusuna uygular.
 */
export async function applyQuoteScopeFilters(query: any, admin: any, me: any, filters: QuoteScopeFilters): Promise<{ query: any; error?: string }> {
  if (filters.from) query = query.gte('proposal_date', filters.from);
  if (filters.to) query = query.lte('proposal_date', filters.to);
  if (filters.ownerId || filters.ownerName) {
    const ors = [
      filters.ownerId ? `owner_user_id.eq.${filters.ownerId}` : '',
      filters.ownerName ? `owner_name.ilike.${filters.ownerName}` : '',
    ].filter(Boolean);
    query = query.or(ors.join(','));
  }
  const deptFilter = resolveDepartmentFilter(filters.department, await getUserDepartments(me));
  if (deptFilter) {
    const result = await admin.from('musteriler').select('id').in('is_kolu', deptFilter).limit(20000);
    if (result.error) return { query, error: result.error.message };
    const ids = (result.data ?? []).map((row: any) => String(row.id ?? '')).filter(Boolean);
    query = query.in('customer_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  }
  return { query };
}
