import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { isPAN, isMobile } from '@/lib/cas-client';

const MFCENTRAL_BASE = process.env.MFCENTRAL_BASE_URL ?? 'https://api.mfcentral.com/v1';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { pan, mobile, provider = 'mfcentral' } = body as {
    pan: string;
    mobile: string;
    provider?: string;
  };

  if (!pan || !isPAN(pan)) {
    return NextResponse.json(
      { error: 'Invalid PAN. Must be 10 characters (e.g. ABCDE1234F).' },
      { status: 400 },
    );
  }
  if (!mobile || !isMobile(mobile)) {
    return NextResponse.json(
      { error: 'Invalid mobile number. Must be a 10-digit Indian mobile starting with 6–9.' },
      { status: 400 },
    );
  }

  if (provider === 'mfcentral') {
    const clientId = process.env.MFCENTRAL_CLIENT_ID;
    const clientSecret = process.env.MFCENTRAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'MFCentral credentials not configured. Add MFCENTRAL_CLIENT_ID and MFCENTRAL_CLIENT_SECRET to .env.local.' },
        { status: 503 },
      );
    }

    let res: Response;
    try {
      res = await fetch(`${MFCENTRAL_BASE}/auth/otp/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': clientId,
          'X-Client-Secret': clientSecret,
        },
        body: JSON.stringify({ pan: pan.toUpperCase().trim(), mobile: mobile.trim() }),
      });
    } catch {
      return NextResponse.json({ error: 'Could not reach MFCentral. Check your network or MFCENTRAL_BASE_URL.' }, { status: 502 });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'OTP request failed' }));
      return NextResponse.json({ error: err.message ?? 'Failed to send OTP' }, { status: 502 });
    }

    const data = await res.json();
    const maskedMobile = data.maskedMobile ?? `${mobile.slice(0, 2)}XXXXXX${mobile.slice(-2)}`;
    return NextResponse.json({ requestId: data.requestId, maskedMobile });
  }

  if (provider === 'setu_aa') {
    // Setu AA uses a redirect-based consent flow, not a simple OTP.
    // Follow the integration tutorial to wire up the full consent URL flow.
    return NextResponse.json(
      { error: 'Setu AA provider is not yet configured. See the integration tutorial in SETUP_GUIDE.md.' },
      { status: 501 },
    );
  }

  return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
}
