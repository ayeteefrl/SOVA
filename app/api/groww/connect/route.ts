import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getGrowwAccessToken, saveGrowwSession } from '@/lib/groww-client';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { totp } = body as { totp: string };

  if (!totp) {
    return NextResponse.json({ error: 'totp is required' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(totp)) {
    return NextResponse.json({ error: 'TOTP must be a 6-digit code from your authenticator app' }, { status: 400 });
  }

  try {
    const accessToken = await getGrowwAccessToken(totp);
    await saveGrowwSession(session.userId, accessToken);
    return NextResponse.json({ connected: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Groww authentication failed';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
