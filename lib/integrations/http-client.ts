import 'server-only';

export type ExternalJsonResult<T = unknown> = {
  ok: boolean;
  status: number;
  json: T | null;
  text: string;
  attempts: number;
  durationMs: number;
};

type ExternalJsonRequest = {
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  retries?: number;
  retryable?: boolean;
};

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export async function externalJsonRequest<T = unknown>(request: ExternalJsonRequest): Promise<ExternalJsonResult<T>> {
  const startedAt = Date.now();
  const maxAttempts = Math.max(1, Math.min(3, (request.retries ?? 1) + 1));
  let last: ExternalJsonResult<T> = { ok: false, status: 0, json: null, text: 'Bağlantı kurulamadı.', attempts: 0, durationMs: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(request.url, {
        ...request.init,
        signal: request.init?.signal ?? AbortSignal.timeout(request.timeoutMs ?? 15_000),
        cache: 'no-store',
      });
      const text = await response.text().catch(() => '');
      let json: T | null = null;
      try { json = text ? JSON.parse(text) as T : null; } catch { json = null; }
      last = { ok: response.ok, status: response.status, json, text, attempts: attempt, durationMs: Date.now() - startedAt };
      if (response.ok || !request.retryable || !RETRYABLE_STATUS.has(response.status) || attempt === maxAttempts) return last;
    } catch (error) {
      last = {
        ok: false,
        status: 0,
        json: null,
        text: error instanceof Error ? error.message : 'Bağlantı hatası',
        attempts: attempt,
        durationMs: Date.now() - startedAt,
      };
      if (!request.retryable || attempt === maxAttempts) return last;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(250 * (2 ** (attempt - 1)), 1_000)));
  }
  return last;
}
