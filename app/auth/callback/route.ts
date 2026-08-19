import { NextResponse, type NextRequest } from 'next/server';
import { createSession } from '@/lib/auth';
import { shouldUseSecureAuthCookie } from '@/lib/auth-cookie';
import { assertOidcRuntimeEnabled, redeemAuthorizationCode, resolveEnterpriseUser } from '@/lib/auth/oidc';
import { ApiError } from '@/lib/http/api-error';
import { getForwardedOrigin } from '@/lib/http/forwarded-origin';
import { recordAuditEvent, tryRecordAuditEvent } from '@/lib/audit';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';

export async function GET(request: NextRequest) {
  const origin = getForwardedOrigin(request);
  try {
    await assertOidcRuntimeEnabled();
    const error = request.nextUrl.searchParams.get('error');
    if (error) throw new ApiError('OIDC_PROVIDER_ERROR', 'Kurumsal giriş kimlik sağlayıcı tarafından reddedildi.', 401);
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const transactionCookie = request.cookies.get('crm_oidc_tx')?.value;
    if (!code || !state || !transactionCookie) throw new ApiError('OIDC_CALLBACK_INVALID', 'Kurumsal giriş yanıtı eksik.', 400);

    const { claims, next } = await redeemAuthorizationCode({ code, state, transactionCookie, origin });
    const user = await resolveEnterpriseUser(claims);
    const { sessionToken, expiresAt } = await createSession(user.id, 'active_directory', user.roles);
    await recordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'auth.oidc.succeeded', resourceType: 'user_session', resourceId: user.id, metadata: { provider: 'active_directory', role: user.role, appRoleClaims: user.appRoleClaims } });

    const response = NextResponse.redirect(new URL(next, origin));
    response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: shouldUseSecureAuthCookie(request),
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
      priority: 'high',
    });
    response.cookies.set('crm_oidc_tx', '', { path: '/auth/callback', expires: new Date(0), maxAge: 0 });
    return response;
  } catch (error) {
    const code = error instanceof ApiError ? error.code : 'OIDC_CALLBACK_FAILED';
    await tryRecordAuditEvent({
      action: 'auth.oidc.failed',
      resourceType: 'user_session',
      resourceId: code,
      metadata: { code },
    });
    const redirectUrl = new URL('/login', origin);
    redirectUrl.searchParams.set('error', code);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('crm_oidc_tx', '', { path: '/auth/callback', expires: new Date(0), maxAge: 0 });
    return response;
  }
}
