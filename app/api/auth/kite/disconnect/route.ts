import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  await supabase
    .from('broker_sessions')
    .delete()
    .eq('user_id', session.userId)
    .eq('broker', 'zerodha');

  return NextResponse.json({ success: true });
}
