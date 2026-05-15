// Upstox OAuth 2.0 integration
// Docs: https://upstox.com/developer/api-documentation/
// Register app: https://account.upstox.com/developer/apps
// Tokens expire daily at 3:30 AM IST

import { supabase } from './supabase';

const UPSTOX_BASE = 'https://api.upstox.com/v2';

export function getUpstoxAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.UPSTOX_API_KEY!,
    redirect_uri: redirectUri,
    response_type: 'code',
  });
  return `${UPSTOX_BASE}/login/authorization/dialog?${params}`;
}

export async function exchangeUpstoxToken(code: string, redirectUri: string): Promise<string> {
  const res = await fetch(`${UPSTOX_BASE}/login/authorization/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.UPSTOX_API_KEY!,
      client_secret: process.env.UPSTOX_API_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Upstox token exchange failed: ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function saveUpstoxSession(userId: string, accessToken: string): Promise<void> {
  await supabase.from('broker_sessions').delete().eq('user_id', userId).eq('broker', 'upstox');
  await supabase.from('broker_sessions').insert({
    user_id: userId,
    broker: 'upstox',
    access_token: accessToken,
    enc_token: null,
    last_refreshed_at: new Date().toISOString(),
  });
}

export async function getUpstoxToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('broker_sessions')
    .select('access_token')
    .eq('user_id', userId)
    .eq('broker', 'upstox')
    .order('last_refreshed_at', { ascending: false })
    .limit(1);
  return data?.[0]?.access_token ?? null;
}

export async function upstoxFetch<T>(userId: string, path: string): Promise<T> {
  const token = await getUpstoxToken(userId);
  if (!token) throw new Error('Upstox not connected');
  const res = await fetch(`${UPSTOX_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 401) throw new Error('UPSTOX_UNAUTHORIZED');
  if (!res.ok) throw new Error(`Upstox API error: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}
