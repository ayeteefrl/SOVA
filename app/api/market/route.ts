import { NextResponse } from 'next/server';

const INDICES = [
  { yf: '^NSEI',      label: 'NIFTY 50' },
  { yf: '^BSESN',     label: 'SENSEX' },
  { yf: '^CNXMIDCAP', label: 'NIFTY MIDCAP' },
  { yf: '^CNXSC',     label: 'NIFTY SMALLCAP' },
  { yf: '^GSPC',      label: 'S&P 500' },
  { yf: '^DJI',       label: 'DOW JONES' },
  { yf: '^IXIC',      label: 'NASDAQ' },
  { yf: '^N225',      label: 'NIKKEI 225' },
  { yf: '^FTSE',      label: 'FTSE 100' },
  { yf: '^HSI',       label: 'HANG SENG' },
  { yf: 'BZ=F',       label: 'BRENT CRUDE' },
  { yf: 'GC=F',       label: 'GOLD' },
  { yf: 'INR=X',      label: 'USD/INR' },
  { yf: 'BTC-USD',    label: 'BITCOIN' },
];

const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
};

export const revalidate = 0;

async function fetchSymbol(idx: { yf: string; label: string }) {
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
      : (meta.regularMarketChangePercent ?? 0);

  return { symbol: idx.label, price, change };
}

export async function GET() {
  const results = await Promise.allSettled(INDICES.map(fetchSymbol));

  const tickers = results
    .map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.warn(`[api/market] failed for ${INDICES[i].yf}:`, (r as PromiseRejectedResult).reason?.message);
      return null;
    })
    .filter(Boolean);

  return NextResponse.json(tickers, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
