import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  // Build last 12-month labels in "APR '24" format (matches PerformanceChart parser)
  const months: { label: string; endDate: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const monthName = d.toLocaleString('en', { month: 'short' }).toUpperCase();
    const yearSuffix = String(d.getFullYear()).slice(2);
    months.push({ label: `${monthName} '${yearSuffix}`, endDate: monthEnd });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      data: months.map((m) => ({ label: m.label, value: 0, benchmark: 0, isFYEnd: false })),
    });
  }

  // Fetch ALL trades (not just 12 months) so older investments are included
  const { data: trades } = await supabase
    .from('user_trades')
    .select('action, amount, trade_date')
    .eq('user_id', session.userId)
    .order('trade_date', { ascending: true });

  const tradeList = (trades ?? []).map((t) => ({
    date: new Date(t.trade_date),
    amount: Number(t.amount) || 0,
    isBuy: ['Buy', 'buy'].includes(t.action ?? ''),
    isSell: ['Sell', 'sell'].includes(t.action ?? ''),
  }));

  // For each month, compute cumulative invested amount at that month's end
  const data = months.map((m) => {
    let invested = 0;
    for (const t of tradeList) {
      if (t.date <= m.endDate) {
        if (t.isBuy) invested += t.amount;
        else if (t.isSell) invested = Math.max(0, invested - t.amount);
      }
    }
    // March = FY end (month index 2)
    const isFYEnd = m.endDate.getMonth() === 2;
    return { label: m.label, value: invested, benchmark: 0, isFYEnd };
  });

  return NextResponse.json({ data });
}
