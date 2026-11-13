'use client';

// Client-side helpers for the Zerodha (Kite) login popup.
//
// Kite access tokens expire every morning and can't be refreshed, so the daily
// reconnect has to be a fresh login. We open it in a popup so the dashboard
// stays put: if the user is still logged in to kite.zerodha.com the popup
// closes itself in about a second, otherwise they sign in inside the popup.
// If the popup is blocked we fall back to a full-page redirect that returns
// to the current page.

export const KITE_AUTH_CHANNEL = 'sova-kite-auth';
export const KITE_AUTH_STORAGE_KEY = 'sova-kite-auth-event';

export type KiteAuthStatus = 'success' | 'failed';

function currentPath(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('kite_auth');
  return url.pathname + url.search;
}

/**
 * Starts the Zerodha login. Returns true if a popup opened, false if we fell
 * back to redirecting the whole window (in which case the page is unloading).
 * `onClosed` fires when the popup is closed (for any reason).
 */
export function openKiteLogin(opts: { onClosed?: () => void } = {}): boolean {
  const ret = encodeURIComponent(currentPath());

  const w = 520;
  const h = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  const popup = window.open(
    `/api/auth/kite/login?mode=popup&return=${ret}`,
    'sova-kite-login',
    `popup=yes,width=${w},height=${h},left=${left},top=${top}`,
  );

  if (!popup) {
    window.location.href = `/api/auth/kite/login?return=${ret}`;
    return false;
  }

  popup.focus();
  if (opts.onClosed) {
    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        opts.onClosed?.();
      }
    }, 500);
  }
  return true;
}

/**
 * Calls `cb` when the login popup reports a result. The popup page broadcasts
 * over BroadcastChannel, localStorage and postMessage because a cross-site
 * round trip can sever window.opener; we listen on all three and de-duplicate.
 */
export function subscribeKiteAuth(cb: (status: KiteAuthStatus) => void): () => void {
  let lastFired = 0;
  const fire = (status: unknown) => {
    if (status !== 'success' && status !== 'failed') return;
    const now = Date.now();
    if (now - lastFired < 3000) return;
    lastFired = now;
    cb(status);
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(KITE_AUTH_CHANNEL);
    channel.onmessage = (e) => fire(e.data?.status);
  } catch {}

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.data?.type !== 'sova-kite-auth') return;
    fire(e.data.status);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KITE_AUTH_STORAGE_KEY || !e.newValue) return;
    try { fire(JSON.parse(e.newValue).status); } catch {}
  };

  window.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);
  return () => {
    channel?.close();
    window.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
  };
}
