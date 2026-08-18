import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getTokenHashSupport, hashOpaqueToken } from '@/lib/auth';
import { getApplicationOrigin, sendPasswordResetEmail } from '@/lib/auth/password-reset-mail';
import { apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { tryRecordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESET_TTL_MINUTES = Math.min(60, Math.max(10, Number(process.env.AUTH_RESET_TTL_MINUTES ?? '30')));
const GENERIC_MESSAGE = 'Eğer kullanıcı mevcutsa şifre sıfırlama bağlantısı gönderildi.';
const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();

export async function POST(req: Request) {
  try {
    const { email } = await parseJsonBody(req, schema);
    await enforceRateLimit({ request: req, action: 'auth.forgot-password', identity: email, limit: 3, windowSeconds: 60 * 60 });

    const userRes = await db.query(
      'select id, email, is_active from public.allowed_users where lower(email) = $1 limit 1',
      [email],
    );
    const user = userRes.rows[0];
    if (!user || !user.is_active) return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashOpaqueToken(token);
    const support = await getTokenHashSupport();
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query(
        'update public.password_reset_tokens set used_at = now() where user_id = $1 and used_at is null',
        [user.id],
      );
      if (support.passwordResets) {
        await client.query(
          'insert into public.password_reset_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)',
          [user.id, tokenHash, expiresAt],
        );
      } else {
        await client.query(
          'insert into public.password_reset_tokens (user_id, token, expires_at) values ($1, $2, $3)',
          [user.id, token, expiresAt],
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const resetUrl = `${getApplicationOrigin(req.url)}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail({ email: user.email, resetUrl, expiresInMinutes: RESET_TTL_MINUTES });
    } catch (error) {
      const column = support.passwordResets ? 'token_hash' : 'token';
      const value = support.passwordResets ? tokenHash : token;
      await db.query(`update public.password_reset_tokens set used_at = now() where ${column} = $1`, [value]).catch(() => undefined);
      throw error;
    }

    await tryRecordAuditEvent({
      actorId: String(user.id),
      actorEmail: String(user.email),
      action: 'auth.password-reset.requested',
      resourceType: 'user',
      resourceId: String(user.id),
    });

    return NextResponse.json({
      ok: true,
      message: GENERIC_MESSAGE,
      resetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
    });
  } catch (error) {
    return apiErrorResponse(error, 'Şifre sıfırlama işlemi tamamlanamadı.');
  }
}
