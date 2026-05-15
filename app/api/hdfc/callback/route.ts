import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { saveHdfcSession } from '@/lib/hdfc-client';

// HDFC Securities OAuth callback.
// After the user authenticates on HDFC's portal, they are redirected here with
// either ?request_token=, ?code=, or ?token= depending on their API version.
// If HDFC provides the access token directly in the callback, the exchange step is skipped.
export async function GET(req: Request) {
  const session = await getSession();
  const base = process.env.NEXT_PUBLIC_BASE_URL!;

  if (!session) return NextResponse.redirect(`${base}/sign-in`);

  const { searchParams } = new URL(req.url);

  // HDFC may use different param names — check all common ones
  const directToken = searchParams.get('token') ?? searchParams.get('access_token');
  const requestToken = searchParams.get('request_token') ?? searchParams.get('code');

  if (!directToken && !requestToken) {
    console.error('[HDFC Callback] No token or code in callback params:', Object.fromEntries(searchParams));
    return NextResponse.redirect(`${base}/home?hdfc_auth=failed`);
  }

  try {
    let accessToken: string;

    if (directToken) {
      // HDFC gave us the final token directly — no exchange needed
      accessToken = directToken;
    } else {
      // Exchange request_token / code for a session token
      const apiKey = process.env.HDFC_API_KEY!;
      const apiSecret = process.env.HDFC_API_SECRET!;
      const apiBase = process.env.HDFC_API_BASE_URL!;

      const res = await fetch(`${apiBase}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, request_token: requestToken }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[HDFC Callback] Token exchange failed:', err);
        return NextResponse.redirect(`${base}/home?hdfc_auth=failed`);
      }

      const data = await res.json();
      accessToken = data.access_token ?? data.session_token ?? data.token;
      if (!accessToken) {
        console.error('[HDFC Callback] No access token in exchange response:', data);
        return NextResponse.redirect(`${base}/home?hdfc_auth=failed`);
      }
    }

    await saveHdfcSession(session.userId, accessToken);
    return NextResponse.redirect(`${base}/home?hdfc_auth=success`);
  } catch (err) {
    console.error('[HDFC Callback]', err);
    return NextResponse.redirect(`${base}/home?hdfc_auth=failed`);
  }
}
