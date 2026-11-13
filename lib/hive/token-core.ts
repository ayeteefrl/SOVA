// Short-lived tokens SOVA issues for the Chart Hive data server (hive-server verifies the same claims).
// HS256, aud "hive-data", sub = SOVA user id, role = owner | member, 10 minutes.
import { SignJWT, jwtVerify } from 'jose';

export const HIVE_AUDIENCE = 'hive-data';
export const HIVE_ISSUER = 'sova';
export const HIVE_TOKEN_TTL_S = 600;
export const MIN_SECRET_LENGTH = 32;

export function hiveSecret(raw: string | undefined): Uint8Array | null {
  const s = (raw || '').trim();
  return s.length >= MIN_SECRET_LENGTH ? new TextEncoder().encode(s) : null;
}

export async function signHiveToken(secret: Uint8Array, sub: string, role: 'owner' | 'member', ttlS = HIVE_TOKEN_TTL_S) {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(sub)
    .setAudience(HIVE_AUDIENCE)
    .setIssuer(HIVE_ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlS)
    .sign(secret);
  return { token, expiresAt: (now + ttlS) * 1000 };
}

export async function verifyHiveToken(secret: Uint8Array, token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], audience: HIVE_AUDIENCE, issuer: HIVE_ISSUER });
  if (typeof payload.sub !== 'string' || (payload.role !== 'owner' && payload.role !== 'member')) throw new Error('bad claims');
  return { sub: payload.sub, role: payload.role as 'owner' | 'member', exp: payload.exp! };
}
