import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

// HDFC Securities OAuth login redirect.
// Authorization URL format: verify against your app settings in developer.hdfcsec.com
// The registered redirect URL is: https://www.sova.net.in/api/hdfc/callback
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/sign-in', process.env.NEXT_PUBLIC_BASE_URL!));

  const apiKey = process.env.HDFC_API_KEY;
  const base = process.env.HDFC_API_BASE_URL;
  if (!apiKey || !base) {
    return NextResponse.json({ error: 'HDFC_API_KEY or HDFC_API_BASE_URL not configured' }, { status: 500 });
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/hdfc/callback`;

  // Build the HDFC authorization URL.
  // Verify the exact param names (apiKey / client_id, redirect_uri / redirectUrl)
  // against your app details at developer.hdfcsec.com → your app → API details.
  const authUrl = new URL(`${base}/auth/login`);
  authUrl.searchParams.set('apiKey', apiKey);
  authUrl.searchParams.set('redirect_uri', callbackUrl);

  return NextResponse.redirect(authUrl.toString());
}
