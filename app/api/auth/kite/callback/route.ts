import { NextRequest, NextResponse } from 'next/server';
import { createKiteClient, saveSession } from '@/lib/kite-client';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestToken = searchParams.get('request_token');
  const status = searchParams.get('status');

  if (status !== 'success' || !requestToken) {
    return NextResponse.redirect(new URL('/?kite_auth=failed', request.url));
  }

  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.redirect(new URL('/login?kite_auth=failed', request.url));
    }

    const kc = createKiteClient();
    const kiteSession = await kc.generateSession(requestToken, process.env.KITE_API_SECRET!);
    const encToken: string = kiteSession.enc_token ?? kiteSession.access_token;
    await saveSession(session.userId, kiteSession.access_token, encToken);
    return NextResponse.redirect(new URL('/?kite_auth=success', request.url));
  } catch (err) {
    console.error('[Kite Auth] Session generation failed:', err);
    return NextResponse.redirect(new URL('/?kite_auth=failed', request.url));
  }
}
