// CAMS CAS import route — forwards PDF to CASParser API (casparser.in)
// User downloads CAS PDF from mfcentral.com → Statements → CAS, enters their PAN as password

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { parseCASPDF } from '@/lib/cams-parser';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Invalid request — send as multipart/form-data' }, { status: 400 });

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided. Send the field as "file".' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 10 MB.' }, { status: 413 });
  }

  const password = (formData.get('password') as string | null) ?? undefined;
  const buffer = await file.arrayBuffer();
  const result = await parseCASPDF(buffer, password);

  if (result.holdings.length === 0) {
    return NextResponse.json({
      error: 'No holdings found in the PDF.',
      parseErrors: result.errors,
    }, { status: 422 });
  }

  // Persist parsed holdings as trades in Supabase
  const trades = result.holdings.map((h) => ({
    user_id: session.userId,
    asset_class: 'MF',
    instrument_name: h.schemeName,
    ticker: h.isin || h.schemeName,
    action: 'Buy',
    units: h.units,
    price: h.units > 0 ? (h.costValue || h.currentValue) / h.units : h.nav,
    amount: h.costValue || h.currentValue,
    trade_date: h.purchaseDate
      ? new Date(h.purchaseDate).toISOString()
      : new Date().toISOString(),
    notes: `CAMS CAS Import · ${h.amcName}${h.folioNo ? ` · Folio ${h.folioNo}` : ''}`,
    sector: 'Mutual Fund',
    source: 'cams_cas',
  }));

  const { error } = await supabase
    .from('user_trades')
    .upsert(trades, { onConflict: 'user_id,ticker,trade_date', ignoreDuplicates: true });

  if (error) {
    console.error('[CAMS Parse]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    imported: trades.length,
    investorName: result.investorName,
    pan: result.pan,
    parseErrors: result.errors,
  });
}
