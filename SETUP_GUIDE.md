# SOVA Setup Guide: Email Service & Password Reset

This guide walks you through setting up the email service for password resets and configuring all required environment variables.

## Step 1: Install Required Dependencies

Run this in the `finance-portfolio/` directory:

```bash
cd "Claude Code Folder/sova finance-portfolio"
npm install resend bcryptjs
npm install --save-dev @types/bcryptjs
```

## Step 2: Set Up Resend (Free Email Service)

Resend is a free email service perfect for transactional emails like password resets. Free tier includes 100 emails/day.

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email
4. Navigate to **API Keys** in the dashboard
5. Click **Create API Key**
6. Copy the API key (looks like `re_xxxxxxxxxxxx`)

## Step 3: Update Local Environment Variables

Create or update `.env.local` in the `finance-portfolio/` directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email Service
RESEND_API_KEY=re_xxxxxxxxxxxx

# App URL (for password reset links)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For production (Vercel):**
- `NEXT_PUBLIC_APP_URL=https://yourdomain.com`

## Step 4: Add Resend Domain (Optional but Recommended)

By default, Resend sends from `noreply@resend.dev`. To send from `noreply@sova.finance`:

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `sova.finance`)
3. Follow DNS setup instructions (add TXT records to your domain registrar)
4. Once verified, Resend will automatically use your domain

For now, you can test with the default `noreply@resend.dev` sender.

## Step 5: Deploy to Vercel

When you push to GitHub, Vercel will need the same environment variables:

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your SOVA project
3. Click **Settings → Environment Variables**
4. Add these variables:
   - `RESEND_API_KEY` (paste your Resend API key)
   - `NEXT_PUBLIC_APP_URL` (set to your production domain, e.g., `https://project-xyz.vercel.app`)
   - Keep Supabase keys from before (should already be there)

5. Redeploy: Click **Deployments → Redeploy** on latest commit

## Step 6: Test Password Reset Flow Locally

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000/login

3. Click "Forgot password?"

4. Enter your test account email

5. Check your email inbox for the reset link (may take 10-30 seconds)

6. Click the reset link, which will take you to `/reset-password?token=...`

7. Enter a new password (8+ characters) and confirm

8. You'll see a success message and redirect to login

9. Log in with your new password

## Step 7: Monitor Email Delivery

In the Resend dashboard, you can see:
- **Emails** tab: View all sent emails, delivery status, opens, and clicks
- **Failed emails**: Troubleshoot any delivery issues

Common reasons for failures:
- Email domain not verified (if using custom domain)
- API key is wrong or revoked
- Recipient email invalid

## Step 8: Future Enhancements

### Clean Up Expired Tokens (Optional)

Add a cron job to clean up old password reset tokens. Create `app/api/cron/cleanup-tokens/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  // Verify request is from Vercel Cron (check authorization header if needed)
  const now = new Date().toISOString();
  
  await supabase
    .from('password_reset_tokens')
    .delete()
    .lt('expires_at', now);

  return NextResponse.json({ success: true });
}
```

Then in `vercel.json`, add:
```json
{
  "crons": [{
    "path": "/api/cron/cleanup-tokens",
    "schedule": "0 2 * * *"
  }]
}
```

This runs daily at 2 AM UTC to remove expired tokens.

### Custom Email Sender Domain

Once you verify a domain in Resend, update the `from` address in `/api/auth/forgot-password/route.ts`:
```typescript
from: 'noreply@yourdomain.com',
```

## Troubleshooting

### "RESEND_API_KEY is not defined"
- Check `.env.local` has `RESEND_API_KEY=re_...`
- Restart dev server: `Ctrl+C` then `npm run dev`
- For Vercel: confirm environment variables are set in Vercel dashboard and redeploy

### "Email not received"
- Check Resend dashboard **Emails** tab to see if it was sent
- Look in spam/promotions folder
- If status is "Failed" in Resend, see the error message

### "Invalid or expired token"
- Token expires 1 hour after reset email sent
- Reset request again if more than 1 hour has passed

### "Password must be at least 8 characters"
- Ensure new password is 8+ characters
- Both password fields must match

## Next: Real-Time Market Data (Optional)

If you want real-time stock prices via WebSocket (instead of 30-second polls), see the Kite WebSocket guide below.

---

# Kite WebSocket Integration for Real-Time Prices

This is optional but recommended for live price updates.

## Overview

Currently, custom holdings get live prices via a 30-second poll to `/api/stock` (Yahoo Finance REST). For real-time updates, use Zerodha Kite's WebSocket API.

## Best Free Option: Zerodha Kite WebSocket

**Why Kite?**
- Real-time tick data (sub-second latency)
- You already have Zerodha integration
- Free with a Kite account
- Official API with excellent docs

**Cost:** Free (only pay when you trade)

## Architecture

```
Browser
  ↓ (WebSocket via Next.js)
Server (Next.js API route)
  ↓ (WebSocket)
Zerodha Kite API
  ↓ (tick data)
Server (broadcasts to all connected clients)
  ↓ (WebSocket)
Browser (receives price updates)
```

## Step 1: Create WebSocket Proxy

Create `app/api/kite/ws/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';

const server = new WebSocketServer({ noServer: true });
let kiteWs: any = null;
const subscribers = new Set<any>();

export async function GET(req: NextRequest) {
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response('Upgrade header missing', { status: 400 });
  }

  // Create a new WebSocket connection to Zerodha Kite
  // Implementation depends on your Kite session token
  
  // For now, return a placeholder
  return new Response('WebSocket not yet implemented', { status: 501 });
}
```

**Note:** Full implementation requires:
- Retrieving Kite access token from your session
- Connecting to `wss://ws.zerodha.net/` with credentials
- Subscribing to instrument tokens (NIFTY, SENSEX, specific stocks)
- Broadcasting prices to all connected browser clients

## Step 2: Update HoldingsContext to Use WebSocket (Optional)

Replace the 30-second HTTP poll with WebSocket:

```typescript
useEffect(() => {
  const ws = new WebSocket('ws://localhost:3000/api/kite/ws');
  
  ws.onmessage = (event) => {
    const { instrument_token, last_price } = JSON.parse(event.data);
    // Update holdings with new price
  };
  
  return () => ws.close();
}, []);
```

## Step 3: Register Instruments

Add this to HoldingsContext to subscribe to Kite ticks:

```typescript
function getKiteInstrumentTokens(holdings: Holding[]): number[] {
  // Map tickers to Kite instrument tokens
  // RELIANCE = 738561, TCS = 2953217, etc.
  const tokenMap = { /* ... */ };
  return holdings
    .map((h) => tokenMap[h.ticker])
    .filter(Boolean);
}
```

## Resources

- [Zerodha Kite WebSocket Docs](https://kiteconnect.readthedocs.io/)
- [Kite Instrument Tokens](https://api.kite.trade/instruments) (CSV download)
- [Kite Python Client](https://github.com/zerodha/pykite) (reference for request format)

## When to Implement

- **Not needed now**: Email service works, you have polling fallback
- **Nice to have**: Real-time updates for live portfolio tracking
- **Implement when**: You notice 30-second delay is problematic or need sub-second updates

For now, the 30-second HTTP poll is sufficient and less complex.

---

## Summary

✅ **Email Service**: Configured with Resend  
✅ **Password Reset**: Full flow (request → email → reset → login)  
✅ **Live Prices**: 30-second polling (sufficient for now)  
⏳ **Real-Time Prices**: WebSocket setup documented, not required yet

Your app is now production-ready for authentication and password recovery!
