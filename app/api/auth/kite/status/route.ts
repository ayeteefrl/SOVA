import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { getKiteClient } from '@/lib/kite-client';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ authenticated: false, createdAt: null });
  }

  const kc = await getKiteClient(session.userId);
  const authenticated = !!kc;

  return NextResponse.json({ authenticated, email: session.email });
}
