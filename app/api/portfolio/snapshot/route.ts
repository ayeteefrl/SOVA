import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// POST — save today's portfolio snapshot (called once per day from the client)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { net_worth, total_invested, equity_value, mf_value, etf_value } = await req.json();

    if (typeof net_worth !== 'number') {
      return NextResponse.json({ error: 'net_worth required' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Upsert — one row per user per day
    await supabase.from('portfolio_snapshots').upsert({
      user_id: session.userId,
      snapshot_date: today,
      net_worth,
      total_invested: total_invested ?? 0,
      equity_value: equity_value ?? 0,
      mf_value: mf_value ?? 0,
      etf_value: etf_value ?? 0,
    }, { onConflict: 'user_id,snapshot_date' });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Snapshot error:', err);
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
  }
}

// GET — return snapshots for the performance chart
// ?daily=true  → one point per day (for 1M/3M/1Y/TTM chart)
// ?months=N    → look back N months of data (default 24)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ data: [] });
    }

    const url = new URL(req.url);
    const months = parseInt(url.searchParams.get('months') ?? '24');
    const daily = url.searchParams.get('daily') === 'true';

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const { data: rows } = await supabase
      .from('portfolio_snapshots')
      .select('snapshot_date, net_worth, total_invested')
      .eq('user_id', session.userId)
      .gte('snapshot_date', since.toISOString().slice(0, 10))
      .order('snapshot_date', { ascending: true });

    if (!rows?.length) {
      return NextResponse.json({ data: [] });
    }

    if (daily) {
      // Return one data point per day
      const data = rows.map((row) => {
        const d = new Date(row.snapshot_date + 'T00:00:00');
        const day = d.getDate();
        const monthName = d.toLocaleString('en', { month: 'short' }).toUpperCase();
        const yearSuffix = String(d.getFullYear()).slice(2);
        return {
          label: `${day} ${monthName} '${yearSuffix}`,
          value: Number(row.net_worth),
          benchmark: 0,
          isFYEnd: d.getMonth() === 2,
          date: row.snapshot_date,
        };
      });
      return NextResponse.json({ data });
    }

    // Monthly grouping — take the last snapshot of each month
    const byMonth = new Map<string, { label: string; value: number; benchmark: number; isFYEnd: boolean }>();
    for (const row of rows) {
      const d = new Date(row.snapshot_date + 'T00:00:00');
      const monthName = d.toLocaleString('en', { month: 'short' }).toUpperCase();
      const yearSuffix = String(d.getFullYear()).slice(2);
      const key = `${monthName} '${yearSuffix}`;
      byMonth.set(key, {
        label: key,
        value: Number(row.net_worth),
        benchmark: 0,
        isFYEnd: d.getMonth() === 2,
      });
    }

    return NextResponse.json({ data: Array.from(byMonth.values()) });
  } catch (err) {
    console.error('Snapshot GET error:', err);
    return NextResponse.json({ data: [] });
  }
}
