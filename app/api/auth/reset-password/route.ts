import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? '').trim();
    const password = String(body?.password ?? '');

    if (!token || !password) {
      return NextResponse.json({ error: 'Token ve yeni şifre zorunludur.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Yeni şifre en az 8 karakter olmalıdır.' }, { status: 400 });
    }

    const client = await db.connect();
    try {
      await client.query('begin');

      const tokenRes = await client.query(
        `
        select prt.id, prt.user_id, au.email
        from public.password_reset_tokens prt
        inner join public.allowed_users au on au.id = prt.user_id
        where prt.token = $1
          and prt.used_at is null
          and prt.expires_at > now()
          and au.is_active = true
        limit 1
        for update of prt
        `,
        [token]
      );

      const row = tokenRes.rows[0];
      if (!row) {
        await client.query('rollback');
        return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş bağlantı.' }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await client.query('update public.allowed_users set password_hash = $1 where id = $2', [passwordHash, row.user_id]);
      await client.query('update public.password_reset_tokens set used_at = now() where user_id = $1 and used_at is null', [row.user_id]);
      await client.query('delete from public.user_sessions where user_id = $1', [row.user_id]);
      await client.query('commit');

      return NextResponse.json({ ok: true, email: row.email });
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('reset-password error', error);
    return NextResponse.json({ error: 'Şifre güncellenemedi.' }, { status: 500 });
  }
}
