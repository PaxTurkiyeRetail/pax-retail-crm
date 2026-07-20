import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApplicationOrigin, sendPasswordResetEmail } from '@/lib/auth/password-reset-mail';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESET_TTL_MINUTES = Number(process.env.AUTH_RESET_TTL_MINUTES ?? '30');
const GENERIC_MESSAGE = 'Eğer kullanıcı mevcutsa şifre sıfırlama bağlantısı oluşturuldu.';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Email zorunludur.' }, { status: 400 });

    const userRes = await db.query(
      'select id, email, is_active from public.allowed_users where lower(email) = $1 limit 1',
      [email]
    );
    const user = userRes.rows[0];

    // Kullanıcının varlığını yanıttan ayırt ettirmiyoruz.
    if (!user || !user.is_active) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query(
        'update public.password_reset_tokens set used_at = now() where user_id = $1 and used_at is null',
        [user.id]
      );
      await client.query(
        'insert into public.password_reset_tokens (user_id, token, expires_at) values ($1, $2, $3)',
        [user.id, token, expiresAt]
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const origin = getApplicationOrigin(req.url);
    const resetUrl = `${origin}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail({ email: user.email, resetUrl, expiresInMinutes: RESET_TTL_MINUTES });
    } catch (error) {
      await db.query('update public.password_reset_tokens set used_at = now() where token = $1', [token]).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({
      ok: true,
      message: GENERIC_MESSAGE,
      resetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
    });
  } catch (error) {
    console.error('forgot-password error', error);
    return NextResponse.json({ error: 'İşlem başarısız.' }, { status: 500 });
  }
}
