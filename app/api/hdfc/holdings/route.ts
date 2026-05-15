import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { hdfcFetch } from '@/lib/hdfc-client';
import type { Holding } from '@/lib/data';

interface HdfcHolding {
  symbol: string;
  company_name?: string;
  isin?: string;
  quantity: number;
  avg_cost: number;
  ltp: number;
  day_change_pct?: number;
  sector?: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ holdings: [] });

  try {
    const raw = await hdfcFetch<HdfcHolding[] | { holdings: HdfcHolding[] }>(
      session.userId,
      '/holdings',
    );
    const list: HdfcHolding[] = Array.isArray(raw) ? raw : (raw as { holdings: HdfcHolding[] }).holdings ?? [];

    const holdings: Holding[] = list.map((h) => ({
      id: `hdfc-${h.isin ?? h.symbol}`,
      name: h.company_name ?? h.symbol,
      ticker: h.symbol,
      units: h.quantity,
      avgCost: h.avg_cost,
      ltp: h.ltp,
      value: h.quantity * h.ltp,
      daily: h.day_change_pct ?? 0,
      total: h.avg_cost > 0 ? ((h.ltp - h.avg_cost) / h.avg_cost) * 100 : 0,
      weight: 0,
      sector: h.sector,
      source: 'custom' as const,
    }));

    return NextResponse.json({ holdings });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'HDFC_UNAUTHORIZED') {
      return NextResponse.json({ holdings: [], error: 'hdfc_unauthorized' });
    }
    console.error('[HDFC Holdings]', err);
    return NextResponse.json({ holdings: [] });
  }
}
