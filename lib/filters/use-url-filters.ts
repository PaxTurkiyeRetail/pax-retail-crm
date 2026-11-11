'use client';
// Filtre durumunu URL query ile senkron tutar (router.replace, scroll:false).
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Department } from '@/lib/departments';
import {
  countActiveFilters, filtersToQuery, parseFilters,
  type FilterKey, type FilterValues, type PageFilterConfig,
} from '@/lib/filters/schema';

export type UrlFilters = {
  values: FilterValues;
  set: (patch: Partial<Record<FilterKey, string | undefined | null>>) => void;
  remove: (key: FilterKey) => void;
  reset: () => void;
  activeCount: number;
};

export function useUrlFilters(config: PageFilterConfig, opts: { allowedDepartments?: Department[] | null } = {}): UrlFilters {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const allowedKey = (opts.allowedDepartments ?? []).join(',');

  const values = useMemo(
    () => parseFilters(new URLSearchParams(searchParams?.toString() ?? ''), config, { allowedDepartments: opts.allowedDepartments }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, config, allowedKey],
  );

  const commit = useCallback((next: FilterValues) => {
    // config dışı parametreleri (ör. tab, page) koru; sayfalamayı sıfırla
    const keep = new URLSearchParams(searchParams?.toString() ?? '');
    for (const k of config.keys) keep.delete(k);
    keep.delete('page');
    filtersToQuery(next, config).forEach((v, k) => keep.set(k, v));
    const qs = keep.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams, config]);

  const set = useCallback((patch: Partial<Record<FilterKey, string | undefined | null>>) => {
    const next: Record<string, string | undefined> = { ...values };
    for (const [k, v] of Object.entries(patch)) next[k] = v === null || v === '' ? undefined : v;
    // preset seçilince özel aralık temizlenir; tarih girilince period custom
    if ('period' in patch && patch.period !== 'custom') { next.from = undefined; next.to = undefined; }
    if (('from' in patch || 'to' in patch) && config.keys.includes('period')) next.period = 'custom';
    commit(next as FilterValues);
  }, [values, commit, config.keys]);

  const remove = useCallback((key: FilterKey) => {
    if (key === 'from' || key === 'to' || (key === 'period' && values.period === 'custom')) {
      set({ from: undefined, to: undefined, period: config.defaults?.period });
      return;
    }
    // default'a dön: commit default değeri query'ye yazmaz
    set({ [key]: config.defaults?.[key] ?? undefined });
  }, [set, values.period, config.defaults]);

  const reset = useCallback(() => commit({ ...(config.defaults ?? {}) }), [commit, config.defaults]);

  return { values, set, remove, reset, activeCount: countActiveFilters(values, config) };
}
