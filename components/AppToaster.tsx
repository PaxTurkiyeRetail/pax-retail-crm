'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppToastPayload } from '@/lib/app-toast';

type ToastItem = Required<Pick<AppToastPayload, 'type' | 'title'>> & {
  id: string;
  description?: string;
  duration: number;
};

type CachedFetchItem = {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  expiresAt: number;
};

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DOWNLOAD_WORDS = ['download', 'indir', 'export', 'excel', 'xlsx', 'pptx', 'pdf', 'csv', 'rapor'];
const INTERNAL_API_PREFIX = '/api/';
const MAX_VISIBLE_TOASTS = 5;
const API_CACHE_TTL_MS = 15000;
const API_CACHE_MAX_ITEMS = 80;
const CACHEABLE_GET_PREFIXES = [
  '/api/crm/list',
  '/api/crm/stats',
  '/api/crm/options',
  '/api/activities/list',
  '/api/activities/options',
  '/api/faz/list',
  '/api/reports/',
  '/api/quotes/options',
  '/api/quotes/list',
  '/api/quotes/stats',
];

declare global {
  interface Window {
    __paxFetchPatched?: boolean;
    __paxFetchCache?: Map<string, CachedFetchItem>;
    __paxFetchInflight?: Map<string, Promise<CachedFetchItem>>;
  }
}

function makeToastId(prefix = 'toast') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}


function cacheKeyFor(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.cache === 'no-store' || init?.cache === 'reload') return '';
  const method = requestMethod(input, init);
  if (method !== 'GET') return '';
  const rawUrl = requestUrl(input);
  const parsed = normalizeUrl(rawUrl);
  if (!parsed || parsed.origin !== window.location.origin) return '';
  if (!CACHEABLE_GET_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) return '';
  return `${method}:${parsed.pathname}${parsed.search}`;
}

function cloneFromCached(item: CachedFetchItem) {
  return new Response(item.body, {
    status: item.status,
    statusText: item.statusText,
    headers: item.headers,
  });
}

