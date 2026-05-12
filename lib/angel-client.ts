import { supabase } from './supabase';

const ANGEL_BASE = 'https://apiconnect.angelbroking.com';

// Standard headers required by every Angel One API call
function angelHeaders(authToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '127.0.0.1',
    'X-MACAddress': '00:00:00:00:00:00',
    'X-PrivateKey': process.env.ANGEL_API_KEY!,
  };
}

// Returns the stored auth_token for a user, or null if no session exists
export async function getAngelAuthToken(userId: string): Promise<string | null> {
  try {
    const { data: sessions, error } = await supabase
      .from('broker_sessions')
      .select('access_token')
      .eq('user_id', userId)
      .eq('broker', 'angel_one')
      .order('last_refreshed_at', { ascending: false })
      .limit(1);

    const session = sessions?.[0];
    if (error || !session?.access_token) return null;
    return session.access_token;
  } catch {
    return null;
  }
}

// Fetch Angel One holdings using the stored auth_token
export async function fetchAngelHoldings(authToken: string) {
  const res = await fetch(
    `${ANGEL_BASE}/rest/secure/angelbroking/portfolio/v1/getAllHolding`,
    { headers: angelHeaders(authToken) }
  );
  if (!res.ok) throw new Error(`Angel One holdings fetch failed: ${res.status}`);
  const json = await res.json();
  if (!json.status) throw new Error(json.message ?? 'Angel One API error');
  return json.data;
}

// Upsert Angel One session after OAuth callback
export async function saveAngelSession(
  userId: string,
  authToken: string,
  refreshToken: string,
): Promise<void> {
  await supabase
    .from('broker_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('broker', 'angel_one');

  await supabase
    .from('broker_sessions')
    .insert({
      user_id: userId,
      broker: 'angel_one',
      access_token: authToken,
      enc_token: refreshToken,
      last_refreshed_at: new Date().toISOString(),
    });
}

// Check if the session is more than 20 hours old
export async function shouldRefreshAngel(userId: string): Promise<boolean> {
  try {
    const { data: sessions, error } = await supabase
      .from('broker_sessions')
      .select('last_refreshed_at')
      .eq('user_id', userId)
      .eq('broker', 'angel_one')
      .order('last_refreshed_at', { ascending: false })
      .limit(1);

    const session = sessions?.[0];
    if (error || !session) return false;

    const hours = (Date.now() - new Date(session.last_refreshed_at).getTime()) / 3_600_000;
    return hours > 20;
  } catch {
    return false;
  }
}

// Use the refresh_token to generate a new auth_token
export async function refreshAngelToken(userId: string): Promise<boolean> {
  try {
    const { data: sessions, error } = await supabase
      .from('broker_sessions')
      .select('enc_token')
      .eq('user_id', userId)
      .eq('broker', 'angel_one')
      .single();

    if (error || !sessions?.enc_token) return false;

    const res = await fetch(
      `${ANGEL_BASE}/rest/auth/angelbroking/jwt/v1/generateTokens`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-PrivateKey': process.env.ANGEL_API_KEY!,
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': '00:00:00:00:00:00',
        },
        body: JSON.stringify({ refreshToken: sessions.enc_token }),
      }
    );

    if (!res.ok) return false;
    const json = await res.json();
    if (!json.status || !json.data?.jwtToken) return false;

    await saveAngelSession(userId, json.data.jwtToken, json.data.refreshToken ?? sessions.enc_token);
    return true;
  } catch {
    return false;
  }
}

// Generate the Angel One publisher login URL
export function getAngelLoginURL(): string {
  return `https://smartapi.angelbroking.com/publisher-login?api_key=${process.env.ANGEL_API_KEY!}`;
}
