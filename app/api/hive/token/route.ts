// POST /api/hive/token: a 10-minute token for hive-server, only for the owner and invited members.
import { NextResponse } from 'next/server';
import { getHiveAccess } from '@/lib/hive/access';
import { hiveSecret, signHiveToken } from '@/lib/hive/token-core';
import { memoryRateLimit, sameOriginRequest } from '@/lib/hive/request-guard';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStore });

  const access = await getHiveAccess();
  if (!access.signedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  if (access.role === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStore });

  // Tabs refresh about every 8 minutes and on each reconnect; 30 a minute leaves room for many tabs.
  const rl = memoryRateLimit(`hive-token:${access.userId}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rl.retryAfterSeconds) } });
  }

  const secret = hiveSecret(process.env.HIVE_TOKEN_SECRET);
  if (!secret) {
    console.error('[hive] HIVE_TOKEN_SECRET is missing or shorter than 32 characters');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500, headers: noStore });
  }
  const { token, expiresAt } = await signHiveToken(secret, access.userId!, access.role);
  return NextResponse.json({ token, expiresAt, role: access.role }, { headers: noStore });
}
