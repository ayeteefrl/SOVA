import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { saveSession, createKiteClient } from '@/lib/kite-client';
import { supabase } from '@/lib/supabase';
import { decryptToken } from '@/lib/crypto';

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { data: brokerSession, error } = await supabase
      .from('broker_sessions')
      .select('enc_token')
      .eq('user_id', session.userId)
      .eq('broker', 'zerodha')
      .single();

    if (error || !brokerSession?.enc_token) {
      return NextResponse.json({ error: 'refresh_failed' }, { status: 400 });
    }

    // Use enc_token to renew — enc_token is long-lived and does not expire at midnight
    const encToken = decryptToken(brokerSession.enc_token);
    const kc = createKiteClient();
    kc.setAccessToken(encToken);

    // Verify the token is still valid by fetching profile
    await kc.getProfile();

    // Token is still valid — just update last_refreshed_at
    await saveSession(session.userId, encToken, encToken);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'refresh_failed' }, { status: 400 });
  }
}
