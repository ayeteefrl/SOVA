import { supabase, BrokerSession } from './supabase';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { KiteConnect } = require('kiteconnect');
type KiteInstance = InstanceType<typeof KiteConnect>;

// Returns an authenticated KiteConnect instance for a user, or null if no session exists
export async function getKiteClient(userId: string): Promise<KiteInstance | null> {
  try {
    const { data: sessions, error } = await supabase
      .from('broker_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('broker', 'zerodha')
      .order('last_refreshed_at', { ascending: false })
      .limit(1);

    const session = sessions?.[0];
    if (error || !session || !session.access_token) {
      return null;
    }

    const kc = new KiteConnect({ api_key: process.env.KITE_API_KEY! });
    kc.setAccessToken(session.access_token);
    return kc;
  } catch {
    return null;
  }
}

// Upsert broker session for a user (called after OAuth callback)
export async function saveSession(userId: string, accessToken: string, encToken: string): Promise<void> {
  // Delete any existing rows first to avoid duplicates (safe even if none exist)
  await supabase
    .from('broker_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('broker', 'zerodha');

  await supabase
    .from('broker_sessions')
    .insert({
      user_id: userId,
      broker: 'zerodha',
      access_token: accessToken,
      enc_token: encToken,
      last_refreshed_at: new Date().toISOString(),
    });
}

// Check if the session needs a token refresh.
// Zerodha access tokens expire at midnight IST — check every ~20 hours to stay ahead.
export async function shouldRefresh(userId: string): Promise<boolean> {
  try {
    const { data: sessions, error } = await supabase
      .from('broker_sessions')
      .select('last_refreshed_at')
      .eq('user_id', userId)
      .eq('broker', 'zerodha')
      .order('last_refreshed_at', { ascending: false })
      .limit(1);

    const session = sessions?.[0];

    if (error || !session) return false;

    const lastRefreshed = new Date(session.last_refreshed_at);
    const now = new Date();
    const hoursSinceRefresh = (now.getTime() - lastRefreshed.getTime()) / (1000 * 60 * 60);

    return hoursSinceRefresh > 20;
  } catch {
    return false;
  }
}

// Returns a bare KiteConnect instance (for login flow, no token needed)
export function createKiteClient(): KiteInstance {
  return new KiteConnect({ api_key: process.env.KITE_API_KEY! });
}

// Fire-and-forget: triggers background session refresh without blocking the caller
export function triggerSilentRefresh(): void {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  fetch(`${baseUrl}/api/auth/kite/refresh`, { method: 'POST', credentials: 'include' }).catch(() => {});
}
