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
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ quotes: [] });
  }

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q,
    )}&lang=en-US&region=IN&newsCount=0&enableFuzzyQuery=false&enableCb=true&quotesCount=10`;

    const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`YF search ${res.status}`);

    const data = await res.json();
    const quotes = (data?.finance?.result?.[0]?.quotes ?? data?.quotes ?? [])
      .filter((q: any) => ['EQUITY', 'INDEX', 'ETF', 'MUTUALFUND'].includes(q.quoteType))
      .slice(0, 8)
      .map((q: any) => ({
        symbol: q.symbol,
        shortName: q.shortname ?? q.longname ?? q.symbol,
        longName: q.longname ?? q.shortname ?? q.symbol,
        exchange: q.exchange ?? '',
        quoteType: q.quoteType ?? 'EQUITY',
        sector: q.sector ?? '',
        industry: q.industry ?? '',
      }));

    return NextResponse.json({ quotes });
  } catch (err) {
    console.error('[api/search]', err);
    return NextResponse.json({ quotes: [], error: 'Search unavailable' }, { status: 200 });
  }
}
