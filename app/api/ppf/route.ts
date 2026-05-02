import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_ppf_contributions')
    .select('*')
    .eq('user_id', session.userId)
    .order('deposit_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { fy, deposit_date, amount, interest_for_year, closing_balance, interest_rate } = body;

  if (!fy || !deposit_date || !amount) {
    return NextResponse.json({ error: 'fy, deposit_date, and amount are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('user_ppf_contributions')
    .insert({
      user_id: session.userId,
      fy,
      deposit_date,
      amount: Number(amount),
      interest_for_year: Number(interest_for_year ?? 0),
      closing_balance: Number(closing_balance ?? 0),
      interest_rate: Number(interest_rate ?? 7.1),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
