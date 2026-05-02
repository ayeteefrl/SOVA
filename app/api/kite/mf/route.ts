import { NextResponse, NextRequest } from 'next/server';
import { getKiteClient, shouldRefresh, triggerSilentRefresh } from '@/lib/kite-client';
import { getSession } from '@/lib/session';
import type { Holding } from '@/lib/data';

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
    const raw = await kc.getMFHoldings();

    const holdings: Holding[] = raw.map((h: any, i: number) => {
      const value = h.last_price * h.quantity;
      const total = h.average_price > 0
        ? ((h.last_price - h.average_price) / h.average_price) * 100
        : 0;
      return {
        id: `mf-${h.tradingsymbol ?? i}`,
        name: h.fund ?? h.tradingsymbol,
        ticker: h.tradingsymbol,
        units: h.quantity,
        avgCost: h.average_price,
        ltp: h.last_price,
        value,
        daily: 0, // MF NAV doesn't have intraday change
        total,
        weight: 0,
      };
    });

    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    holdings.forEach((h) => {
      h.weight = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    });

    return NextResponse.json({ holdings, totalValue }, {
      headers: { 'Cache-Control': 'no-store, no-cache' },
    });
  } catch (err) {
    console.error('[Kite MF Holdings]', err);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
