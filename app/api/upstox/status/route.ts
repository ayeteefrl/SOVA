import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUpstoxToken } from '@/lib/upstox-client';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ connected: false });
  const token = await getUpstoxToken(session.userId);
  return NextResponse.json({ connected: !!token });
}
