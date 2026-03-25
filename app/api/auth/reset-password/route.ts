import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? '').trim();
    const password = String(body?.password ?? '');

    if (!token || !password) {
      return NextResponse.json({ error: 'Token ve yeni şifre zorunludur.' }, { status: 400 });
    }

    const tokenRes = await db.query(
      `
      select prt.id, prt.user_id, au.email
      from public.password_reset_tokens prt
      inner join public.allowed_users au on au.id = prt.user_id
      where prt.token = $1
        and prt.used_at is null
        and prt.expires_at > now()
      limit 1
      `,
      [token]
    );
    const row = tokenRes.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş bağlantı.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query('begin');
    try {
      await db.query(`update public.allowed_users set password_hash = $1 where id = $2`, [passwordHash, row.user_id]);
      await db.query(`update public.password_reset_tokens set used_at = now() where id = $1`, [row.id]);
      await db.query(`delete from public.user_sessions where user_id = $1`, [row.user_id]);
      await db.query('commit');
    } catch (err) {
      await db.query('rollback');
      throw err;
    }

    return NextResponse.json({ ok: true, email: row.email });
  } catch (error) {
    console.error('reset-password error', error);
    return NextResponse.json({ error: 'Şifre güncellenemedi.' }, { status: 500 });
  }
}
