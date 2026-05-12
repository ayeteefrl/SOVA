import { NextResponse } from 'next/server';
import { getAngelLoginURL } from '@/lib/angel-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.redirect(getAngelLoginURL());
}
