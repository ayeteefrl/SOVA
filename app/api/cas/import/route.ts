import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { CASHolding } from '@/lib/cas-client';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({ holdings: [] })) as { holdings: CASHolding[] };
  const { holdings } = body;

  if (!Array.isArray(holdings) || holdings.length === 0) {
    return NextResponse.json({ error: 'No holdings provided' }, { status: 400 });
  }

  const trades = holdings.map((h) => {
    const avgCost = h.units > 0 ? (h.costValue || h.value) / h.units : h.nav;
    return {
      user_id: session.userId,
      asset_class: h.assetType === 'ETF' ? 'ETF' : h.assetType === 'MF' ? 'MF' : 'Equity',
      instrument_name: h.name,
      ticker: h.isin || h.name,
      action: 'Buy',
      units: h.units,
      price: avgCost,
      amount: h.costValue || h.value,
      trade_date: h.purchaseDate
        ? new Date(h.purchaseDate).toISOString()
        : new Date().toISOString(),
      notes: ['CAS Import', h.amc, h.folio ? `Folio ${h.folio}` : null]
        .filter(Boolean)
        .join(' · '),
      sector: h.assetType === 'MF' ? 'Mutual Fund' : 'Equity',
      source: 'cas_import',
    };
  });

  const { error } = await supabase
    .from('user_trades')
    .upsert(trades, { onConflict: 'user_id,ticker,trade_date', ignoreDuplicates: true });

  if (error) {
    console.error('[CAS Import]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the app to re-fetch holdings
  return NextResponse.json({ imported: trades.length });
}
