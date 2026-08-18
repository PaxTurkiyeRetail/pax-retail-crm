import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();
const GENERIC_MESSAGE = 'Giriş için email ve şifrenizi kullanabilirsiniz.';

export async function POST(req: Request) {
  try {
    const { email } = await parseJsonBody(req, schema);
    await enforceRateLimit({ request: req, action: 'auth.allow', identity: email, limit: 10, windowSeconds: 15 * 60 });
    return NextResponse.json(
      { ok: true, message: GENERIC_MESSAGE },
      { status: 202, headers: { Deprecation: 'true', Sunset: 'Sat, 31 Oct 2026 00:00:00 GMT' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'İşlem tamamlanamadı.');
  }
}
