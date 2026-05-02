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

const FALLBACK = [
  { symbol: 'NIFTY 50',     price: 22147.20, change:  0.85 },
  { symbol: 'SENSEX',       price: 73088.33, change:  0.72 },
  { symbol: 'NIFTY MIDCAP', price: 47312.15, change:  1.10 },
  { symbol: 'NIFTY SMALLCAP', price: 16823.40, change: -0.35 },
  { symbol: 'S&P 500',      price:  5243.30, change:  0.28 },
  { symbol: 'DOW JONES',    price: 39112.60, change:  0.14 },
  { symbol: 'NASDAQ',       price: 16340.87, change:  0.52 },
  { symbol: 'NIKKEI 225',   price: 38905.00, change: -0.43 },
  { symbol: 'FTSE 100',     price:  7987.40, change:  0.18 },
  { symbol: 'HANG SENG',    price: 17453.10, change: -0.61 },
  { symbol: 'BRENT CRUDE',  price:    87.42, change: -0.72 },
  { symbol: 'GOLD',         price:  2342.10, change:  0.31 },
  { symbol: 'USD/INR',      price:    83.42, change:  0.05 },
  { symbol: 'BITCOIN',      price: 62430.00, change:  1.84 },
];

export const revalidate = 0;

export async function GET() {
  try {
    const symbols = INDICES.map((i) => encodeURIComponent(i.yf)).join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChangePercent,shortName`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const results: any[] = json?.quoteResponse?.result ?? [];

    const tickers = INDICES.map((idx) => {
      const q = results.find((r) => r.symbol === idx.yf);
      if (!q || !q.regularMarketPrice) return null;
      return {
        symbol: idx.label,
        price: q.regularMarketPrice,
        change: q.regularMarketChangePercent ?? 0,
      };
    }).filter(Boolean);

    if (tickers.length === 0) throw new Error('No data returned');

    return NextResponse.json(tickers, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(FALLBACK, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
