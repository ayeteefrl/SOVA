import { NextRequest, NextResponse } from 'next/server';
import { getStockSnapshot, getTickerDetails, getDailyBars } from '@/lib/massive-client';

const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
};

/** True for Indian-exchange suffixed symbols: RELIANCE.NS, HDFCBANK.BO, etc. */
function isIndianSymbol(symbol: string): boolean {
  return /\.(NS|BO|BSE|NSE)$/i.test(symbol);
}

/** YYYY-MM-DD string N days ago */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

// ─── Massive path (US stocks) ─────────────────────────────────────────────────
async function fromMassive(symbol: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [snapshot, details, bars] = await Promise.all([
    getStockSnapshot(symbol),
    getTickerDetails(symbol),
    getDailyBars(symbol, daysAgo(14), today, 10),
  ]);

  if (!snapshot) return null; // ticker not on Massive → fall through to YF

  const price = snapshot.day?.c ?? snapshot.lastTrade?.p ?? null;
  const prevClose = snapshot.prevDay?.c ?? null;
  const sparkline = bars.map((b) => +b.c.toFixed(2)).filter((c) => c > 0);

  return {
    symbol: snapshot.ticker,
    shortName: details?.name ?? symbol,
    longName: details?.name ?? symbol,
    exchange: details?.primary_exchange ?? '',
    currency: 'USD',
    quoteType: details?.type ?? 'EQUITY',
    // Price
    price,
    previousClose: prevClose,
    change: snapshot.todaysChange ?? null,
    changePercent: snapshot.todaysChangePerc ?? null,
    dayHigh: snapshot.day?.h ?? null,
    dayLow: snapshot.day?.l ?? null,
    open: snapshot.day?.o ?? null,
    volume: snapshot.day?.v ?? null,
    avgVolume: null,
    // Fundamentals from ticker details (no P/E — Massive doesn't provide live ratios)
    marketCap: details?.market_cap ?? null,
    trailingPE: null,
    forwardPE: null,
    eps: null,
    dividendYield: null,
    beta: null,
    // 52-week (not in snapshot; would need separate range call)
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    // Classification
    sector: details?.sic_description ?? '',
    industry: details?.sic_description ?? '',
    description: details?.description ?? '',
    // Sparkline from daily bars
    sparkline,
    // Source tag (used by UI to show "Powered by Massive")
    dataSource: 'massive' as const,
  };
}

// ─── Yahoo Finance path (Indian stocks + Massive fallback) ────────────────────
async function fromYahooFinance(symbol: string) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=5d&region=IN&includePrePost=false&events=div%2Csplit&corsDomain=finance.yahoo.com`;

  const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`chart ${res.status}`);

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('no result');

  const meta = result.meta ?? {};
  const quotes = result.indicators?.quote?.[0] ?? {};

  const closes: number[] = (quotes.close ?? [])
    .filter((v: unknown) => v != null)
    .map((v: number) => +v.toFixed(2));

  const price: number | null = meta.regularMarketPrice ?? null;
  const prevClose: number | null = meta.chartPreviousClose ?? null;
  const change = price != null && prevClose != null ? +(price - prevClose).toFixed(2) : null;
  const changePct =
    price != null && prevClose != null && prevClose !== 0
      ? +((price - prevClose) / prevClose * 100).toFixed(2)
      : null;

  return {
    symbol: meta.symbol ?? symbol,
    shortName: meta.shortName ?? meta.longName ?? symbol,
    longName: meta.longName ?? meta.shortName ?? symbol,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? '',
    currency: meta.currency ?? 'INR',
    quoteType: meta.instrumentType ?? 'EQUITY',
    price,
    previousClose: prevClose,
    change,
    changePercent: changePct,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    open: meta.regularMarketPrice ?? null,
    volume: meta.regularMarketVolume ?? null,
    avgVolume: null,
    marketCap: null,
    trailingPE: null,
    forwardPE: null,
    eps: null,
    dividendYield: null,
    beta: null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    sector: '',
    industry: '',
    description: '',
    sparkline: closes,
    dataSource: 'yahoo' as const,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim();
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  try {
    // US stocks → try Massive first (richer fundamentals, reliable data)
    // Indian stocks always go to Yahoo Finance
    if (!isIndianSymbol(symbol)) {
      const massiveData = await fromMassive(symbol);
      if (massiveData) {
        return NextResponse.json({ stock: massiveData });
      }
      // Massive returned null (ticker not found) — fall through to Yahoo Finance
    }

    // Indian stocks (.NS/.BO) or Massive miss → Yahoo Finance
    const yfData = await fromYahooFinance(symbol);
    return NextResponse.json({ stock: yfData });
  } catch (err) {
    console.error('[api/stock]', err);
    return NextResponse.json({ error: 'Data unavailable' }, { status: 200 });
  }
}
