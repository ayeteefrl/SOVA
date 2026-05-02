import { NextRequest, NextResponse } from 'next/server';

const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://finance.yahoo.com',
  Referer: 'https://finance.yahoo.com/',
};

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim();
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  try {
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

    // Sparkline: last N close prices (filter nulls)
    const closes: number[] = (quotes.close ?? [])
      .filter((v: any) => v != null)
      .map((v: number) => +v.toFixed(2));

    // Compute change vs previous close
    const price: number | null = meta.regularMarketPrice ?? null;
    const prevClose: number | null = meta.chartPreviousClose ?? null;
    const change = price != null && prevClose != null ? +(price - prevClose).toFixed(2) : null;
    const changePct =
      price != null && prevClose != null && prevClose !== 0
        ? +((price - prevClose) / prevClose * 100).toFixed(2)
        : null;

    const stock = {
      symbol: meta.symbol ?? symbol,
      shortName: meta.shortName ?? meta.longName ?? symbol,
      longName: meta.longName ?? meta.shortName ?? symbol,
      exchange: meta.fullExchangeName ?? meta.exchangeName ?? '',
      currency: meta.currency ?? 'INR',
      quoteType: meta.instrumentType ?? 'EQUITY',
      // Price
      price,
      previousClose: prevClose,
      change,
      changePercent: changePct,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      open: meta.regularMarketPrice ?? null,
      volume: meta.regularMarketVolume ?? null,
      avgVolume: null,
      // Fundamentals (not in chart endpoint — show null gracefully)
      marketCap: null,
      trailingPE: null,
      forwardPE: null,
      eps: null,
      dividendYield: null,
      beta: null,
      // 52-week
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      // Sector
      sector: '',
      industry: '',
      // Sparkline
      sparkline: closes,
    };

    return NextResponse.json({ stock });
  } catch (err) {
    console.error('[api/stock]', err);
    return NextResponse.json({ error: 'Data unavailable' }, { status: 200 });
  }
}
