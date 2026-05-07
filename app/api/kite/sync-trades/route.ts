import { NextResponse } from 'next/server';
import { getKiteClient } from '@/lib/kite-client';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const revalidate = 0;

// POST — sync today's Zerodha trades into user_trades (idempotent, no schema changes needed)
export async function POST() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const kc = await getKiteClient(session.userId);
  if (!kc) {
    return NextResponse.json({ synced: 0, reason: 'kite_not_connected' });
  }

  try {
    const rawTrades = await kc.getTrades();
    if (!rawTrades?.length) {
      return NextResponse.json({ synced: 0, reason: 'no_trades_today' });
    }

    // Fetch today's already-synced trade notes to avoid duplicates
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from('user_trades')
      .select('notes')
      .eq('user_id', session.userId)
      .gte('trade_date', today);

    const existingNotes = new Set((existing ?? []).map((r: any) => r.notes));

    let inserted = 0;
    for (const t of rawTrades) {
      const isBuy = t.transaction_type === 'BUY';
      const qty = t.filled_quantity ?? t.quantity ?? 0;
      const price = t.average_price ?? 0;
      const amount = price * qty;
      const tradeDate = t.fill_timestamp
        ? new Date(t.fill_timestamp).toISOString()
        : new Date().toISOString();
      const noteKey = `Zerodha · ${t.exchange} · order ${t.order_id}`;

      if (existingNotes.has(noteKey)) continue;

      await supabase.from('user_trades').insert({
        user_id: session.userId,
        asset_class: 'Equity',
        instrument_name: t.tradingsymbol,
        ticker: t.tradingsymbol,
        action: isBuy ? 'Buy' : 'Sell',
        units: qty,
        price,
        amount,
        trade_date: tradeDate,
        notes: noteKey,
        rationale: null,
      });
      inserted++;
    }

    return NextResponse.json({ synced: inserted });
  } catch (err) {
    console.error('[Kite SyncTrades]', err);
    return NextResponse.json({ synced: 0, error: 'fetch_failed' });
  }
}
