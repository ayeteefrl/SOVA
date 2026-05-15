import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { growwFetch } from '@/lib/groww-client';
import type { Holding } from '@/lib/data';

interface GrowwHolding {
  trading_symbol: string;
  company?: string;
  isin?: string;
  quantity: number;
  average_price: number;
  ltp: number;
  day_change_percentage?: number;
  sector?: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ holdings: [] });

  try {
    const raw = await growwFetch<GrowwHolding[] | { holdings: GrowwHolding[] }>(
      session.userId,
      '/v1/holdings/user',
    );
    const list: GrowwHolding[] = Array.isArray(raw) ? raw : (raw as { holdings: GrowwHolding[] }).holdings ?? [];

    const holdings: Holding[] = list.map((h) => ({
      id: `groww-${h.isin ?? h.trading_symbol}`,
      name: h.company ?? h.trading_symbol,
      ticker: h.trading_symbol,
      units: h.quantity,
      avgCost: h.average_price,
      ltp: h.ltp,
      value: h.quantity * h.ltp,
      daily: h.day_change_percentage ?? 0,
      total: h.average_price > 0 ? ((h.ltp - h.average_price) / h.average_price) * 100 : 0,
      weight: 0,
      sector: h.sector,
      source: 'custom' as const,
    }));

    return NextResponse.json({ holdings });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'GROWW_UNAUTHORIZED') {
      return NextResponse.json({ holdings: [], error: 'groww_unauthorized' });
    }
    console.error('[Groww Holdings]', err);
    return NextResponse.json({ holdings: [] });
  }
}
