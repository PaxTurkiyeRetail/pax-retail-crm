import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/crm';
  const redirectTo = next.startsWith('/') ? next : '/crm';
  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
