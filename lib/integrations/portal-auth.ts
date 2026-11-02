import { createHmac, timingSafeEqual } from 'node:crypto';

// PAX Portal → CRM makine çağrıları. AD oturumu yok; HMAC imzası ile doğrulanır.
// İmzalanan metin:
//   GET:  `${timestamp}.GET.${pathname}?${search}`; search boşsa '?' sonrası boş kalır.
//   POST: `${timestamp}.POST.${pathname}.${rawBody}`; gövde parse edilmeden önce doğrulanır.
export const PORTAL_SIGNATURE_WINDOW_SECONDS = 300;

export type PortalAuthResult = { ok: true } | { ok: false; status: 401 | 503 };

export function portalSigningText(timestamp: string, method: string, url: URL, rawBody?: string) {
  const verb = method.toUpperCase();
  if (verb === 'GET') return `${timestamp}.GET.${url.pathname}?${url.search.replace(/^\?/, '')}`;
  return `${timestamp}.${verb}.${url.pathname}.${rawBody ?? ''}`;
}

export function signPortalRequest(secret: string, text: string) {
  return createHmac('sha256', secret).update(text).digest('hex');
}

export function verifyPortalRequest(
  request: Request,
  secret: string | undefined = process.env.PAX_CRM_SHARED_SECRET,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  rawBody?: string,
): PortalAuthResult {
  if (!secret) return { ok: false, status: 503 };
  const timestamp = request.headers.get('x-pax-timestamp') ?? '';
  const signature = request.headers.get('x-pax-signature') ?? '';
  if (!/^\d{1,12}$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) return { ok: false, status: 401 };
  if (Math.abs(nowSeconds - Number(timestamp)) > PORTAL_SIGNATURE_WINDOW_SECONDS) return { ok: false, status: 401 };
  const expected = Buffer.from(signPortalRequest(secret, portalSigningText(timestamp, request.method, new URL(request.url), rawBody)), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given) ? { ok: true } : { ok: false, status: 401 };
}
