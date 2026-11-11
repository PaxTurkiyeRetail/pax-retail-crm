// /api/crm/list ve /api/crm/stats ortak filtre mantığı: sayılar tutarlı kalsın.
import { getUserDepartments, userHasPermission } from '@/lib/authz';
import { resolveDepartmentFilter } from '@/lib/departments';

export type FazNoFilter = { from: number; to: number } | null;

/** faz_no: '7' tek faz, '1-4' aralık (faz kartları). Geçersiz → null (filtre yok). */
export function parseFazNoFilter(raw: string | null | undefined): FazNoFilter {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const range = value.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return { from: n, to: n };
}

export function escapeIlike(value: string) {
  return String(value ?? '').replace(/[\%_]/g, ' ').trim();
}

export function applyCustomerDbFilters(query: any, params: {
  owner: string;
  sector: string;
  fazNo: FazNoFilter;
  q: string;
  visibleCustomerIds?: string[] | null;
}) {
  const { owner, sector, fazNo, q, visibleCustomerIds } = params;

  if (visibleCustomerIds) query = query.in('musteri_id', visibleCustomerIds.length ? visibleCustomerIds : ['__none__']);
  if (owner) query = query.ilike('sorumlu', escapeIlike(owner));
  if (sector) query = query.ilike('sektor', escapeIlike(sector));
  // entegrasyon_tipi enum oldugu icin DB tarafinda ilike kullanilmaz; JS tarafinda filtrelenir.
  if (fazNo) {
    if (fazNo.from === fazNo.to) query = query.eq('aktif_faz_no', fazNo.from);
    else query = query.gte('aktif_faz_no', fazNo.from).lte('aktif_faz_no', fazNo.to);
  }

  // Ana arama once DB tarafinda daraltilir; sonra JS tarafinda normalize kontrol uygulanir.
  if (q) {
    const needle = escapeIlike(q);
    if (needle) {
      const like = `%${needle}%`;
      query = query.or([
        `musteri.ilike.${like}`,
        `sektor.ilike.${like}`,
        `sorumlu.ilike.${like}`,
        `aktif_faz_adi.ilike.${like}`,
      ].join(','));
    }
  }

  return query;
}

/** Liste ve istatistikte tek entegrasyon kaynağı: musteriler.integration_type_key, yoksa eski entegrasyon_tipi. */
export function effectiveIntegration(row: { integration_type_key?: string | null; entegrasyon_tipi?: string | null } | null | undefined): string | null {
  return row?.integration_type_key || row?.entegrasyon_tipi || null;
}

/** Türkçe karakter + aksan katlamalı, alfanümerik normalize (içerir eşleşmesi için). */
export function foldText(value: string | null | undefined) {
  return String(value ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type CustomerScopeFilters = {
  /** Satıcı kullanıcı id'si (musteriler.owner_user_id); ownerName ile OR'lanır. */
  ownerId?: string | null;
  /** Satıcı adı (musteriler.sorumlu) — hesabı olmayan sahipler / Havuz-Gruplar. */
  ownerName?: string | null;
  /** Etkin entegrasyon (effectiveIntegration) üzerinde içerir eşleşmesi. */
  integration?: string | null;
};

const idList = (rows: any[] | null | undefined) => (rows ?? []).map((row: any) => String(row.id ?? '')).filter(Boolean);

/**
 * Görünür müşteri id'leri: customer.read.any yoksa sahip olunanlar; departman
 * kapsamı (allowed_users.departments / ?department= | ?is_kolu=) varsa ona daraltılır.
 * Satıcı (id/ad, yalnız read.any) ve entegrasyon filtresi de musteriler üzerinden uygulanır.
 * null = kısıt yok.
 */
export async function resolveVisibleCustomerIds(me: any, admin: any, isKoluParam: string | null, filters: CustomerScopeFilters = {}): Promise<{ ids: string[] | null; error?: string }> {
  const canReadAny = userHasPermission(me, 'customer.read.any');
  let ids: string[] | null = null;
  const intersect = (next: string[]) => {
    const set = new Set(next);
    ids = ids ? ids.filter((id) => set.has(id)) : next;
  };
  if (!canReadAny) {
    const result = await admin.from('musteriler').select('id').eq('owner_user_id', me.id).limit(10000);
    if (result.error) return { ids: null, error: result.error.message };
    ids = idList(result.data);
  }
  const deptFilter = resolveDepartmentFilter(isKoluParam, await getUserDepartments(me));
  if (deptFilter) {
    const deptResult = await admin.from('musteriler').select('id').in('is_kolu', deptFilter).limit(20000);
    if (deptResult.error) return { ids: null, error: deptResult.error.message };
    intersect(idList(deptResult.data));
  }
  const ownerId = canReadAny ? String(filters.ownerId ?? '').trim() : '';
  const ownerName = canReadAny ? escapeIlike(String(filters.ownerName ?? '')) : '';
  if (ownerId || ownerName) {
    const ors = [
      /^[A-Za-z0-9_-]{1,64}$/.test(ownerId) ? `owner_user_id.eq.${ownerId}` : '',
      ownerName && !/[,()]/.test(ownerName) ? `sorumlu.ilike.${ownerName}` : '',
    ].filter(Boolean);
    if (!ors.length) return { ids: [] };
    const ownerResult = await admin.from('musteriler').select('id').or(ors.join(',')).limit(20000);
    if (ownerResult.error) return { ids: null, error: ownerResult.error.message };
    intersect(idList(ownerResult.data));
  }
  const integrationNeedle = foldText(filters.integration);
  if (integrationNeedle) {
    // entegrasyon_tipi enum → DB ilike yok; etkin değer JS'te eşlenir.
    const intResult = await admin.from('musteriler').select('id,integration_type_key,entegrasyon_tipi').limit(20000);
    if (intResult.error) return { ids: null, error: intResult.error.message };
    intersect(idList((intResult.data ?? []).filter((row: any) => foldText(effectiveIntegration(row)).includes(integrationNeedle))));
  }
  return { ids };
}
