import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUpstoxAuthUrl } from '@/lib/upstox-client';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/sign-in', request.url));

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/upstox/callback`;
  const authUrl = getUpstoxAuthUrl(redirectUri);
  return NextResponse.redirect(authUrl);
}
