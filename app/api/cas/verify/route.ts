import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import type { CASHolding } from '@/lib/cas-client';

const MFCENTRAL_BASE = process.env.MFCENTRAL_BASE_URL ?? 'https://api.mfcentral.com/v1';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { requestId, otp, provider = 'mfcentral' } = body as {
    requestId: string;
    otp: string;
    provider?: string;
  };

  if (!requestId || !otp) {
    return NextResponse.json({ error: 'requestId and otp are required' }, { status: 400 });
  }

  if (provider === 'mfcentral') {
    const clientId = process.env.MFCENTRAL_CLIENT_ID;
    const clientSecret = process.env.MFCENTRAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'MFCentral credentials not configured' }, { status: 503 });
    }

    // Step 1: Exchange OTP → access token
    let tokenRes: Response;
    try {
      tokenRes = await fetch(`${MFCENTRAL_BASE}/auth/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
          'X-Client-Secret': clientSecret,
        },
        body: JSON.stringify({ requestId, otp }),
      });
    } catch {
      return NextResponse.json({ error: 'Could not reach MFCentral.' }, { status: 502 });
    }

    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP. Please try again.' },
        { status: 400 },
      );
    }

    const { accessToken, pan, name, email } = await tokenRes.json();

    // Step 2: Fetch consolidated portfolio (full CAS)
    let casRes: Response;
    try {
      casRes = await fetch(`${MFCENTRAL_BASE}/portfolio/consolidated`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Client-Id': clientId,
        },
      });
    } catch {
      return NextResponse.json({ error: 'Failed to reach MFCentral portfolio endpoint.' }, { status: 502 });
    }

    if (!casRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch portfolio data from MFCentral.' },
        { status: 502 },
      );
    }

    const casData = await casRes.json();

    // Normalize MFCentral folio shape → CASHolding[]
    // MFCentral field names vary slightly by API version — this handles common variants.
    const holdings: CASHolding[] = (casData.folios ?? casData.portfolio ?? [])
      .map((f: Record<string, unknown>) => ({
        isin: String(f.isin ?? ''),
        name: String(f.scheme_name ?? f.scheme ?? ''),
        amc: String(f.amc_name ?? f.amc ?? ''),
        folio: String(f.folio_no ?? f.folio ?? ''),
        units: Number(f.balance_units ?? f.units) || 0,
        nav: Number(f.nav) || 0,
        value: Number(f.current_value ?? f.market_value) || 0,
        costValue: Number(f.invested_value ?? f.purchase_cost ?? f.cost_value) || 0,
        assetType: 'MF' as const,
        purchaseDate: String(f.first_purchase_date ?? f.purchase_date ?? ''),
      }))
      .filter((h: CASHolding) => h.units > 0 && h.name);

    return NextResponse.json({ holdings, pan, name: name ?? null, email: email ?? null });
  }

  return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
}
