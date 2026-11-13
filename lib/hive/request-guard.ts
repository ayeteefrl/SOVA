// Extra protection for Chart Hive's mutating routes. SOVA's other routes rely on the session cookie being
// SameSite=Lax; these also refuse requests that a browser marks as coming from another site, and require JSON
// bodies (a cross-site form can't send application/json without a CORS preflight, which we never allow).

export function sameOriginRequest(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.get('origin');
  if (!origin) return true; // older browsers / same-origin GETs; Lax cookies still apply
  try {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const isJson = (req: Request) => (req.headers.get('content-type') || '').toLowerCase().startsWith('application/json');

/** In-memory fixed window, per server instance. Cheap enough for the token endpoint, which every Hive tab calls. */
const windows = new Map<string, { n: number; reset: number }>();
export function memoryRateLimit(key: string, limit: number, windowS: number) {
  const now = Date.now();
  let w = windows.get(key);
  if (!w || w.reset <= now) {
    if (windows.size > 10000) windows.clear();
    w = { n: 0, reset: now + windowS * 1000 };
    windows.set(key, w);
  }
  w.n++;
  return { allowed: w.n <= limit, retryAfterSeconds: Math.max(1, Math.ceil((w.reset - now) / 1000)) };
}
