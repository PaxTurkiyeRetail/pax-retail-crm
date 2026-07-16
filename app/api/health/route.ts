import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();

  try {
    await db.query('select 1');
    return NextResponse.json(
      {
        ok: true,
        service: 'pax-retail-crm',
        database: 'connected',
        responseMs: Date.now() - startedAt,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('health_check_failed', error);
    return NextResponse.json(
      {
        ok: false,
        service: 'pax-retail-crm',
        database: 'unavailable',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
