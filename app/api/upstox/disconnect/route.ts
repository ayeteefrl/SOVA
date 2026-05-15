import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase
    .from('broker_sessions')
    .delete()
    .eq('user_id', session.userId)
    .eq('broker', 'upstox');

  return NextResponse.json({ disconnected: true });
}
