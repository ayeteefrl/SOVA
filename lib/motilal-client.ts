// Motilal Oswal moAPI integration
// Docs: https://invest.motilaloswal.com/moAPI/APIDocumentation/Introduction
// Register: https://invest.motilaloswal.com/moAPI/Home/Login
// Contact: Tradingapi@motilaloswal.com
// Auth: SHA-256 hashed credentials → authtoken (expires daily at 6 AM IST)
// Production base: https://openapi.motilaloswal.com/rest
// UAT/sandbox base: https://uatopenapi.motilaloswaluat.com/rest

import crypto from 'crypto';
import { supabase } from './supabase';

function getBase(): string {
  return (process.env.MOTILAL_BASE_URL ?? 'https://openapi.motilaloswal.com/rest').replace(/\/$/, '');
}

// Motilal auth requires SHA-256(password + apiKey) as the password field.
// Use TOTP from your linked authenticator app for the 2fa field.
export async function getMotilaToken(
  userId: string,
  password: string,
  totp: string,
): Promise<string> {
  const apiKey = process.env.MOTILAL_API_KEY!;
  const clientCode = process.env.MOTILAL_CLIENT_CODE!;
  const hashedPassword = crypto
    .createHash('sha256')
    .update(password + apiKey)
    .digest('hex');

  const res = await fetch(`${getBase()}/login/v3/authdirectapi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      userid: clientCode,
      password: hashedPassword,
      '2fa': totp,
      vendorinfo: process.env.MOTILAL_VENDOR_INFO ?? '',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Motilal login failed: ${res.status}`);
  }
  const data = await res.json();
  const token = data.authtoken ?? data.AuthToken ?? data.token;
  if (!token) throw new Error('Motilal returned no authtoken');
  return token;
}

export async function saveMotilaSession(userId: string, authToken: string): Promise<void> {
  await supabase.from('broker_sessions').delete().eq('user_id', userId).eq('broker', 'motilal');
  await supabase.from('broker_sessions').insert({
    user_id: userId,
    broker: 'motilal',
    access_token: authToken,
    enc_token: null,
    last_refreshed_at: new Date().toISOString(),
  });
}

export async function getMotilaToken_stored(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('broker_sessions')
    .select('access_token, last_refreshed_at')
    .eq('user_id', userId)
    .eq('broker', 'motilal')
    .order('last_refreshed_at', { ascending: false })
    .limit(1);
  if (!data?.[0]?.access_token) return null;

  // Tokens expire at 6 AM IST — treat as stale if saved before today 06:00 IST
  const refreshedAt = new Date(data[0].last_refreshed_at);
  const now = new Date();
  const todaySix = new Date();
  todaySix.setUTCHours(0, 30, 0, 0); // 6 AM IST = 00:30 UTC
  if (refreshedAt < todaySix && now >= todaySix) return null; // token expired

  return data[0].access_token;
}

export async function motilaFetch<T>(userId: string, path: string, body?: object): Promise<T> {
  const token = await getMotilaToken_stored(userId);
  if (!token) throw new Error('MOTILAL_UNAUTHORIZED');
  const res = await fetch(`${getBase()}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) throw new Error('MOTILAL_UNAUTHORIZED');
  if (!res.ok) throw new Error(`Motilal API error: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}
