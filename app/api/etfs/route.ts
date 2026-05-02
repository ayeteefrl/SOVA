import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_etfs')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, ticker, units, avg_cost, current_price, expense_ratio, theme } = body;

  if (!name || !ticker) {
    return NextResponse.json({ error: 'name and ticker are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('user_etfs')
    .insert({
      user_id: session.userId,
      name,
      ticker,
      units: Number(units ?? 0),
      avg_cost: Number(avg_cost ?? 0),
      current_price: current_price ? Number(current_price) : null,
      expense_ratio: Number(expense_ratio ?? 0),
      theme: theme ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
