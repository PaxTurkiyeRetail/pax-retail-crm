import 'server-only';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/http/api-error';

type RateLimitArgs = {
  request: Request;
  action: string;
  identity?: string | null;
  limit: number;
  windowSeconds: number;
};

type MemoryEntry = { attempts: number; expiresAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __crmRateLimitMemory: Map<string, MemoryEntry> | undefined;
}

const memoryStore = global.__crmRateLimitMemory ?? new Map<string, MemoryEntry>();
if (process.env.NODE_ENV !== 'production') global.__crmRateLimitMemory = memoryStore;

function requestIp(request: Request) {
  if (process.env.TRUST_PROXY_HEADERS === 'true') {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      'unknown'
    );
  }
  return 'direct';
}

function normalizedIdentity(identity: string | null | undefined) {
  return String(identity ?? 'anonymous').trim().toLocaleLowerCase('tr-TR').slice(0, 254);
}

function rateKey(args: RateLimitArgs) {
  return crypto
    .createHash('sha256')
    .update(`${args.action}|${normalizedIdentity(args.identity)}|${requestIp(args.request)}`)
    .digest('hex');
}

function checkMemory(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const current = memoryStore.get(key);
  const entry = !current || current.expiresAt <= now
    ? { attempts: 1, expiresAt: now + windowSeconds * 1000 }
    : { attempts: current.attempts + 1, expiresAt: current.expiresAt };
  memoryStore.set(key, entry);

  if (memoryStore.size > 5_000) {
    for (const [candidate, value] of memoryStore) {
      if (value.expiresAt <= now) memoryStore.delete(candidate);
    }
  }

  return { allowed: entry.attempts <= limit, retryAfter: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)) };
}

function isMissingRateLimitTable(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === '42P01' || /auth_rate_limits.*does not exist/i.test(candidate?.message ?? '');
}

export async function enforceRateLimit(args: RateLimitArgs) {
  const keyHash = rateKey(args);
  const windowStartMs = Math.floor(Date.now() / (args.windowSeconds * 1000)) * args.windowSeconds * 1000;
  const windowStart = new Date(windowStartMs);

  try {
    const result = await db.query<{ attempts: number; retry_after: number }>(
      `
        with cleaned as (
          delete from public.auth_rate_limits
          where ctid in (select ctid from public.auth_rate_limits where expires_at < now() limit 100)
        ), upserted as (
          insert into public.auth_rate_limits (key_hash, action, window_start, attempts, expires_at)
          values ($1, $2, $3, 1, $3::timestamptz + ($4 * interval '1 second'))
          on conflict (key_hash, action, window_start)
          do update set attempts = public.auth_rate_limits.attempts + 1, updated_at = now()
          returning attempts, expires_at
        )
        select attempts,
          greatest(1, ceil(extract(epoch from (expires_at - now()))))::integer as retry_after
        from upserted
      `,
      [keyHash, args.action, windowStart, args.windowSeconds],
    );
    const row = result.rows[0];
    if (Number(row?.attempts ?? 0) > args.limit) {
      throw new ApiError('RATE_LIMITED', 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.', 429, {
        retryAfter: Number(row?.retry_after ?? args.windowSeconds),
      });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (!isMissingRateLimitTable(error)) throw error;

    const fallbackAllowed = process.env.NODE_ENV !== 'production' || process.env.AUTH_RATE_LIMIT_MEMORY_FALLBACK === 'true';
    if (!fallbackAllowed) {
      throw new ApiError('SECURITY_MIGRATION_REQUIRED', 'Güvenlik altyapısı henüz hazırlanmadı.', 503);
    }

    const result = checkMemory(keyHash, args.limit, args.windowSeconds);
    if (!result.allowed) {
      throw new ApiError('RATE_LIMITED', 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.', 429, {
        retryAfter: result.retryAfter,
      });
    }
  }
}

export async function clearRateLimit(args: Pick<RateLimitArgs, 'request' | 'action' | 'identity'>) {
  const keyHash = rateKey({ ...args, limit: 1, windowSeconds: 1 });
  memoryStore.delete(keyHash);
  await db.query('delete from public.auth_rate_limits where key_hash = $1 and action = $2', [keyHash, args.action]).catch(() => undefined);
}
