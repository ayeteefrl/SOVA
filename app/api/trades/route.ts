import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_trades')
    .select('*')
    .eq('user_id', session.userId)
    .order('trade_date', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    asset_class, instrument_name, ticker, action,
    units, price, amount, trade_date, notes, rationale,
  } = body;

  if (!asset_class || !instrument_name || !action || amount === undefined) {
    return NextResponse.json({ error: 'asset_class, instrument_name, action, and amount are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('user_trades')
    .insert({
      user_id: session.userId,
      asset_class,
      instrument_name,
      ticker: ticker ?? null,
      action,
      units: units !== undefined ? Number(units) : null,
      price: price !== undefined ? Number(price) : null,
      amount: Number(amount),
      trade_date: trade_date ?? new Date().toISOString(),
      notes: notes ?? null,
      rationale: rationale ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
