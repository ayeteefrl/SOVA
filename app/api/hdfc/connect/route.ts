import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getHdfcSessionToken, saveHdfcSession } from '@/lib/hdfc-client';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { api_key, api_secret } = body as { api_key: string; api_secret: string };

  if (!api_key || !api_secret) {
    return NextResponse.json({ error: 'api_key and api_secret are required' }, { status: 400 });
  }

  try {
    const sessionToken = await getHdfcSessionToken(api_key, api_secret);
    await saveHdfcSession(session.userId, sessionToken);
    return NextResponse.json({ connected: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'HDFC authentication failed';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
