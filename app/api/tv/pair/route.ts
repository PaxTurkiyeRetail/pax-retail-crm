import { NextResponse } from 'next/server';
import { shouldUseSecureAuthCookie } from '@/lib/auth-cookie';
import {
  TV_COOKIE_MAX_AGE,
  TV_COOKIE_NAME,
  findDeviceByToken,
  getTvTokenFromCookies,
  newDeviceToken,
  startPairing,
} from '@/lib/tv-devices';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// TV eşleştirme (public, kullanıcı oturumu gerekmez).
// GET: cihaz durumu (none | pending | active | revoked). POST: kod üret (cihaz yoksa oluştur + cookie).
export async function GET() {
  try {
    const token = await getTvTokenFromCookies();
    const device = token ? await findDeviceByToken(token) : null;
    const status = !device ? 'none' : device.revoked_at ? 'revoked' : device.approved_at ? 'active' : 'pending';
    return NextResponse.json({ status, name: device?.approved_at ? device.name : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Durum alınamadı.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let token = await getTvTokenFromCookies();
    // İptal edilmiş cihaz yeniden eşleştirme ister: yeni token + yeni kod.
    if (token && (await findDeviceByToken(token))?.revoked_at) token = null;
    const isNew = !token;
    token ??= newDeviceToken();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const userAgent = req.headers.get('user-agent')?.slice(0, 300) || null;
    const { device, code, expiresAt } = await startPairing(token, { ip, userAgent });
    const status = device.revoked_at ? 'revoked' : device.approved_at ? 'active' : 'pending';
    const res = NextResponse.json({ status, code, expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
    if (isNew) {
      res.cookies.set(TV_COOKIE_NAME, token, {
        httpOnly: true,
        secure: shouldUseSecureAuthCookie(req),
        sameSite: 'lax',
        maxAge: TV_COOKIE_MAX_AGE,
        path: '/',
      });
    }
    return res;
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Kod üretilemedi.' }, { status: 500 });
  }
}
