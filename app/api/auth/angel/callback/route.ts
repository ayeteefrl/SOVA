import { NextRequest, NextResponse } from 'next/server';
import { saveAngelSession } from '@/lib/angel-client';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Angel One publisher login returns auth_token directly in the callback URL
  const authToken    = searchParams.get('auth_token');
  const refreshToken = searchParams.get('refresh_token') ?? '';

  if (!authToken) {
    return NextResponse.redirect(new URL('/?angel_auth=failed', request.url));
  }

  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.redirect(new URL('/login?angel_auth=failed', request.url));
    }

    await saveAngelSession(session.userId, authToken, refreshToken);
    return NextResponse.redirect(new URL('/?angel_auth=success', request.url));
  } catch (err) {
    console.error('[Angel Auth] Callback failed:', err);
    return NextResponse.redirect(new URL('/?angel_auth=failed', request.url));
  }
}