function putCachedResponse(cacheKey: string, item: CachedFetchItem) {
  if (!cacheKey) return;
  const cache = window.__paxFetchCache ?? new Map<string, CachedFetchItem>();
  window.__paxFetchCache = cache;
  cache.set(cacheKey, item);
  if (cache.size > API_CACHE_MAX_ITEMS) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

async function materializeResponseForCache(cacheKey: string, response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const item: CachedFetchItem = {
    body: await response.text(),
    status: response.status,
    statusText: response.statusText,
    headers: Array.from(response.headers.entries()),
    expiresAt: Date.now() + API_CACHE_TTL_MS,
  };

  if (cacheKey && response.ok && contentType.includes('application/json')) {
    putCachedResponse(cacheKey, item);
  }

  return item;
}

function clearApiCache() {
  window.__paxFetchCache?.clear();
  window.__paxFetchInflight?.clear();
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  const fromInit = init?.method;
  if (fromInit) return fromInit.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function normalizeUrl(url: string) {
  try {
    return new URL(url, window.location.origin);
  } catch {
    return null;
  }
}

function headerValue(headers: RequestInit['headers'], key: string) {
  if (!headers) return '';
  if (headers instanceof Headers) return headers.get(key) ?? '';
  if (Array.isArray(headers)) {
    const found = headers.find(([k]) => k.toLowerCase() === key.toLowerCase());
    return found?.[1] ?? '';
  }
  return String((headers as Record<string, string | undefined>)[key] ?? (headers as Record<string, string | undefined>)[key.toLowerCase()] ?? '');
}

function isDownloadLike(url: string, init?: RequestInit) {
  const lower = url.toLowerCase();
  const accept = headerValue(init?.headers, 'accept').toLowerCase();
  return DOWNLOAD_WORDS.some((word) => lower.includes(word) || accept.includes(word));
}

function isInternalApi(url: string) {
  const parsed = normalizeUrl(url);
  if (!parsed) return url.startsWith(INTERNAL_API_PREFIX);
  return parsed.origin === window.location.origin && parsed.pathname.startsWith(INTERNAL_API_PREFIX);
}

function isAuthApi(url: string) {
  const parsed = normalizeUrl(url);
  const pathname = parsed ? parsed.pathname : url;
  return pathname.startsWith('/api/auth/');
}

async function readErrorMessage(response: Response) {
  try {
    const clone = response.clone();
    const contentType = clone.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = await clone.json();
      return json?.message || json?.error || json?.detail || `İşlem başarısız oldu. HTTP ${response.status}`;
    }
    const text = await clone.text();
    const safeText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return safeText.slice(0, 260) || `İşlem başarısız oldu. HTTP ${response.status}`;
  } catch {
    return `İşlem başarısız oldu. HTTP ${response.status}`;
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function emit(detail: AppToastPayload) {
  window.dispatchEvent(new CustomEvent<AppToastPayload>('app-toast', { detail }));
}

function operationLabels(downloadLike: boolean, mutating: boolean) {
  if (downloadLike) {
    return {
      loadingTitle: 'Dosya hazırlanıyor',
      loadingDescription: 'İndirme isteği işleniyor. Büyük raporlarda birkaç saniye sürebilir.',
      successTitle: 'Dosya hazır',
      successDescription: 'İndirme işlemi başlatıldı.',
      errorTitle: 'İndirme başarısız',
    };
  }

  if (mutating) {
    return {
      loadingTitle: 'İşlem yapılıyor',
      loadingDescription: 'Değişiklik kaydediliyor, lütfen bekle.',
      successTitle: 'İşlem tamamlandı',
      successDescription: 'Değişiklik başarıyla kaydedildi.',
      errorTitle: 'İşlem başarısız',
    };
  }

  return {
    loadingTitle: 'İşlem yapılıyor',
    loadingDescription: 'İstek işleniyor.',
    successTitle: 'İşlem tamamlandı',
    successDescription: 'İstek başarıyla tamamlandı.',
    errorTitle: 'Hata oluştu',
  };
}

export default function AppToaster() {
  const router = useRouter();
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    const clearToastTimer = (id: string) => {
      const timer = timers.current[id];
      if (timer) window.clearTimeout(timer);
      delete timers.current[id];
    };

    const scheduleDismiss = (id: string, duration: number) => {
      clearToastTimer(id);
      if (duration <= 0) return;
      timers.current[id] = window.setTimeout(() => {
        setItems((prev) => prev.filter((toast) => toast.id !== id));
        delete timers.current[id];
      }, duration);
    };

    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<AppToastPayload>).detail;
      if (!detail) return;
      const id = detail.id ?? makeToastId();

      if (detail.dismiss) {
        clearToastTimer(id);
        setItems((prev) => prev.filter((toast) => toast.id !== id));
        return;
      }

      if (!detail.title) return;

      const item: ToastItem = {
        id,
        type: detail.type ?? 'info',
        title: detail.title,
        description: detail.description,
        duration: detail.duration ?? (detail.type === 'loading' ? 0 : detail.type === 'error' ? 8000 : 4200),
      };

      setItems((prev) => {
        const exists = prev.some((toast) => toast.id === id);
        return exists ? prev.map((toast) => (toast.id === id ? item : toast)) : [...prev.slice(-(MAX_VISIBLE_TOASTS - 1)), item];
      });
      scheduleDismiss(id, item.duration);
    };

    window.addEventListener('app-toast', onToast);
    return () => {
      window.removeEventListener('app-toast', onToast);
      Object.values(timers.current).forEach((timer) => window.clearTimeout(timer));
      timers.current = {};
    };
  }, []);

  useEffect(() => {
    if (window.__paxFetchPatched) return;
    window.__paxFetchPatched = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = requestMethod(input, init);
      const url = requestUrl(input);
      const mutating = MUTATING_METHODS.has(method);
      const downloadLike = isDownloadLike(url, init);
      const toastSuppressed = headerValue(init?.headers, 'x-pax-toast').toLowerCase() === 'off';
      const shouldNotify = !toastSuppressed && isInternalApi(url) && !isAuthApi(url) && (mutating || downloadLike);
      const toastId = shouldNotify ? makeToastId(downloadLike ? 'download' : 'save') : '';
      const cacheKey = downloadLike ? '' : cacheKeyFor(input, init);
      if (cacheKey) {
        const cached = window.__paxFetchCache?.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return cloneFromCached(cached);
        if (cached) window.__paxFetchCache?.delete(cacheKey);
        const inflight = window.__paxFetchInflight?.get(cacheKey);
        if (inflight) return inflight.then(cloneFromCached);
      }
      const labels = operationLabels(downloadLike, mutating);

      try {
        if (mutating) clearApiCache();
        if (cacheKey) {
          const inflightMap = window.__paxFetchInflight ?? new Map<string, Promise<CachedFetchItem>>();
          window.__paxFetchInflight = inflightMap;
          const inflightCachePromise = originalFetch(input, init)
            .then((response) => materializeResponseForCache(cacheKey, response))
            .finally(() => inflightMap.delete(cacheKey));
          inflightMap.set(cacheKey, inflightCachePromise);
          const item = await inflightCachePromise;
          const responseForCaller = cloneFromCached(item);
          if (!responseForCaller.ok) {
            if (!toastSuppressed) {
              const message = await readErrorMessage(responseForCaller);
              emit({
                id: shouldNotify ? toastId : undefined,
                type: 'error',
                title: shouldNotify ? labels.errorTitle : 'Hata oluştu',
                description: message,
                duration: 9000,
              });
            }
            return cloneFromCached(item);
          }
          return responseForCaller;
        }

        const response = await originalFetch(input, init);
        if (!response.ok) {
          if (!toastSuppressed) {
            const message = await readErrorMessage(response);
            emit({
              id: shouldNotify ? toastId : undefined,
              type: 'error',
              title: shouldNotify ? labels.errorTitle : 'Hata oluştu',
              description: message,
              duration: 9000,
            });
          }
          return response;
        }

        if (mutating && isInternalApi(url)) {
          clearApiCache();
          window.dispatchEvent(new CustomEvent('pax:data-changed', { detail: { url, method } }));
          try { router.refresh(); } catch {}
        }

        if (shouldNotify) {
          emit({
            id: toastId,
            type: 'success',
            title: labels.successTitle,
            description: labels.successDescription,
            duration: 3800,
          });
        }
        return response;
      } catch (error) {
        if (!toastSuppressed && !isAbortError(error)) {
          const message = error instanceof Error ? error.message : 'Beklenmeyen bir bağlantı hatası oluştu.';
          emit({
            id: shouldNotify ? toastId : undefined,
            type: 'error',
            title: downloadLike ? 'İndirme başarısız' : 'Bağlantı hatası',
            description: message,
            duration: 9000,
          });
        }
        throw error;
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isAbortError(event.reason)) return;
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason || 'Beklenmeyen bir hata oluştu.');
      emit({ type: 'error', title: 'Beklenmeyen hata', description: message, duration: 9000 });
    };

    const onWindowError = (event: ErrorEvent) => {
      emit({ type: 'error', title: 'Sayfa hatası', description: event.message || 'Beklenmeyen bir hata oluştu.', duration: 9000 });
    };

    const onOffline = () => emit({ type: 'warning', title: 'Bağlantı koptu', description: 'İnternet bağlantısı yok. İşlemler kaydedilemeyebilir.', duration: 0 });
    const onOnline = () => emit({ type: 'success', title: 'Bağlantı geri geldi', description: 'Tekrar işlem yapabilirsin.', duration: 4200 });

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.fetch = originalFetch;
      window.__paxFetchPatched = false;
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [router]);

  if (!items.length) return null;

  return (
    <div className="app-toast-stack" aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div key={item.id} className={`app-toast app-toast-${item.type}`} role={item.type === 'error' ? 'alert' : 'status'}>
          <div className="app-toast-icon">{item.type === 'success' ? '✓' : item.type === 'error' ? '!' : item.type === 'warning' ? '!' : item.type === 'loading' ? '…' : 'i'}</div>
          <div className="app-toast-body">
            <strong>{item.title}</strong>
            {item.description ? <span>{item.description}</span> : null}
          </div>
          <button
            type="button"
            className="app-toast-close"
            aria-label="Bildirimi kapat"
            onClick={() => setItems((prev) => prev.filter((toast) => toast.id !== item.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
