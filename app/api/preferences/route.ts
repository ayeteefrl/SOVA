import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', session.userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return defaults if no row yet
  if (!data) {
    return NextResponse.json({
      currency: 'INR',
      display_format: 'lakh',
      gain_color: '#4edea3',
      loss_color: '#ffb2b7',
      live_market_data: true,
      show_trade_rationale: true,
      compact_view: false,
      notifications_sip_debit: true,
      notifications_portfolio: true,
      notifications_market_hours: false,
      notifications_news_digest: true,
    });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed = [
    'currency', 'display_format', 'gain_color', 'loss_color',
    'live_market_data', 'show_trade_rationale', 'compact_view',
    'notifications_sip_debit', 'notifications_portfolio',
    'notifications_market_hours', 'notifications_news_digest',
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Upsert (insert or update)
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: session.userId, ...updates }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
