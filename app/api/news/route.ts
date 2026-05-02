import { NextResponse } from 'next/server';

const FEEDS = [
  { url: 'https://economictimes.indiatimes.com/markets/rss.cms', source: 'Economic Times', category: 'Markets' },
  { url: 'https://www.business-standard.com/rss/markets-106.rss', source: 'Business Standard', category: 'Markets' },
  { url: 'https://www.livemint.com/rss/markets', source: 'Mint', category: 'Markets' },
  { url: 'https://economictimes.indiatimes.com/markets/stocks/news/rss.cms', source: 'ET Markets', category: 'Equity' },
  { url: 'https://economictimes.indiatimes.com/markets/mutual-funds/rss.cms', source: 'ET MF', category: 'Macro' },
  { url: 'https://feeds.feedburner.com/ndtvprofit-latest', source: 'NDTV Profit', category: 'Markets' },
  { url: 'https://feeds.reuters.com/reuters/businessNews', source: 'Reuters', category: 'Global' },
  { url: 'https://rss.app/feeds/MqKiJxrPULM2uFPH.xml', source: 'Moneycontrol', category: 'Markets' },
];

function extractText(raw: string): string {
  // strip CDATA wrapper
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  const text = cdata ? cdata[1] : raw;
  return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function getTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? extractText(m[1]) : '';
}

function parseItems(xml: string, source: string, category: string) {
  const items: {
    id: string;
    headline: string;
    source: string;
    category: string;
    summary: string;
    url: string;
    publishedAt: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    tickers: string[];
  }[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const raw = m[1];
    const headline = getTag(raw, 'title');
    const summary = getTag(raw, 'description');
    const url = getTag(raw, 'link') || getTag(raw, 'guid');
    const pubDate = getTag(raw, 'pubDate');

    if (!headline || headline.length < 4) continue;

    // basic sentiment from keywords
    const lower = (headline + ' ' + summary).toLowerCase();
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (/surge|jump|rally|gain|rise|soar|profit|growth|up|high|record|bull/.test(lower)) sentiment = 'bullish';
    else if (/fall|drop|crash|loss|decline|down|slump|risk|concern|weak|bear/.test(lower)) sentiment = 'bearish';

    // extract ticker-like strings (2-6 uppercase letters)
    const tickerMatches = headline.match(/\b([A-Z]{2,6})\b/g) ?? [];
    const knownTickers = ['NIFTY', 'SENSEX', 'BANKNIFTY', 'TCS', 'HDFC', 'INFY', 'RELIANCE', 'ICICI', 'SBI', 'RBI', 'SEBI'];
    const tickers = tickerMatches.filter(t => knownTickers.includes(t)).slice(0, 3);

    items.push({
      id: `${source}-${Buffer.from(headline).toString('base64').slice(0, 12)}`,
      headline: headline.slice(0, 180),
      source,
      category,
      summary: summary.slice(0, 320) || headline,
      url: url.replace(/^.*?(https?:\/\/)/, '$1'),
      publishedAt: pubDate,
      sentiment,
      tickers,
    });

    if (items.length >= 5) break; // max 5 per feed
  }
  return items;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return 'Recently';
  }
}

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, source, category }) => {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SovaBot/1.0)',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        next: { revalidate: 300 }, // cache 5 minutes
      });
      if (!res.ok) throw new Error(`${source} ${res.status}`);
      const xml = await res.text();
      return parseItems(xml, source, category);
    }),
  );

  const all: ReturnType<typeof parseItems> = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // de-dupe by headline similarity, sort by recency
  const seen = new Set<string>();
  const deduped = all.filter((item) => {
    const key = item.headline.slice(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // sort: most recent first
  deduped.sort((a, b) => {
    const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bt - at;
  });

  const output = deduped.slice(0, 30).map((item) => ({
    ...item,
    time: timeAgo(item.publishedAt),
  }));

  return NextResponse.json({ articles: output, fetchedAt: new Date().toISOString() });
}
