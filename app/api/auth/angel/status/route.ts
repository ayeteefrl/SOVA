import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAngelAuthToken } from '@/lib/angel-client';

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ authenticated: false });
  }

  const token = await getAngelAuthToken(session.userId);
  return NextResponse.json({ authenticated: !!token, email: session.email });
}
