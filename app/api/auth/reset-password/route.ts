import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getTokenHashSupport, hashOpaqueToken } from '@/lib/auth';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { recordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const schema = z.object({
  token: z.string().trim().min(32).max(256),
  password: z.string().min(12, 'Yeni şifre en az 12 karakter olmalıdır.').max(128),
}).strict();

export async function POST(req: Request) {
  try {
    const { token, password } = await parseJsonBody(req, schema);
    const tokenHash = hashOpaqueToken(token);
    await enforceRateLimit({ request: req, action: 'auth.reset-password', identity: tokenHash, limit: 5, windowSeconds: 60 * 60 });
    const support = await getTokenHashSupport();

    const client = await db.connect();
    try {
      await client.query('begin');
      const lookupColumn = support.passwordResets ? 'prt.token_hash' : 'prt.token';
      const lookupValue = support.passwordResets ? tokenHash : token;
      const tokenRes = await client.query(
        `
          select prt.id, prt.user_id, au.email
          from public.password_reset_tokens prt
          inner join public.allowed_users au on au.id = prt.user_id
          where ${lookupColumn} = $1
            and prt.used_at is null
            and prt.expires_at > now()
            and au.is_active = true
          limit 1
          for update of prt
        `,
        [lookupValue],
      );

      const row = tokenRes.rows[0];
      if (!row) throw new ApiError('RESET_TOKEN_INVALID', 'Geçersiz veya süresi dolmuş bağlantı.', 400);

      const passwordHash = await bcrypt.hash(password, 12);
      await client.query('update public.allowed_users set password_hash = $1 where id = $2', [passwordHash, row.user_id]);
      await client.query('update public.password_reset_tokens set used_at = now() where user_id = $1 and used_at is null', [row.user_id]);
      await client.query('delete from public.user_sessions where user_id = $1', [row.user_id]);
      await recordAuditEvent({
        actorId: String(row.user_id),
        actorEmail: String(row.email),
        action: 'auth.password-reset.completed',
        resourceType: 'user',
        resourceId: String(row.user_id),
      }, client);
      await client.query('commit');
      return NextResponse.json({ ok: true });
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiErrorResponse(error, 'Şifre güncellenemedi.');
  }
}
