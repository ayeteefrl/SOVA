// Groww Trade API integration
// Docs: https://groww.in/trade-api
// Get API keys: https://groww.in/trade-api/api-keys
// Requires ₹499/month subscription + active Groww trading account
// Auth: API Key + TOTP (from authenticator app linked to your Groww account)

import { supabase } from './supabase';

const GROWW_BASE = 'https://api.groww.in';

// Exchanges API key + TOTP for a bearer access token.
// The TOTP comes from the authenticator app the user linked when generating their API key.
export async function getGrowwAccessToken(apiKey: string, totp: string): Promise<string> {
  const res = await fetch(`${GROWW_BASE}/v1/login/trading/auth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ api_key: apiKey, totp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Groww auth failed: ${res.status}`);
  }
  const data = await res.json();
  // Token field may be access_token or authToken depending on API version
  const token = data.access_token ?? data.authToken ?? data.token;
  if (!token) throw new Error('Groww returned no access token');
  return token;
}

export async function saveGrowwSession(userId: string, accessToken: string): Promise<void> {
  await supabase.from('broker_sessions').delete().eq('user_id', userId).eq('broker', 'groww');
  await supabase.from('broker_sessions').insert({
    user_id: userId,
    broker: 'groww',
    access_token: accessToken,
    enc_token: null,
    last_refreshed_at: new Date().toISOString(),
  });
}

export async function getGrowwToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('broker_sessions')
    .select('access_token')
    .eq('user_id', userId)
    .eq('broker', 'groww')
    .order('last_refreshed_at', { ascending: false })
    .limit(1);
  return data?.[0]?.access_token ?? null;
}

export async function growwFetch<T>(userId: string, path: string): Promise<T> {
  const token = await getGrowwToken(userId);
  if (!token) throw new Error('Groww not connected');
  const res = await fetch(`${GROWW_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 401) throw new Error('GROWW_UNAUTHORIZED');
  if (!res.ok) throw new Error(`Groww API error: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}
