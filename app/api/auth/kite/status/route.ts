import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { getKiteClient } from '@/lib/kite-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ authenticated: false, createdAt: null });
  }

  const kc = await getKiteClient(session.userId);
  if (!kc) {
    return NextResponse.json({ authenticated: false, email: session.email });
  }

  // A stored token isn't necessarily a live one — Kite tokens expire every
  // morning. Verify it so Settings doesn't show "connected" for an expired
  // token. Only an explicit TokenException counts as expired; a network blip
  // shouldn't flip the status.
  let authenticated = true;
  try {
    await kc.getProfile();
  } catch (err: any) {
    if (err?.error_type === 'TokenException' || err?.status === 403) authenticated = false;
  }

  return NextResponse.json({ authenticated, email: session.email });
}
