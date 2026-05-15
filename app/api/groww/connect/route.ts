import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getGrowwAccessToken, saveGrowwSession } from '@/lib/groww-client';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { api_key, totp } = body as { api_key: string; totp: string };

  if (!api_key || !totp) {
    return NextResponse.json({ error: 'api_key and totp are required' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(totp)) {
    return NextResponse.json({ error: 'TOTP must be a 6-digit code from your authenticator app' }, { status: 400 });
  }

  try {
    const accessToken = await getGrowwAccessToken(api_key, totp);
    await saveGrowwSession(session.userId, accessToken);
    return NextResponse.json({ connected: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Groww authentication failed';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
