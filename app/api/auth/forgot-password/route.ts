import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const RESET_TTL_MINUTES = Number(process.env.AUTH_RESET_TTL_MINUTES ?? '30');

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Email zorunludur.' }, { status: 400 });

    const userRes = await db.query(
      `select id, email, is_active from public.allowed_users where lower(email) = $1 limit 1`,
      [email]
    );
    const user = userRes.rows[0];

    // Always return success-like response to avoid email enumeration.
    if (!user || !user.is_active) {
      return NextResponse.json({ ok: true, message: 'Eğer kullanıcı mevcutsa şifre sıfırlama bağlantısı oluşturuldu.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    await db.query(
      `insert into public.password_reset_tokens (user_id, token, expires_at) values ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    const origin = new URL(req.url).origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    console.log(`[AUTH] Password reset link for ${user.email}: ${resetUrl}`);

    return NextResponse.json({
      ok: true,
      message: 'Şifre sıfırlama bağlantısı oluşturuldu.',
      resetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
    });
  } catch (error) {
    console.error('forgot-password error', error);
    return NextResponse.json({ error: 'İşlem başarısız.' }, { status: 500 });
  }
}
