'use client';
// Sayfaya özel (merkezi FilterBar dışındaki) filtreleri URL'de tutar — ör. Kanal, Oran, Ay, Yıl.
// FilterBar parametrelerine dokunmaz; değişiklikte sayfalamayı sıfırlar.
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useUrlParams<K extends string>(keys: readonly K[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams?.toString() ?? '';
  const values = useMemo(() => {
    const sp = new URLSearchParams(raw);
    return Object.fromEntries(keys.map((k) => [k, sp.get(k) ?? ''])) as Record<K, string>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, keys.join(',')]);
  const set = useCallback((patch: Partial<Record<K, string>>) => {
    const sp = new URLSearchParams(raw);
    for (const [k, v] of Object.entries(patch) as Array<[string, string | undefined]>) {
      if (v) sp.set(k, v); else sp.delete(k);
    }
    sp.delete('page');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [raw, router, pathname]);
  return { values, set };
}
