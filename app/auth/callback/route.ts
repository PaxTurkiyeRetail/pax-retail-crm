import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/crm';
  const isSafeRelativePath = next.startsWith('/') && !next.startsWith('//') && !next.includes('\\');
  const redirectTo = isSafeRelativePath ? next : '/crm';
  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
