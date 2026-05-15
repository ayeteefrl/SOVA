// HDFC Securities InvestRight Open API integration
// Docs: https://developer.hdfcsec.com/ir-docs/docs/intro
// Register app: https://developer.hdfcsec.com/ (log in with InvestRight credentials)
// Auth: API Key + Secret → session token
// Base URL: set HDFC_API_BASE_URL in .env.local (visible after login in the developer portal)

import { supabase } from './supabase';

// The base URL is only visible after logging into developer.hdfcsec.com
// Set it as HDFC_API_BASE_URL in your .env.local
function getBase(): string {
  const url = process.env.HDFC_API_BASE_URL;
  if (!url) throw new Error('HDFC_API_BASE_URL not set in .env.local');
  return url.replace(/\/$/, '');
}

// Logs in with API key + secret and returns a session token.
// Call this once per session; re-call if requests return 401.
export async function getHdfcSessionToken(apiKey: string, apiSecret: string): Promise<string> {
  const base = getBase();
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HDFC login failed: ${res.status}`);
  }
  const data = await res.json();
  const token = data.session_token ?? data.access_token ?? data.token;
  if (!token) throw new Error('HDFC returned no session token');
  return token;
}

export async function saveHdfcSession(userId: string, sessionToken: string): Promise<void> {
  await supabase.from('broker_sessions').delete().eq('user_id', userId).eq('broker', 'hdfc');
  await supabase.from('broker_sessions').insert({
    user_id: userId,
    broker: 'hdfc',
    access_token: sessionToken,
    enc_token: null,
    last_refreshed_at: new Date().toISOString(),
  });
}

export async function getHdfcToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('broker_sessions')
    .select('access_token')
    .eq('user_id', userId)
    .eq('broker', 'hdfc')
    .order('last_refreshed_at', { ascending: false })
    .limit(1);
  return data?.[0]?.access_token ?? null;
}

export async function hdfcFetch<T>(userId: string, path: string): Promise<T> {
  const token = await getHdfcToken(userId);
  if (!token) throw new Error('HDFC not connected');
  const base = getBase();
  const res = await fetch(`${base}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-API-Key': process.env.HDFC_API_KEY ?? '',
      Accept: 'application/json',
    },
  });
  if (res.status === 401) throw new Error('HDFC_UNAUTHORIZED');
  if (!res.ok) throw new Error(`HDFC API error: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}
