import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Holding } from '@/lib/data';

function normalizeTicker(t: string) {
  return t.toUpperCase().replace(/\.(NS|BO|BSE|NSE)$/i, '');
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ holdings: [] });

  // ETF trades are intentionally excluded here — they're tracked in user_etfs
  // (see /api/etfs, written to by the New Trade ticket via syncAssetHolding).
  // Including them here too would double-count them: once correctly as an
  // ETF via user_etfs, and again mislabeled as "Equity" via user_trades.
  const { data: trades, error } = await supabase
    .from('user_trades')
    .select('*')
    .eq('user_id', session.userId)
    .eq('asset_class', 'Equity')
    .order('trade_date', { ascending: true });

  if (error || !trades?.length) return NextResponse.json({ holdings: [] });

  // Aggregate trades into holdings by normalized ticker
  const map = new Map<string, {
    name: string;
    ticker: string;
    units: number;
    totalCost: number;
    sector: string;
  }>();

  for (const t of trades) {
    const rawTicker = t.ticker ?? t.instrument_name ?? '';
    const key = normalizeTicker(rawTicker) || normalizeTicker(t.instrument_name ?? '');
    if (!key) continue;

    const isBuy = ['Buy', 'buy'].includes(t.action ?? '');
    const isSell = ['Sell', 'sell'].includes(t.action ?? '');
    const units = Number(t.units) || 0;
    const price = Number(t.price) || (units > 0 ? Number(t.amount) / units : 0);

    if (!map.has(key)) {
      map.set(key, {
        name: t.instrument_name ?? key,
        ticker: key,
        units: 0,
        totalCost: 0,
        sector: 'Other',
      });
    }

    const entry = map.get(key)!;
    if (isBuy && units > 0) {
      entry.totalCost += units * price;
      entry.units += units;
    } else if (isSell && units > 0) {
      // Reduce cost proportionally on sell
      if (entry.units > 0) {
        const avgCost = entry.totalCost / entry.units;
        entry.totalCost -= Math.min(units, entry.units) * avgCost;
      }
      entry.units = Math.max(0, entry.units - units);
    }
  }

  const holdings: Holding[] = [];
  for (const [, entry] of map) {
    if (entry.units <= 0) continue;
    const avgCost = entry.units > 0 ? entry.totalCost / entry.units : 0;
    holdings.push({
      id: `custom-${entry.ticker}-${Date.now()}`,
      name: entry.name,
      ticker: entry.ticker,
      units: entry.units,
      avgCost,
      ltp: avgCost, // no live price for custom holdings
      value: entry.units * avgCost,
      daily: 0,
      total: 0,
      weight: 0,
      sector: entry.sector,
      source: 'custom',
    });
  }

  return NextResponse.json({ holdings });
}
