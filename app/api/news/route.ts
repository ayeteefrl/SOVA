import { NextResponse } from 'next/server';
import { getMassiveNews } from '@/lib/massive-client';
import { supabase } from '@/lib/supabase';

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

interface Article {
  id: string;
  headline: string;
  source: string;
  category: string;
  summary: string;
  url: string;
  image: string;
  publishedAt: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  tickers: string[];
}

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

// Pull the first usable image URL out of an RSS <item> block.
function getImage(raw: string): string {
  // media:content / media:thumbnail url="..."
  const media = raw.match(/<media:(?:content|thumbnail)[^>]*\burl="([^"]+)"/i);
  if (media && /\.(jpg|jpeg|png|webp|gif)/i.test(media[1])) return media[1];
  if (media) return media[1];
  // <enclosure url="..." type="image/..."> (also accept when type missing)
  const enc = raw.match(/<enclosure[^>]*\burl="([^"]+)"[^>]*>/i);
  if (enc && /\.(jpg|jpeg|png|webp|gif)/i.test(enc[1])) return enc[1];
  // <img src="..."> embedded in description / content:encoded
  const img = raw.match(/<img[^>]*\bsrc="([^"]+)"/i);
  if (img) return img[1];
  return '';
}

// Derive a meaningful category from the article text so every filter populates.
// Falls back to the feed-assigned category when nothing specific matches.
function deriveCategory(text: string, fallback: string): string {
  const t = text.toLowerCase();
  if (/\b(earnings|net profit|quarterly|q[1-4]\b|results|revenue|beats estimate|profit (rose|jump|fell|drop)|posts profit|reports profit)/.test(t)) return 'Earnings';
  if (/\b(rbi|sebi|policy|regulat|tariff|budget|tax|repo rate|central bank|government|sebi|parliament|ban on|new rule|fed |federal reserve|monetary)/.test(t)) return 'Policy';
  if (/\b(auto|pharma|banking|fmcg|metal|realty|real estate|telecom|infra|it sector|energy sector|cement|airline|aviation|oil & gas)\b/.test(t)) return 'Sector';
  if (/\b(gdp|inflation|cpi|wpi|economy|deficit|rupee|crude|currency|trade deficit|forex|interest rate)\b/.test(t)) return 'Macro';
  if (/\b(us |china|europe|global|wall street|dow|nasdaq|s&p|asian markets|hong kong|nikkei)\b/.test(t)) return 'Global';
  if (/\b(stock|share|equity|nifty|sensex|ipo|listing|buyback|dividend|fii|dii)\b/.test(t)) return 'Equity';
  return fallback || 'Markets';
}

function parseItems(xml: string, source: string, feedCategory: string): Article[] {
  const items: Article[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const raw = m[1];
    const headline = getTag(raw, 'title');
    const summary = getTag(raw, 'description');
    const url = getTag(raw, 'link') || getTag(raw, 'guid');
    const pubDate = getTag(raw, 'pubDate');
    const image = getImage(raw);

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
      category: deriveCategory(headline + ' ' + summary, feedCategory),
      summary: summary.slice(0, 320) || headline,
      url: url.replace(/^.*?(https?:\/\/)/, '$1'),
      image,
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

// ─── Massive news → same shape as RSS articles ────────────────────────────────
async function fetchMassiveArticles(): Promise<Article[]> {
  const raw = await getMassiveNews(undefined, 25);
  return raw.map((a) => {
    const lower = ((a.title ?? '') + ' ' + (a.description ?? '')).toLowerCase();
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (/surge|jump|rally|gain|rise|soar|profit|growth|record|bull/.test(lower)) sentiment = 'bullish';
    else if (/fall|drop|crash|loss|decline|slump|risk|concern|weak|bear/.test(lower)) sentiment = 'bearish';

    const headline = (a.title ?? '').slice(0, 180);
    return {
      id: `massive-${a.id}`,
      headline,
      source: a.publisher?.name ?? 'Massive',
      category: deriveCategory(headline + ' ' + (a.description ?? ''), 'Global'),
      summary: (a.description ?? headline).slice(0, 320),
      url: a.article_url ?? '',
      image: a.image_url ?? a.publisher?.logo_url ?? '',
      publishedAt: a.published_utc ?? '',
      sentiment,
      tickers: (a.tickers ?? []).slice(0, 3),
    };
  });
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// Persist captured articles so past-day tabs can show real history.
// First-capture date is preserved (ignoreDuplicates), so an article stays
// under the day it first appeared.
async function storeArticles(articles: Article[]): Promise<void> {
  if (articles.length === 0) return;
  const captured_date = todayStr();
  const rows = articles.map((a) => ({
    id: a.id,
    headline: a.headline,
    source: a.source,
    category: a.category,
    summary: a.summary,
    url: a.url,
    image: a.image,
    published_at: a.publishedAt ? new Date(a.publishedAt).toISOString() : new Date().toISOString(),
    sentiment: a.sentiment,
    tickers: a.tickers,
    captured_date,
  }));
  try {
    await supabase.from('news_articles').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  } catch {
    /* storage is best-effort — never block the live feed */
  }
}

// Return stored articles captured on a given past date.
async function fetchStoredForDate(date: string): Promise<Article[]> {
  try {
    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .eq('captured_date', date)
      .order('published_at', { ascending: false })
      .limit(80);
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id,
      headline: r.headline,
      source: r.source,
      category: r.category,
      summary: r.summary,
      url: r.url ?? '',
      image: r.image ?? '',
      publishedAt: r.published_at ?? '',
      sentiment: (r.sentiment ?? 'neutral') as Article['sentiment'],
      tickers: Array.isArray(r.tickers) ? r.tickers : [],
    }));
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  // Past-date request → serve from stored history.
  if (date && date !== todayStr()) {
    const stored = await fetchStoredForDate(date);
    const output = stored.map((item) => ({ ...item, time: timeAgo(item.publishedAt) }));
    return NextResponse.json({ articles: output, date, fetchedAt: new Date().toISOString() });
  }

  // Today / default → fetch live RSS + Massive in parallel.
  const [rssResults, massiveArticles] = await Promise.all([
    Promise.allSettled(
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
    ),
    fetchMassiveArticles(),
  ]);

  const all: Article[] = [];
  for (const r of rssResults) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  all.push(...massiveArticles);

  // de-dupe by headline similarity, sort by recency
  const seen = new Set<string>();
  const deduped = all.filter((item) => {
    const key = item.headline.slice(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bt - at;
  });

  const top = deduped.slice(0, 50);

  // Persist for date history (best-effort, fire-and-forget).
  await storeArticles(top);

  const output = top.map((item) => ({ ...item, time: timeAgo(item.publishedAt) }));

  return NextResponse.json({ articles: output, fetchedAt: new Date().toISOString() });
}
