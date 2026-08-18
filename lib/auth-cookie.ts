const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export function shouldUseSecureAuthCookie(req: Request) {
  const envValue = String(process.env.AUTH_COOKIE_SECURE ?? '').trim().toLowerCase();

  if (TRUE_VALUES.has(envValue)) return true;
  // Mevcut şirket içi kurulum doğrudan HTTP üzerinde çalışabiliyor. Operasyon
  // açıkça false verdiyse production ortamında da bu tercihe saygı duyulur.
  // HTTPS'e geçildiğinde AUTH_COOKIE_SECURE=true zorunlu tutulmalıdır.
  if (FALSE_VALUES.has(envValue)) return false;

  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (forwardedProto === 'https') return true;
  if (forwardedProto === 'http') return false;

  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}
