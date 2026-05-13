import { NextResponse } from 'next/server';
import { getIndicesSnapshot, getCryptoSnapshot, getForexSnapshot } from '@/lib/massive-client';

// ─── Canonical display order for the ticker strip ─────────────────────────────
const TICKER_ORDER = [
  'NIFTY 50', 'SENSEX', 'NIFTY MIDCAP', 'NIFTY SMALLCAP',
  'S&P 500', 'DOW JONES', 'NASDAQ',
  'NIKKEI 225', 'FTSE 100', 'HANG SENG',
  'BRENT CRUDE', 'GOLD', 'USD/INR', 'BITCOIN',
];

// Indian + other international indices on Yahoo Finance (Massive covers US only)
const YF_INDICES = [
  { yf: '^NSEI',      label: 'NIFTY 50' },
  { yf: '^BSESN',     label: 'SENSEX' },
  { yf: '^CNXMIDCAP', label: 'NIFTY MIDCAP' },
  { yf: '^CNXSC',     label: 'NIFTY SMALLCAP' },
  { yf: '^N225',      label: 'NIKKEI 225' },
  { yf: '^FTSE',      label: 'FTSE 100' },
  { yf: '^HSI',       label: 'HANG SENG' },
  { yf: 'BZ=F',       label: 'BRENT CRUDE' },
  { yf: 'GC=F',       label: 'GOLD' },
];

// US indices via Massive — more reliable than server-side YF scraping
const MASSIVE_INDICES_MAP: Record<string, string> = {
  'I:SPX': 'S&P 500',
  'I:DJI': 'DOW JONES',
  'I:NDX': 'NASDAQ',   // NASDAQ 100
};

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
};

export const revalidate = 0;

// ─── Yahoo Finance fetcher ────────────────────────────────────────────────────
async function fetchYFSymbol(idx: { yf: string; label: string }) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idx.yf)}` +
    `?interval=1d&range=1d&region=IN&includePrePost=false&corsDomain=finance.yahoo.com`;

  const res = await fetch(url, {
    headers: YF_HEADERS,
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error('no price in meta');

  const price: number = meta.regularMarketPrice;
  const prevClose: number | null = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change =
    prevClose && prevClose !== 0
      ? +((price - prevClose) / prevClose * 100).toFixed(2)
      : +(meta.regularMarketChangePercent ?? 0).toFixed(2);

  return { symbol: idx.label, price, change };
}

// ─── Massive fetchers ─────────────────────────────────────────────────────────
async function fetchMassiveIndices(): Promise<{ symbol: string; price: number; change: number }[]> {
  try {
    const results = await getIndicesSnapshot(Object.keys(MASSIVE_INDICES_MAP));
    return results
      .filter((r) => r.session?.close != null && r.session.close > 0)
      .map((r) => ({
        symbol: MASSIVE_INDICES_MAP[r.ticker] ?? r.ticker,
        price: r.session.close,
        // changePercent from Massive indices is already in % (e.g. 0.84 = +0.84%)
        change: +((r.session.changePercent ?? 0)).toFixed(2),
      }));
  } catch {
    return [];
  }
}

async function fetchMassiveCrypto(): Promise<{ symbol: string; price: number; change: number }[]> {
  try {
    const results = await getCryptoSnapshot(['X:BTCUSD']);
    return results
      .filter((r) => r.day?.c != null && r.day.c > 0)
      .map((r) => ({
        symbol: 'BITCOIN',
        price: r.day.c,
        change: +((r.todaysChangePerc ?? 0)).toFixed(2),
      }));
  } catch {
    return [];
  }
}

async function fetchMassiveForex(): Promise<{ symbol: string; price: number; change: number }[]> {
  try {
    const results = await getForexSnapshot(['C:USDINR']);
    return results
      .filter((r) => r.day?.c != null && r.day.c > 0)
      .map((r) => ({
        symbol: 'USD/INR',
        price: r.day.c,
        change: +((r.todaysChangePerc ?? 0)).toFixed(2),
      }));
  } catch {
    return [];
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET() {
  const [yfResults, massiveIndices, massiveCrypto, massiveForex] = await Promise.all([
    Promise.allSettled(YF_INDICES.map(fetchYFSymbol)),
    fetchMassiveIndices(),
    fetchMassiveCrypto(),
    fetchMassiveForex(),
  ]);

  // Populate a label → entry map
  const dataMap = new Map<string, { symbol: string; price: number; change: number }>();

  yfResults.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      dataMap.set(r.value.symbol, r.value);
    } else {
      console.warn(
        `[api/market] YF failed for ${YF_INDICES[i].yf}:`,
        (r as PromiseRejectedResult).reason?.message,
      );
    }
  });

  // Massive entries overwrite YF on any overlap (there shouldn't be any)
  for (const t of [...massiveIndices, ...massiveCrypto, ...massiveForex]) {
    dataMap.set(t.symbol, t);
  }

  // Return in canonical order; drop any that failed entirely
  const tickers = TICKER_ORDER
    .map((label) => dataMap.get(label))
    .filter(Boolean);

  return NextResponse.json(tickers, { headers: { 'Cache-Control': 'no-store' } });
}
