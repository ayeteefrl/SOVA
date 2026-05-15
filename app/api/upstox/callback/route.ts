import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { exchangeUpstoxToken, saveUpstoxSession } from '@/lib/upstox-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/home?upstox_auth=failed', request.url));
  }

  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.redirect(new URL('/sign-in?upstox_auth=failed', request.url));
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/upstox/callback`;
    const accessToken = await exchangeUpstoxToken(code, redirectUri);
    await saveUpstoxSession(session.userId, accessToken);
    return NextResponse.redirect(new URL('/home?upstox_auth=success', request.url));
  } catch (err) {
    console.error('[Upstox Auth]', err);
    return NextResponse.redirect(new URL('/home?upstox_auth=failed', request.url));
  }
}
