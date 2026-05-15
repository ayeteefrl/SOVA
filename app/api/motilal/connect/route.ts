import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMotilaToken, saveMotilaSession } from '@/lib/motilal-client';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { password, totp } = body as { password: string; totp: string };

  if (!password || !totp) {
    return NextResponse.json({ error: 'password and totp are required' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(totp)) {
    return NextResponse.json({ error: 'TOTP must be a 6-digit code from your authenticator app' }, { status: 400 });
  }
  if (!process.env.MOTILAL_API_KEY || !process.env.MOTILAL_CLIENT_CODE) {
    return NextResponse.json(
      { error: 'MOTILAL_API_KEY and MOTILAL_CLIENT_CODE must be set in .env.local' },
      { status: 503 },
    );
  }

  try {
    const authToken = await getMotilaToken(session.userId, password, totp);
    await saveMotilaSession(session.userId, authToken);
    return NextResponse.json({ connected: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Motilal Oswal authentication failed';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
