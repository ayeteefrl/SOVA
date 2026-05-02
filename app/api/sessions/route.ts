import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_active_sessions')
    .select('*')
    .eq('user_id', session.userId)
    .order('last_active', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark current session
  const cookieStore = await cookies();
  const currentToken = cookieStore.get('sova_session')?.value ?? '';
  const currentHash = createHash('sha256').update(currentToken).digest('hex');

  const withCurrent = (data ?? []).map((s) => ({
    ...s,
    is_current: s.session_token_hash === currentHash,
  }));

  return NextResponse.json(withCurrent);
}
