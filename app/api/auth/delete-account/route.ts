import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/session';
import { cookies } from 'next/headers';

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Requires SUPABASE_SERVICE_ROLE_KEY — the anon key cannot delete users
    const adminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const userId = session.userId;

    // Delete all user data in the correct order to respect FK constraints
    await Promise.all([
      adminClient.from('user_trades').delete().eq('user_id', userId),
      adminClient.from('user_active_sessions').delete().eq('user_id', userId),
      adminClient.from('broker_sessions').delete().eq('user_id', userId),
      adminClient.from('user_preferences').delete().eq('user_id', userId),
      adminClient.from('user_profiles').delete().eq('user_id', userId),
      adminClient.from('custom_holdings').delete().eq('user_id', userId),
      adminClient.from('portfolio_snapshots').delete().eq('user_id', userId),
    ]);

    // Delete the user record itself
    await adminClient.from('users').delete().eq('id', userId);

    // Clear the session cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('sova_session', '', { maxAge: 0, path: '/' });
    return response;
  } catch (err) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
