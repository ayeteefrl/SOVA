// Upstox OAuth 2.0 integration
// Docs: https://upstox.com/developer/api-documentation/
// Register app: https://account.upstox.com/developer/apps
// Tokens expire daily at 3:30 AM IST

import { supabase } from './supabase';
import { encryptToken, decryptToken } from './crypto';

const UPSTOX_BASE = 'https://api.upstox.com/v2';

export function getUpstoxAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.UPSTOX_API_KEY!,
    redirect_uri: redirectUri,
    response_type: 'code',
  });
  return `${UPSTOX_BASE}/login/authorization/dialog?${params}`;
}

export async function exchangeUpstoxToken(code: string, redirectUri: string): Promise<string> {
  const res = await fetch(`${UPSTOX_BASE}/login/authorization/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.UPSTOX_API_KEY!,
      client_secret: process.env.UPSTOX_API_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Upstox token exchange failed: ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function saveUpstoxSession(userId: string, accessToken: string): Promise<void> {
  await supabase.from('broker_sessions').delete().eq('user_id', userId).eq('broker', 'upstox');
  await supabase.from('broker_sessions').insert({
    user_id: userId,
    broker: 'upstox',
    access_token: encryptToken(accessToken),
    enc_token: null,
    last_refreshed_at: new Date().toISOString(),
  });
}

export async function getUpstoxToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('broker_sessions')
    .select('access_token')
    .eq('user_id', userId)
    .eq('broker', 'upstox')
    .order('last_refreshed_at', { ascending: false })
    .limit(1);
  const token = data?.[0]?.access_token;
  return token ? decryptToken(token) : null;
}

// ─── Market data (analytics token, no per-user login) ─────────────────────────
// Server-only: UPSTOX_ANALYTICS_TOKEN is long-lived and may be shared with other
// projects, so results are cached in-process to keep upstream calls minimal.
export const UPSTOX_INDEX_KEYS: Record<string, string> = {
  'NSE_INDEX|Nifty 50': 'NIFTY 50',
  'BSE_INDEX|SENSEX': 'SENSEX',
  'NSE_INDEX|NIFTY MIDCAP 100': 'NIFTY MIDCAP',
  'NSE_INDEX|NIFTY SMLCAP 100': 'NIFTY SMALLCAP',
};

export interface UpstoxIndexQuote {
  symbol: string;
  price: number;
  change: number;
}

const INDEX_CACHE_MS = 30_000;
let indexCache: { at: number; data: UpstoxIndexQuote[] } | null = null;

export async function getUpstoxIndexQuotes(): Promise<UpstoxIndexQuote[]> {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN;
  if (!token) throw new Error('UPSTOX_ANALYTICS_TOKEN not set');
  if (indexCache && Date.now() - indexCache.at < INDEX_CACHE_MS) return indexCache.data;

  const keys = Object.keys(UPSTOX_INDEX_KEYS).join(',');
  const res = await fetch(
    `${UPSTOX_BASE.replace('/v2', '/v3')}/market-quote/ltp?instrument_key=${encodeURIComponent(keys)}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error(`Upstox market quote error: ${res.status}`);
  const json = await res.json();
  const entries = Object.values(json?.data ?? {}) as {
    last_price: number;
    cp: number;
    instrument_token: string;
  }[];

  const data: UpstoxIndexQuote[] = [];
  for (const e of entries) {
    const symbol = UPSTOX_INDEX_KEYS[e.instrument_token];
    if (!symbol || !(e.last_price > 0)) continue;
    const change = e.cp > 0 ? +(((e.last_price - e.cp) / e.cp) * 100).toFixed(2) : 0;
    data.push({ symbol, price: e.last_price, change });
  }
  if (data.length) indexCache = { at: Date.now(), data };
  return data;
}

// ─── Indian equities & ETFs (analytics token) ─────────────────────────────────
// Accepts Yahoo-style symbols (RELIANCE.NS / HDFCBANK.BO) so existing callers keep working.
async function analyticsGet<T>(path: string, revalidate = 30): Promise<T> {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN;
  if (!token) throw new Error('UPSTOX_ANALYTICS_TOKEN not set');
  const res = await fetch(`${UPSTOX_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Upstox API error: ${res.status} — ${path.split('?')[0]}`);
  const json = await res.json();
  return (json.data ?? json) as T;
}

interface UpstoxInstrument {
  name: string;
  segment: string;
  exchange: string;
  isin?: string;
  instrument_key: string;
  trading_symbol: string;
  short_name?: string;
  instrument_type: string;
}

const ETF_NAME_RE = /\b(ETF|BEES|LIQUID|GOLD ?BEES)\b/i;

/** "RELIANCE.NS" → { base: "RELIANCE", exchange: "NSE" }; no suffix defaults to NSE. */
function parseIndianSymbol(symbol: string): { base: string; exchange: 'NSE' | 'BSE' } {
  const m = symbol.trim().toUpperCase().match(/^(.+?)(?:\.(NS|NSE|BO|BSE))?$/);
  const base = m?.[1] ?? symbol.toUpperCase();
  const suffix = m?.[2];
  return { base, exchange: suffix === 'BO' || suffix === 'BSE' ? 'BSE' : 'NSE' };
}

async function searchInstruments(query: string, records = 30): Promise<UpstoxInstrument[]> {
  return analyticsGet<UpstoxInstrument[]>(
    `/instruments/search?query=${encodeURIComponent(query)}&segments=EQ&records=${records}`,
    3600,
  );
}

const instrumentCache = new Map<string, UpstoxInstrument | null>();

export async function resolveUpstoxInstrument(symbol: string): Promise<UpstoxInstrument | null> {
  const { base, exchange } = parseIndianSymbol(symbol);
  const cacheKey = `${exchange}:${base}`;
  if (instrumentCache.has(cacheKey)) return instrumentCache.get(cacheKey)!;

  const segment = exchange === 'BSE' ? 'BSE_EQ' : 'NSE_EQ';
  const results = await searchInstruments(base);
  const match = results.find((r) => r.segment === segment && r.trading_symbol.toUpperCase() === base) ?? null;
  instrumentCache.set(cacheKey, match);
  return match;
}

export interface UpstoxSearchHit {
  symbol: string;
  shortName: string;
  longName: string;
  exchange: string;
  quoteType: 'EQUITY' | 'ETF';
  sector: string;
  industry: string;
}

/** Search NSE/BSE equities and ETFs; BSE listings only appear when there is no NSE listing. */
export async function searchUpstoxEquities(query: string): Promise<UpstoxSearchHit[]> {
  const results = await searchInstruments(query);
  const nse = results.filter((r) => r.segment === 'NSE_EQ' && r.instrument_type === 'EQ');
  const nseIsins = new Set(nse.map((r) => r.isin));
  const bse = results.filter(
    (r) => r.segment === 'BSE_EQ' && !nseIsins.has(r.isin) && /^[A-Z0-9&-]+$/i.test(r.trading_symbol),
  );
  return [...nse, ...bse].slice(0, 8).map((r) => ({
    symbol: `${r.trading_symbol}${r.segment === 'BSE_EQ' ? '.BO' : '.NS'}`,
    shortName: r.short_name || r.name,
    longName: r.name,
    exchange: r.exchange,
    quoteType: ETF_NAME_RE.test(`${r.name} ${r.trading_symbol}`) ? 'ETF' : 'EQUITY',
    sector: '',
    industry: '',
  }));
}

interface UpstoxFullQuote {
  ohlc: { open: number; high: number; low: number; close: number };
  last_price: number;
  volume: number;
  net_change: number;
}

type Candle = [string, number, number, number, number, number, number];

/** Quote for an Indian equity/ETF, shaped like the /api/stock response. Returns null if unknown. */
export async function getUpstoxStock(symbol: string) {
  const inst = await resolveUpstoxInstrument(symbol);
  if (!inst) return null;

  const key = encodeURIComponent(inst.instrument_key);
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 370 * 86_400_000).toISOString().slice(0, 10);

  const [quoteMap, candleData] = await Promise.all([
    analyticsGet<Record<string, UpstoxFullQuote>>(`/market-quote/quotes?instrument_key=${key}`),
    analyticsGet<{ candles?: Candle[] }>(`/historical-candle/${key}/day/${today}/${yearAgo}`, 300).catch(
      () => ({ candles: [] as Candle[] }),
    ),
  ]);

  const q = Object.values(quoteMap)[0];
  if (!q || !(q.last_price > 0)) return null;

  const candles = candleData.candles ?? []; // newest first
  const highs = candles.map((c) => c[2]);
  const lows = candles.map((c) => c[3]);
  const sparkline = candles
    .slice(0, 5)
    .reverse()
    .map((c) => +c[4].toFixed(2));

  const price = q.last_price;
  const prevClose = +(price - q.net_change).toFixed(2);
  const changePct = prevClose ? +((q.net_change / prevClose) * 100).toFixed(2) : null;

  return {
    symbol: `${inst.trading_symbol}${inst.segment === 'BSE_EQ' ? '.BO' : '.NS'}`,
    shortName: inst.short_name || inst.name,
    longName: inst.name,
    exchange: inst.exchange,
    currency: 'INR',
    quoteType: ETF_NAME_RE.test(`${inst.name} ${inst.trading_symbol}`) ? 'ETF' : 'EQUITY',
    price,
    previousClose: prevClose,
    change: +q.net_change.toFixed(2),
    changePercent: changePct,
    dayHigh: q.ohlc?.high ?? null,
    dayLow: q.ohlc?.low ?? null,
    open: q.ohlc?.open ?? null,
    volume: q.volume ?? null,
    avgVolume: null,
    marketCap: null,
    trailingPE: null,
    forwardPE: null,
    eps: null,
    dividendYield: null,
    beta: null,
    fiftyTwoWeekHigh: highs.length ? Math.max(...highs) : null,
    fiftyTwoWeekLow: lows.length ? Math.min(...lows) : null,
    sector: '',
    industry: '',
    description: '',
    sparkline,
    dataSource: 'upstox' as const,
  };
}

export async function upstoxFetch<T>(userId: string, path: string): Promise<T> {
  const token = await getUpstoxToken(userId);
  if (!token) throw new Error('Upstox not connected');
  const res = await fetch(`${UPSTOX_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 401) throw new Error('UPSTOX_UNAUTHORIZED');
  if (!res.ok) throw new Error(`Upstox API error: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}
