import { NextRequest, NextResponse } from 'next/server';
import { createKiteClient } from '@/lib/kite-client';
import { KITE_CTX_COOKIE, safeReturnPath, type KiteLoginContext } from '@/lib/kite-login-context';

export const dynamic = 'force-dynamic';

// GET /api/auth/kite/login?mode=popup&return=/dashboard
//   mode   — "popup" closes itself after login and tells the opener window;
//            anything else does a full-page redirect back to `return`.
//   return — same-site path to land on after a full-page login (default /home).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ctx: KiteLoginContext = {
    mode: searchParams.get('mode') === 'popup' ? 'popup' : 'redirect',
    returnTo: safeReturnPath(searchParams.get('return')),
  };

  const kc = createKiteClient();
  const res = NextResponse.redirect(kc.getLoginURL());
  res.cookies.set(KITE_CTX_COOKIE, JSON.stringify(ctx), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // must survive the top-level redirect back from kite.zerodha.com
    path: '/api/auth/kite',
    maxAge: 600,
  });
  return res;
}
