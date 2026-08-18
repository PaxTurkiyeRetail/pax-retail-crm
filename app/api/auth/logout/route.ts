import { NextResponse, type NextRequest } from 'next/server';
import { deleteSession, getUserBySessionToken } from '@/lib/auth';
import { shouldUseSecureAuthCookie } from '@/lib/auth-cookie';
import { apiErrorResponse } from '@/lib/http/api-error';
import { tryRecordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (sessionToken) {
      const user = await getUserBySessionToken(sessionToken);
      await deleteSession(sessionToken);
      if (user) {
        await tryRecordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'auth.logout', resourceType: 'user_session', resourceId: user.id });
      }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: shouldUseSecureAuthCookie(req),
      expires: new Date(0),
      maxAge: 0,
      path: '/',
      priority: 'high',
    });

    return response;
  } catch (error) {
    return apiErrorResponse(error, 'Çıkış sırasında hata oluştu.');
  }
}
