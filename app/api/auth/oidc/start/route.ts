import { NextResponse, type NextRequest } from 'next/server';
import { assertOidcRuntimeEnabled, createAuthorizationRequest } from '@/lib/auth/oidc';
import { apiErrorResponse } from '@/lib/http/api-error';
import { getForwardedOrigin } from '@/lib/http/forwarded-origin';
import { shouldUseSecureAuthCookie } from '@/lib/auth-cookie';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit({ request, action: 'auth.oidc.start', limit: 20, windowSeconds: 15 * 60 });
    await assertOidcRuntimeEnabled();
    const origin = getForwardedOrigin(request);
    const authorization = await createAuthorizationRequest(origin, request.nextUrl.searchParams.get('next'));
    const response = NextResponse.redirect(authorization.url);
    response.cookies.set('crm_oidc_tx', authorization.transaction, {
      httpOnly: true,
      secure: shouldUseSecureAuthCookie(request),
      sameSite: 'lax',
      path: '/auth/callback',
      maxAge: 10 * 60,
      priority: 'high',
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error, 'Kurumsal giriş başlatılamadı.');
  }
}
