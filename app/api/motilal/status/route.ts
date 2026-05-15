import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMotilaToken_stored } from '@/lib/motilal-client';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ connected: false });
  const token = await getMotilaToken_stored(session.userId);
  return NextResponse.json({ connected: !!token });
}
