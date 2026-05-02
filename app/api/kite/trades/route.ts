import { NextResponse, NextRequest } from 'next/server';
import { getKiteClient, shouldRefresh, triggerSilentRefresh } from '@/lib/kite-client';
import { getSession } from '@/lib/session';
import type { ActivityItem } from '@/lib/data';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const kc = await getKiteClient(session.userId);
  if (!kc) {
    return NextResponse.json({ error: 'reconnect_required' }, { status: 401 });
  }

  if (await shouldRefresh(session.userId)) {
    triggerSilentRefresh();
  }

  try {
    const trades = await kc.getTrades();

    const activities: ActivityItem[] = trades.map((t: any) => {
      const isBuy = t.transaction_type === 'BUY';
      const amount = (t.average_price ?? 0) * (t.quantity ?? 0);
      const ts = t.fill_timestamp ?? t.order_timestamp ?? '';
      const readable = ts
        ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Unknown';

      return {
        id: t.trade_id ?? t.order_id,
        title: t.tradingsymbol,
        detail: `${isBuy ? 'Buy' : 'Sell'} ${t.quantity} units @ ₹${(t.average_price ?? 0).toLocaleString('en-IN')} · ${t.exchange}`,
        category: 'Trade' as const,
        amount,
        positive: !isBuy,
        timestamp: readable,
        tradeAction: isBuy ? 'Buy' : 'Sell',
        tradeTicker: t.tradingsymbol,
        tradeUnits: t.quantity,
        tradePrice: t.average_price,
        tradeInstrumentType: 'Equity' as const,
      };
    });

    // Most recent first
    activities.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

    return NextResponse.json({ trades: activities }, {
      headers: { 'Cache-Control': 'no-store, no-cache' },
    });
  } catch (err) {
    console.error('[Kite Trades]', err);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
