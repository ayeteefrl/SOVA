import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ data: [] });

  // Build 12-month labels (last 12 calendar months)
  const months: { label: string; key: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({
      label: d.toLocaleString('en', { month: 'short' }).toUpperCase(),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }

  // ── Try snapshot-based month-over-month P&L first ──────────────
  const thirteenMonthsAgo = new Date();
  thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

  const { data: snapshots } = await supabase
    .from('portfolio_snapshots')
    .select('snapshot_date, net_worth')
    .eq('user_id', session.userId)
    .gte('snapshot_date', thirteenMonthsAgo.toISOString().slice(0, 10))
    .order('snapshot_date', { ascending: true });

  // Group snapshots: last snapshot of each month key (ascending order, so last one wins)
  const snapByMonth = new Map<string, number>();
  for (const snap of snapshots ?? []) {
    const key = snap.snapshot_date.slice(0, 7); // YYYY-MM
    snapByMonth.set(key, Number(snap.net_worth));
  }

  // If we have at least 2 months of snapshot data, compute month-over-month change
  if (snapByMonth.size >= 2) {
    const result = months.map((m, idx) => {
      const curr = snapByMonth.get(m.key);
      // Find previous month key
      const prevKey = idx > 0 ? months[idx - 1].key : (() => {
        const d = new Date(m.key + '-01');
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();
      const prev = snapByMonth.get(prevKey);
      // Only compute change if we have both data points
      const value = (curr !== undefined && prev !== undefined) ? curr - prev : 0;
      return { label: m.label, value };
    });
    return NextResponse.json({ data: result });
  }

  // ── Fallback: realised P&L from trades using FIFO cost basis ───
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: trades } = await supabase
    .from('user_trades')
    .select('action, amount, units, price, ticker, trade_date')
    .eq('user_id', session.userId)
    .gte('trade_date', oneYearAgo.toISOString())
    .order('trade_date', { ascending: true });

  const pnlByMonth: Record<string, number> = {};
  months.forEach((m) => { pnlByMonth[m.key] = 0; });

  if (trades?.length) {
    // Simple realised P&L: for each sell, realised gain = (sell price - avg cost) * qty
    // Track avg cost per ticker via FIFO approximation
    const costBasis: Record<string, { totalCost: number; totalUnits: number }> = {};

    for (const t of trades) {
      const ticker = t.ticker ?? 'UNKNOWN';
      const units = Number(t.units) || 0;
      const price = Number(t.price) || 0;
      const action = (t.action ?? '').toLowerCase();

      if (action === 'buy') {
        if (!costBasis[ticker]) costBasis[ticker] = { totalCost: 0, totalUnits: 0 };
        costBasis[ticker].totalCost += units * price;
        costBasis[ticker].totalUnits += units;
      } else if (action === 'sell') {
        const avgCost = costBasis[ticker]
          ? costBasis[ticker].totalCost / (costBasis[ticker].totalUnits || 1)
          : price;
        const realisedGain = (price - avgCost) * units;
        const d = new Date(t.trade_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in pnlByMonth) pnlByMonth[key] += realisedGain;
        // Reduce cost basis
        if (costBasis[ticker]) {
          const remaining = costBasis[ticker].totalUnits - units;
          costBasis[ticker].totalUnits = Math.max(0, remaining);
          costBasis[ticker].totalCost = Math.max(0, costBasis[ticker].totalCost - units * avgCost);
        }
      } else if (action === 'dividend') {
        const amount = Number(t.amount) || 0;
        const d = new Date(t.trade_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in pnlByMonth) pnlByMonth[key] += amount;
      }
    }
  }

  const result = months.map((m) => ({ label: m.label, value: pnlByMonth[m.key] ?? 0 }));
  return NextResponse.json({ data: result });
}
