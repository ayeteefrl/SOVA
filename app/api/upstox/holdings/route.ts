import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { upstoxFetch } from '@/lib/upstox-client';
import type { Holding } from '@/lib/data';

interface UpstoxHolding {
  tradingsymbol: string;
  company_name?: string;
  isin: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  day_change_percentage: number;
  instrument_token?: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ holdings: [] });

  try {
    const raw = await upstoxFetch<{ holdings: UpstoxHolding[] }>(session.userId, '/portfolio/long-term-holdings');
    const upstoxHoldings: UpstoxHolding[] = raw?.holdings ?? (Array.isArray(raw) ? raw : []);

    const holdings: Holding[] = upstoxHoldings.map((h) => ({
      id: `upstox-${h.isin ?? h.tradingsymbol}`,
      name: h.company_name ?? h.tradingsymbol,
      ticker: h.tradingsymbol,
      units: h.quantity,
      avgCost: h.average_price,
      ltp: h.last_price,
      value: h.quantity * h.last_price,
      daily: h.day_change_percentage ?? 0,
      total: h.average_price > 0 ? ((h.last_price - h.average_price) / h.average_price) * 100 : 0,
      weight: 0,
      source: 'upstox' as const,
    }));

    return NextResponse.json({ holdings });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UPSTOX_UNAUTHORIZED') {
      return NextResponse.json({ holdings: [], error: 'upstox_unauthorized' });
    }
    console.error('[Upstox Holdings]', err);
    return NextResponse.json({ holdings: [] });
  }
}
