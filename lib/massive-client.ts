/**
 * Massive.com (formerly Polygon.io — rebranded Oct 2025) REST API client.
 * Server-side only: uses process.env.MASSIVE_API_KEY.
 * Base URL: https://api.massive.com
 * Auth:    apiKey query parameter
 */

const MASSIVE_BASE = 'https://api.massive.com';

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const u = new URL(`${MASSIVE_BASE}${path}`);
  u.searchParams.set('apiKey', process.env.MASSIVE_API_KEY ?? '');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function mGet<T>(
  path: string,
  params: Record<string, string> = {},
  timeoutMs = 6000,
): Promise<T> {
  if (!process.env.MASSIVE_API_KEY) throw new Error('MASSIVE_API_KEY not set');
  const res = await fetch(buildUrl(path, params), {
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Massive HTTP ${res.status} — ${path}`);
  return res.json() as Promise<T>;
}

// ─── US Indices snapshot ──────────────────────────────────────────────────────
// Tickers: I:SPX (S&P 500), I:DJI (DOW), I:NDX (NASDAQ 100)
interface IndexSession {
  close: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

export interface MassiveIndexResult {
  ticker: string;
  name: string;
  session: IndexSession;
  value: number;
}

export async function getIndicesSnapshot(tickers: string[]): Promise<MassiveIndexResult[]> {
  const json = await mGet<{ results?: MassiveIndexResult[] }>(
    '/v2/snapshot/locale/us/markets/indices/tickers',
    { tickers: tickers.join(',') },
  );
  return json.results ?? [];
}

// ─── Crypto snapshot ──────────────────────────────────────────────────────────
// Tickers: X:BTCUSD, X:ETHUSD, etc.
export interface MassiveCryptoResult {
  ticker: string;
  todaysChange: number;
  todaysChangePerc: number;
  day: { o: number; h: number; l: number; c: number; v: number };
  prevDay: { c: number };
}

export async function getCryptoSnapshot(tickers: string[]): Promise<MassiveCryptoResult[]> {
  const json = await mGet<{ tickers?: MassiveCryptoResult[] }>(
    '/v2/snapshot/locale/global/markets/crypto/tickers',
    { tickers: tickers.join(',') },
  );
  return json.tickers ?? [];
}

// ─── Forex snapshot ───────────────────────────────────────────────────────────
// Tickers: C:USDINR, C:EURUSD, etc.
export interface MassiveForexResult {
  ticker: string;
  todaysChange: number;
  todaysChangePerc: number;
  day: { c: number };
  prevDay: { c: number };
}

export async function getForexSnapshot(tickers: string[]): Promise<MassiveForexResult[]> {
  const json = await mGet<{ tickers?: MassiveForexResult[] }>(
    '/v2/snapshot/locale/global/markets/forex/tickers',
    { tickers: tickers.join(',') },
  );
  return json.tickers ?? [];
}

// ─── US stock snapshot ────────────────────────────────────────────────────────
interface StockDay { o: number; h: number; l: number; c: number; v: number; vw: number }

export interface MassiveStockSnapshot {
  ticker: string;
  todaysChange: number;
  todaysChangePerc: number;
  day: StockDay;
  prevDay: StockDay;
  lastTrade: { p: number };
}

/** Returns null on any error (ticker not found, API key missing, network). */
export async function getStockSnapshot(ticker: string): Promise<MassiveStockSnapshot | null> {
  try {
    const json = await mGet<{ ticker?: MassiveStockSnapshot }>(
      `/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}`,
    );
    return json.ticker ?? null;
  } catch {
    return null;
  }
}

// ─── Historical daily bars (for sparklines) ───────────────────────────────────
export interface MassiveBar {
  o: number; h: number; l: number; c: number; v: number; t: number;
}

export async function getDailyBars(
  ticker: string,
  from: string, // YYYY-MM-DD
  to: string,   // YYYY-MM-DD
  limit = 10,
): Promise<MassiveBar[]> {
  try {
    const json = await mGet<{ results?: MassiveBar[] }>(
      `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}`,
      { adjusted: 'true', sort: 'asc', limit: String(limit) },
    );
    return json.results ?? [];
  } catch {
    return [];
  }
}

// ─── Ticker details (fundamentals) ───────────────────────────────────────────
export interface MassiveTickerDetails {
  ticker: string;
  name: string;
  description: string;
  homepage_url: string;
  market_cap: number;
  sic_description: string;
  total_employees: number;
  primary_exchange: string;
  type: string;
}

/** Returns null on any error. */
export async function getTickerDetails(ticker: string): Promise<MassiveTickerDetails | null> {
  try {
    const json = await mGet<{ results?: MassiveTickerDetails }>(
      `/v3/reference/tickers/${encodeURIComponent(ticker)}`,
      {},
      8000,
    );
    return json.results ?? null;
  } catch {
    return null;
  }
}

// ─── News ─────────────────────────────────────────────────────────────────────
export interface MassiveNewsArticle {
  id: string;
  publisher: { name: string; logo_url: string; homepage_url: string };
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  description: string;
  keywords: string[];
  amp_url: string;
  image_url: string;
}

/** Fetches global news. Optionally filtered by ticker. Returns [] on any error. */
export async function getMassiveNews(ticker?: string, limit = 20): Promise<MassiveNewsArticle[]> {
  try {
    const params: Record<string, string> = {
      limit: String(limit),
      order: 'desc',
      sort: 'published_utc',
    };
    if (ticker) params.ticker = ticker;
    const json = await mGet<{ results?: MassiveNewsArticle[] }>(
      '/v2/reference/news',
      params,
      8000,
    );
    return json.results ?? [];
  } catch {
    return [];
  }
}

// ─── Ticker search ────────────────────────────────────────────────────────────
export interface MassiveTickerMatch {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  active: boolean;
  currency_name: string;
}

/** Returns [] on any error. */
export async function searchMassiveTickers(query: string, limit = 10): Promise<MassiveTickerMatch[]> {
  try {
    const json = await mGet<{ results?: MassiveTickerMatch[] }>(
      '/v3/reference/tickers',
      { search: query, active: 'true', limit: String(limit), sort: 'ticker' },
    );
    return json.results ?? [];
  } catch {
    return [];
  }
}
