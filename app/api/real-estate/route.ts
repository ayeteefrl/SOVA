import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_real_estate')
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
  const {
    name, property_type, location, purchase_price, current_value,
    rental_yield, area, area_unit, purchase_date, emi, loan_outstanding,
    tenant_name, lease_expiry, floors, facing, last_valuation_date,
  } = body;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('user_real_estate')
    .insert({
      user_id: session.userId,
      name,
      property_type: property_type ?? 'Residential',
      location: location ?? null,
      purchase_price: Number(purchase_price ?? 0),
      current_value: Number(current_value ?? 0),
      rental_yield: Number(rental_yield ?? 0),
      area: area ? Number(area) : null,
      area_unit: area_unit ?? 'sqft',
      purchase_date: purchase_date ?? null,
      emi: Number(emi ?? 0),
      loan_outstanding: Number(loan_outstanding ?? 0),
      tenant_name: tenant_name ?? null,
      lease_expiry: lease_expiry ?? null,
      floors: floors ?? null,
      facing: facing ?? null,
      last_valuation_date: last_valuation_date ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
