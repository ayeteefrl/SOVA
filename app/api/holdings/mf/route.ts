import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Holding } from '@/lib/data';

// Returns mutual fund holdings imported via CAMS CAS PDF upload.
// Reads from user_trades where asset_class = 'MF', aggregated by scheme name.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ holdings: [] });

  const { data: trades, error } = await supabase
    .from('user_trades')
    .select('*')
    .eq('user_id', session.userId)
    .eq('asset_class', 'MF')
    .order('trade_date', { ascending: true });

  if (error || !trades?.length) return NextResponse.json({ holdings: [] });

  // Aggregate by scheme (ticker = ISIN or scheme name)
  const map = new Map<string, {
    name: string;
    ticker: string;
    units: number;
    totalCost: number;
    nav: number;
    amcName: string;
  }>();

  for (const t of trades) {
    const key = (t.ticker ?? t.instrument_name ?? '').trim();
    if (!key) continue;

    const units = Number(t.units) || 0;
    const price = Number(t.price) || 0;

    if (!map.has(key)) {
      map.set(key, {
        name: t.instrument_name ?? key,
        ticker: key,
        units: 0,
        totalCost: 0,
        nav: price,
        amcName: '',
      });
    }

    const entry = map.get(key)!;
    const isBuy = ['Buy', 'buy'].includes(t.action ?? '');
    const isSell = ['Sell', 'sell'].includes(t.action ?? '');

    if (isBuy && units > 0) {
      entry.totalCost += units * price;
      entry.units += units;
      entry.nav = price; // latest NAV
    } else if (isSell && units > 0) {
      if (entry.units > 0) {
        const avg = entry.totalCost / entry.units;
        entry.totalCost -= Math.min(units, entry.units) * avg;
      }
      entry.units = Math.max(0, entry.units - units);
    }
  }

  const holdings: Holding[] = [];
  for (const [, entry] of map) {
    if (entry.units <= 0) continue;
    const avgCost = entry.units > 0 ? entry.totalCost / entry.units : 0;
    const nav = entry.nav || avgCost;
    holdings.push({
      id: `cams-${entry.ticker}`,
      name: entry.name,
      ticker: entry.ticker,
      units: entry.units,
      avgCost,
      ltp: nav,
      value: entry.units * nav,
      daily: 0,
      total: avgCost > 0 ? ((nav - avgCost) / avgCost) * 100 : 0,
      weight: 0,
      sector: 'Mutual Fund',
      source: 'custom',
    });
  }

  return NextResponse.json({ holdings });
}
