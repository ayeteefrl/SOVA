import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getHdfcToken } from '@/lib/hdfc-client';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ connected: false });
  const token = await getHdfcToken(session.userId);
  return NextResponse.json({ connected: !!token });
}
