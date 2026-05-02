import { NextResponse, NextRequest } from 'next/server';
import { getKiteClient, shouldRefresh, triggerSilentRefresh } from '@/lib/kite-client';
import { getSession } from '@/lib/session';

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
    const [holdings, mfHoldings] = await Promise.all([
      kc.getHoldings(),
      kc.getMFHoldings().catch(() => []), // MF may not be available for all accounts
    ]);

    let equityValue = 0;
    let equityDayChange = 0;
    let equityCost = 0;

    for (const h of holdings as any[]) {
      const value = h.last_price * h.quantity;
      equityValue += value;
      equityDayChange += (h.day_change ?? 0) * h.quantity;
      equityCost += h.average_price * h.quantity;
    }

    let mfValue = 0;
    let mfCost = 0;
    for (const h of mfHoldings as any[]) {
      mfValue += h.last_price * h.quantity;
      mfCost += h.average_price * h.quantity;
    }

    const totalValue = equityValue + mfValue;
    const totalCost = equityCost + mfCost;
    const allTimeGain = totalValue - totalCost;
    const dayChangePct = totalValue > 0 ? (equityDayChange / (totalValue - equityDayChange)) * 100 : 0;

    return NextResponse.json({
      netWorth: totalValue,
      dayChange: equityDayChange,
      dayChangePct,
      allTimeGain,
      equityValue,
      mfValue,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache' },
    });
  } catch (err) {
    console.error('[Kite Portfolio]', err);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
