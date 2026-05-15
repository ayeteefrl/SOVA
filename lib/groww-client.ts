// Groww Trade API integration
// Docs: https://groww.in/trade-api
// Auth: server-side API key (GROWW_API_KEY env) + user TOTP from authenticator app

import { supabase } from './supabase';

const GROWW_BASE = 'https://api.groww.in';
const GROWW_API_KEY = process.env.GROWW_API_KEY ?? '';

// Exchanges the server-side API key + user TOTP for a session access token.
export async function getGrowwAccessToken(totp: string): Promise<string> {
  if (!GROWW_API_KEY) throw new Error('GROWW_API_KEY not configured');
  const res = await fetch(`${GROWW_BASE}/v1/login/trading/auth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ api_key: GROWW_API_KEY, totp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Groww auth failed: ${res.status}`);
  }
  const data = await res.json();
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
