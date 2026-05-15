// Motilal tokens expire daily at 6 AM IST.
// This route is called by the UI when the user sees a "session expired" prompt —
// they re-enter their password + TOTP to get a fresh token.
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

  try {
    const authToken = await getMotilaToken(session.userId, password, totp);
    await saveMotilaSession(session.userId, authToken);
    return NextResponse.json({ refreshed: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Token refresh failed';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
