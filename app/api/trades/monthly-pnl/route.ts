import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ data: [] });

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: trades, error } = await supabase
    .from('user_trades')
    .select('action, amount, trade_date')
    .eq('user_id', session.userId)
    .gte('trade_date', oneYearAgo.toISOString())
    .order('trade_date', { ascending: true });

  // Build 12-month labels (last 12 months)
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

  const pnlByMonth: Record<string, number> = {};
  months.forEach((m) => { pnlByMonth[m.key] = 0; });

  if (!error && trades) {
    for (const t of trades) {
      if (!t.trade_date) continue;
      const d = new Date(t.trade_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!(key in pnlByMonth)) continue;
      const amount = Number(t.amount) || 0;
      // Sells add to realised PNL, buys subtract (net cash flow perspective)
      if (['Sell', 'sell', 'Dividend', 'dividend'].includes(t.action ?? '')) {
        pnlByMonth[key] += amount;
      } else if (['Buy', 'buy'].includes(t.action ?? '')) {
        pnlByMonth[key] -= amount;
      }
    }
  }

  const result = months.map((m) => ({ label: m.label, value: pnlByMonth[m.key] ?? 0 }));
  return NextResponse.json({ data: result });
}
