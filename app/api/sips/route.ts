import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_sips')
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
  const { fund_name, fund_code, amount, debit_date, start_date, lump_sum, lump_sums } = body;

  // A fund entry is valid with either a recurring SIP amount or at least one
  // lumpsum contribution (e.g. a lumpsum-only fund with no monthly debit).
  const hasLumpSum = Number(lump_sum ?? 0) > 0 || (Array.isArray(lump_sums) && lump_sums.length > 0);
  if (!fund_name || (!amount && !hasLumpSum)) {
    return NextResponse.json({ error: 'fund_name and either amount or a lump sum are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('user_sips')
    .insert({
      user_id: session.userId,
      fund_name,
      fund_code: fund_code ?? null,
      amount: Number(amount),
      debit_date: debit_date ?? null,
      start_date: start_date ?? null,
      lump_sum: Number(lump_sum ?? 0),
      lump_sums: lump_sums ?? [],
      status: 'active',
      total_invested: 0,
      current_value: 0,
      units: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
