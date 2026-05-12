import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { refreshAngelToken } from '@/lib/angel-client';

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const ok = await refreshAngelToken(session.userId);
    if (!ok) return NextResponse.json({ error: 'refresh_failed' }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'refresh_failed' }, { status: 400 });
  }
}
