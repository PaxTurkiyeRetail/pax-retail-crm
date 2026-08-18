import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, verifyUserCredentials } from '@/lib/auth';
import { shouldUseSecureAuthCookie } from '@/lib/auth-cookie';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { clearRateLimit, enforceRateLimit } from '@/lib/security/rate-limit';
import { tryRecordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
}).strict();

function identityHash(email: string) {
  return crypto.createHash('sha256').update(email).digest('hex');
}

export async function POST(req: Request) {
  try {
    if (process.env.AUTH_LOCAL_LOGIN_ENABLED === 'false') {
      throw new ApiError('LOCAL_LOGIN_DISABLED', 'Parola ile giriş devre dışı; kurumsal hesabınızı kullanın.', 403);
    }
    const { email, password } = await parseJsonBody(req, loginSchema);
    await enforceRateLimit({ request: req, action: 'auth.login', identity: email, limit: 5, windowSeconds: 15 * 60 });

    const user = await verifyUserCredentials(email, password);
    if (!user) {
      await tryRecordAuditEvent({
        action: 'auth.login.failed',
        resourceType: 'auth_identity',
        resourceId: identityHash(email),
      });
      throw new ApiError('INVALID_CREDENTIALS', 'Geçersiz e-posta veya şifre.', 401);
    }

    const { sessionToken, expiresAt } = await createSession(user.id);
    await clearRateLimit({ request: req, action: 'auth.login', identity: email });
    await tryRecordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login.succeeded',
      resourceType: 'user_session',
      resourceId: user.id,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: shouldUseSecureAuthCookie(req),
      expires: expiresAt,
      path: '/',
      priority: 'high',
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error, 'Giriş sırasında hata oluştu.');
  }
}
