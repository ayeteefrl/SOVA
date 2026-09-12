// Fixed-window rate limiting backed by Supabase (no extra infra to run).
// Not perfectly race-free under heavy concurrency, which is an acceptable
// tradeoff here — this exists to blunt brute-force/spam, not to be exact.

import { supabase } from './supabase';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// `key` should already identify the action + requester, e.g. `login:1.2.3.4:user@example.com`.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);

  const { data: existing } = await supabase
    .from('auth_rate_limits')
    .select('count')
    .eq('key', key)
    .eq('window_start', windowStart.toISOString())
    .maybeSingle();

  if (existing) {
    if (existing.count >= limit) {
      const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
    }
    await supabase
      .from('auth_rate_limits')
      .update({ count: existing.count + 1 })
      .eq('key', key)
      .eq('window_start', windowStart.toISOString());
    return { allowed: true, retryAfterSeconds: 0 };
  }

  await supabase
    .from('auth_rate_limits')
    .upsert(
      { key, window_start: windowStart.toISOString(), count: 1 },
      { onConflict: 'key,window_start' },
    );
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIp(req: Request): string {
  const headers = req.headers;
  return headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? headers.get('x-real-ip')
    ?? '0.0.0.0';
}
