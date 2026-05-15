import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getGrowwToken } from '@/lib/groww-client';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ connected: false });
  const token = await getGrowwToken(session.userId);
  return NextResponse.json({ connected: !!token });
}
