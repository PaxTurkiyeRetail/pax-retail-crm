'use client';

import { useEffect, useState } from 'react';
import { normalizePageSize } from '@/lib/ui-pagination';

export function useConfiguredPageSize(fallback = 25) {
  const [pageSize, setPageSize] = useState(() => normalizePageSize(fallback));

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/ui-settings', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (payload) setPageSize(normalizePageSize(payload.defaultPageSize, fallback));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [fallback]);

  return [pageSize, setPageSize] as const;
}
