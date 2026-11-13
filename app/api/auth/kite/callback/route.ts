import { NextRequest, NextResponse } from 'next/server';
import { createKiteClient, saveSession } from '@/lib/kite-client';
import { getSession } from '@/lib/session';
import { KITE_CTX_COOKIE, parseKiteLoginContext, type KiteLoginContext } from '@/lib/kite-login-context';

type Outcome = 'success' | 'failed';

// Popup mode: tell the opener window (several channels, since cross-site
// navigation can sever window.opener) and close ourselves. If the window can't
// close, the visible message tells the user they can.
function popupResponse(outcome: Outcome): NextResponse {
  const ok = outcome === 'success';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>SOVA — Zerodha</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;background:#0d1322;color:#dde1f7;font-family:Manrope,system-ui,sans-serif}
  main{text-align:center;padding:24px}
  h1{font-size:15px;margin:0 0 6px;color:${ok ? '#4edea3' : '#ffb2b7'}}
  p{font-size:12px;margin:0;color:#8c909f}
</style></head>
<body><main>
  <h1>${ok ? 'Zerodha connected' : 'Connection failed'}</h1>
  <p>${ok ? 'You can close this window.' : 'Close this window and try again from SOVA.'}</p>
</main>
<script>
(function () {
  var msg = { type: 'sova-kite-auth', status: '${outcome}' };
  try { var bc = new BroadcastChannel('sova-kite-auth'); bc.postMessage(msg); bc.close(); } catch (e) {}
  try { localStorage.setItem('sova-kite-auth-event', JSON.stringify({ status: msg.status, t: Date.now() })); } catch (e) {}
  try { if (window.opener) window.opener.postMessage(msg, location.origin); } catch (e) {}
  setTimeout(function () { try { window.close(); } catch (e) {} }, ${ok ? 500 : 2500});
})();
</script></body></html>`;
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function finish(request: NextRequest, ctx: KiteLoginContext, outcome: Outcome): NextResponse {
  let res: NextResponse;
  if (ctx.mode === 'popup') {
    res = popupResponse(outcome);
  } else {
    const url = new URL(ctx.returnTo, request.url);
    url.searchParams.set('kite_auth', outcome);
    res = NextResponse.redirect(url);
  }
  res.cookies.delete({ name: KITE_CTX_COOKIE, path: '/api/auth/kite' });
  return res;
}

export async function GET(request: NextRequest) {
  const ctx = parseKiteLoginContext(request.cookies.get(KITE_CTX_COOKIE)?.value);
  const { searchParams } = new URL(request.url);
  const requestToken = searchParams.get('request_token');
  const status = searchParams.get('status');

  if (status !== 'success' || !requestToken) {
    return finish(request, ctx, 'failed');
  }

  try {
    const session = await getSession();
    if (!session?.userId) {
      // Not signed in to SOVA — a popup can't fix that, so a full-page redirect is the only sensible outcome.
      return NextResponse.redirect(new URL('/sign-in?kite_auth=failed', request.url));
    }

    const kc = createKiteClient();
    const kiteSession = await kc.generateSession(requestToken, process.env.KITE_API_SECRET!);
    const encToken: string = kiteSession.enc_token ?? kiteSession.access_token;
    await saveSession(session.userId, kiteSession.access_token, encToken);
    return finish(request, ctx, 'success');
  } catch (err) {
    console.error('[Kite Auth] Session generation failed:', err);
    return finish(request, ctx, 'failed');
  }
}
