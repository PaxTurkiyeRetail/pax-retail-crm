import { NextResponse } from 'next/server';
import { requireSystemParametersAccessOrThrow } from '@/lib/authz';
import { checkJiraIntegrationHealth } from '@/lib/jira-weekly-tickets';
import { apiErrorResponse } from '@/lib/http/api-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await requireSystemParametersAccessOrThrow();
    const health = await checkJiraIntegrationHealth();
    return NextResponse.json(health, {
      status: health.ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return apiErrorResponse(error, 'Jira bağlantısı kontrol edilemedi.');
  }
}
