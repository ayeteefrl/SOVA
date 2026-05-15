import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { motilaFetch } from '@/lib/motilal-client';
import type { Holding } from '@/lib/data';

interface MotilaHolding {
  scripname: string;
  symbol?: string;
  isin?: string;
  holdingqty: number;
  averageprice: number;
  ltp: number;
  daypnlpercentage?: number;
  sector?: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ holdings: [] });

  try {
    const raw = await motilaFetch<MotilaHolding[] | { holdings: MotilaHolding[] }>(
      session.userId,
      '/portfolio/holdings',
    );
    const list: MotilaHolding[] = Array.isArray(raw) ? raw : (raw as { holdings: MotilaHolding[] }).holdings ?? [];

    const holdings: Holding[] = list.map((h) => ({
      id: `motilal-${h.isin ?? h.symbol ?? h.scripname}`,
      name: h.scripname,
      ticker: h.symbol ?? h.scripname,
      units: h.holdingqty,
      avgCost: h.averageprice,
      ltp: h.ltp,
      value: h.holdingqty * h.ltp,
      daily: h.daypnlpercentage ?? 0,
      total: h.averageprice > 0 ? ((h.ltp - h.averageprice) / h.averageprice) * 100 : 0,
      weight: 0,
      sector: h.sector,
      source: 'custom' as const,
    }));

    return NextResponse.json({ holdings });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'MOTILAL_UNAUTHORIZED') {
      return NextResponse.json({ holdings: [], error: 'motilal_unauthorized' });
    }
    console.error('[Motilal Holdings]', err);
    return NextResponse.json({ holdings: [] });
  }
}
