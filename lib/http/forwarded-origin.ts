import type { NextRequest } from 'next/server';

const PROTO_RE = /^https?$/i;
const HOST_RE = /^[a-zA-Z0-9.-]+(:\d+)?$/;

function firstValue(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const value = headerValue.split(',')[0]?.trim();
  return value || null;
}

/**
 * Nginx arkasında güvenilir dış origin üretir.
 * x-forwarded-proto / x-forwarded-host'a bakar, yoksa request.url'e düşer.
 * Dönüş: "scheme://host[:port]" (sondan slash yok).
 */
export function getForwardedOrigin(request: NextRequest): string {
  const rawProto = firstValue(request.headers.get('x-forwarded-proto'));
  const rawHost = firstValue(request.headers.get('x-forwarded-host'));

  const proto = rawProto && PROTO_RE.test(rawProto) ? rawProto.toLowerCase() : null;
  const host = rawHost && HOST_RE.test(rawHost) ? rawHost : null;

  if (proto && host) {
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}
