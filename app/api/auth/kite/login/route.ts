import { NextResponse } from 'next/server';
import { createKiteClient } from '@/lib/kite-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const kc = createKiteClient();
  const loginUrl = kc.getLoginURL();
  return NextResponse.redirect(loginUrl);
}
