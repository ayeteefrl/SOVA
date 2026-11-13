// Server-side helpers for carrying "where to go after Kite login" across the
// round trip to kite.zerodha.com. The redirect URL registered with Kite is fixed,
// so the context rides in a short-lived httpOnly cookie instead of the URL.

export const KITE_CTX_COOKIE = 'kite_login_ctx';

export interface KiteLoginContext {
  mode: 'popup' | 'redirect';
  returnTo: string;
}

/** Only allow same-site relative paths — blocks open redirects like "//evil.com". */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/home';
  if (raw.startsWith('/api/')) return '/home';
  return raw;
}

export function parseKiteLoginContext(raw: string | undefined): KiteLoginContext {
  try {
    const parsed = JSON.parse(raw ?? '');
    return {
      mode: parsed?.mode === 'popup' ? 'popup' : 'redirect',
      returnTo: safeReturnPath(parsed?.returnTo),
    };
  } catch {
    return { mode: 'redirect', returnTo: '/home' };
  }
}
