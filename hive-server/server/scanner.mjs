// Stock scanner data: one daily "snapshot" of every Nifty 500 stock (returns, moving averages, RSI,
// 52-week range, volume, relative strength against the Nifty 500) that the scanner page filters.
// Also returns for the main indices (the market dashboard). Prices come from Upstox, or Yahoo without a token.
import fs from "node:fs";
import path from "node:path";
import * as market from "./market.mjs";
import * as up from "./upstox.mjs";
import * as breadth from "./breadth.mjs";

const CACHE_FILE = path.join(process.env.QT_DATA_DIR || "data", "snapshot-cache.json");
const TTL = 30 * 60e3; // a full refresh costs ~1,500 Upstox requests against a quota of about 2,000 per 30 minutes
const PERIODS = { "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 250 };

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sma = (v, n) => (v.length >= n ? avg(v.slice(-n)) : null);
const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

function rsi(closes, n = 14) {
  if (closes.length <= n) return null;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

// Returns over each period, from the bars (oldest first).
function returns(bars) {
  const c = bars.map((b) => b.close);
  const last = c[c.length - 1];
  const at = (n) => (c.length > n ? ((last / c[c.length - 1 - n]) - 1) * 100 : null);
  const ret = { "1D": at(1) };
  for (const [k, n] of Object.entries(PERIODS)) ret[k] = at(n);
  return ret;
}

function metrics(bars) {
  const c = bars.map((b) => b.close);
  const v = bars.map((b) => b.volume || 0);
  const last = bars[bars.length - 1];
  const year = bars.slice(-250);
  const half = bars.slice(-130);
  const hi52 = Math.max(...year.map((b) => b.high));
  const lo52 = Math.min(...year.map((b) => b.low));
  const hi26 = Math.max(...half.map((b) => b.high));
  const prior = (n) => Math.max(...bars.slice(-n - 1, -1).map((b) => b.high)); // highest high before today
  // Bars since the 50-day average last crossed above the 200-day (null if it hasn't within 60 bars).
  let goldenAgo = null;
  if (c.length >= 262) {
    for (let k = 0; k < 60; k++) {
      const i = c.length - k;
      const a1 = avg(c.slice(i - 50, i)), b1 = avg(c.slice(i - 200, i));
      const a0 = avg(c.slice(i - 51, i - 1)), b0 = avg(c.slice(i - 201, i - 1));
      if (a0 <= b0 && a1 > b1) {
        goldenAgo = k;
        break;
      }
    }
  }
  const sma50 = sma(c, 50), sma200 = sma(c, 200);
  const vol20 = sma(v, 20);
  return {
    close: round(last.close),
    sma50: round(sma50),
    sma200: round(sma200),
    rsi: round(rsi(c), 1),
    vol: last.volume || 0,
    vol5: round(sma(v, 5), 0),
    vol10: round(sma(v, 10), 0),
    vol20: round(vol20, 0),
    vol50: round(sma(v, 50), 0),
    valueCr: vol20 ? round((vol20 * last.close) / 1e7, 1) : null, // average daily traded value, ₹ crore
    hi52: round(hi52),
    lo52: round(lo52),
    gap52h: round(((hi52 - last.close) / hi52) * 100), // % below the 52-week high
    gap52l: round(((last.close - lo52) / lo52) * 100), // % above the 52-week low
    gap26h: round(((hi26 - last.close) / hi26) * 100),
    // Closing above the highest high of the previous 52 weeks / 26 weeks.
    brk52: bars.length > 120 && last.close > prior(Math.min(250, bars.length - 1)),
    brk26: bars.length > 70 && last.close > prior(Math.min(130, bars.length - 1)),
    goldenAgo,
    bars: bars.length,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Daily bars for one NSE symbol, from Upstox. Upstox rate-limits bursts, and the generic fallback would
// quietly switch to Yahoo, which leaves out special sessions (Diwali Muhurat trading counts as a trading
// day on NSE) and so gives wrong 1-day returns. So retry Upstox with backoff, and only fall back as a last resort.
let coolUntil = 0; // one rate-limit pause shared by every worker
async function dailyBars(id, limit) {
  if (up.hasToken()) {
    for (let attempt = 0; attempt < 14; attempt++) {
      const wait = coolUntil - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return { ...(await up.candles(id, "1D", limit)), src: "upstox" };
      } catch (e) {
        if (e.status === 429) coolUntil = Math.max(coolUntil, Date.now() + Math.min(60e3, 4e3 * 2 ** Math.min(attempt, 4)));
        else if (e.upstream) await sleep(1000 * (attempt + 1));
        else throw e; // not listed, bad symbol...: retrying won't help
      }
    }
    // Never swap in Yahoo here: it skips special sessions (Muhurat) and would show wrong 1-day returns.
    throw new Error(`Upstox kept refusing ${id}`);
  }
  const r = await market.candles(id, "1D", limit);
  return { ...r, src: /upstox/i.test(r.provider || "") ? "upstox" : "yahoo" };
}

async function pool(items, limit, fn, tick) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]).catch(() => null);
        tick?.();
      }
    }),
  );
  return out;
}

// ---------- stock snapshot ----------
const snap = { at: 0, data: null, running: null, done: 0, total: 0, error: null };

async function build() {
  const rows = await breadth.constituentRows("NIFTY500");
  const rank = await breadth.popularity();
  snap.total = rows.length + 1;
  snap.done = 0;
  const tick = () => snap.done++;
  const bench = await dailyBars("NSE:NIFTY500", 300).then((r) => returns(r.candles)).catch(() => null);
  tick();
  const out = await pool(
    rows,
    4,
    async (r) => {
      const res = await dailyBars(`NSE:${r.symbol}`, 300);
      const bars = res.candles;
      if (!bars || bars.length < 30) return null;
      const ret = returns(bars);
      const rel = {};
      for (const k of Object.keys(PERIODS)) rel[k] = ret[k] != null && bench?.[k] != null ? round(ret[k] - bench[k]) : null;
      for (const k of Object.keys(ret)) ret[k] = round(ret[k]);
      return { s: r.symbol, name: r.name, industry: r.industry, tier: rank.get(r.symbol.toUpperCase()) ?? 4, ...metrics(bars), ret, rel, t: bars[bars.length - 1].time, src: res.src };
    },
    tick,
  );
  const stocks = out.filter(Boolean);
  if (stocks.length < 20) throw new Error("Couldn't load enough price history to scan");
  const benchRounded = bench && Object.fromEntries(Object.entries(bench).map(([k, v]) => [k, round(v)]));
  const data = { universe: "NIFTY500", count: stocks.length, members: rows.length, bench: benchRounded, stocks, yahooFallback: stocks.filter((s) => s.src === "yahoo").length };
  snap.data = data;
  snap.at = Date.now();
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ at: snap.at, data }));
  } catch {
    /* cache is optional */
  }
  return data;
}

function refresh() {
  snap.running ||= build()
    .catch((e) => {
      snap.error = e.message;
      throw e;
    })
    .finally(() => (snap.running = null));
  return snap.running;
}

// Never makes the caller wait on a full scan (the proxy would time out): returns progress while loading,
// and the last good copy straight away while a fresh one is built in the background.
export function snapshot() {
  if (!snap.data) {
    try {
      const saved = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      if (saved?.data?.stocks?.length) (snap.data = saved.data), (snap.at = saved.at);
    } catch {
      /* no cache yet */
    }
  }
  const age = Date.now() - snap.at;
  if (!snap.data || age > TTL) refresh().catch(() => {});
  if (!snap.data) return { loading: true, done: snap.done, total: snap.total, error: snap.error };
  return { ...snap.data, at: snap.at, refreshing: Boolean(snap.running), loading: false };
}

// ---------- indices ----------
export const INDICES = [
  ["Broad market", [["NSE:NIFTY", "Nifty 50"], ["BSE:SENSEX", "Sensex"], ["NSE:NIFTYNXT50", "Nifty Next 50"], ["NSE:NIFTY100", "Nifty 100"], ["NSE:NIFTY200", "Nifty 200"], ["NSE:NIFTY500", "Nifty 500"], ["NSE:NIFTYLARGEMID250", "Nifty LargeMidcap 250"], ["NSE:NIFTYMIDCAP50", "Nifty Midcap 50"], ["NSE:NIFTYMIDCAP100", "Nifty Midcap 100"], ["NSE:NIFTYMIDCAP150", "Nifty Midcap 150"], ["NSE:NIFTYSMALLCAP500", "Nifty Smallcap 500"]]],
  ["Sectors", [["NSE:BANKNIFTY", "Nifty Bank"], ["NSE:NIFTYPVTBANK", "Nifty Private Bank"], ["NSE:NIFTYPSUBANK", "Nifty PSU Bank"], ["NSE:FINNIFTY", "Nifty Financial Services"], ["NSE:NIFTYCAPITALMKT", "Nifty Capital Markets"], ["NSE:NIFTYIT", "Nifty IT"], ["NSE:NIFTYPHARMA", "Nifty Pharma"], ["NSE:NIFTYHEALTHCARE", "Nifty Healthcare"], ["NSE:NIFTYAUTO", "Nifty Auto"], ["NSE:NIFTYFMCG", "Nifty FMCG"], ["NSE:NIFTYMETAL", "Nifty Metal"], ["NSE:NIFTYREALTY", "Nifty Realty"], ["NSE:NIFTYENERGY", "Nifty Energy"], ["NSE:NIFTYOILANDGAS", "Nifty Oil & Gas"], ["NSE:NIFTYINFRA", "Nifty Infrastructure"], ["NSE:NIFTYMEDIA", "Nifty Media"], ["NSE:NIFTYCOMMODITIES", "Nifty Commodities"], ["NSE:NIFTYINDDIGITAL", "Nifty India Digital"]]],
];

let idx = { at: 0, promise: null };
export function indices() {
  if (idx.promise && Date.now() - idx.at < 5 * 60e3) return idx.promise;
  idx.at = Date.now();
  const flat = INDICES.flatMap(([group, list]) => list.map(([symbol, name]) => ({ group, symbol, name })));
  idx.promise = pool(flat, 4, async (i) => {
    const r = await dailyBars(i.symbol, 300);
    const bars = r.candles;
    if (!bars || bars.length < 3) return null;
    const ret = returns(bars);
    for (const k of Object.keys(ret)) ret[k] = round(ret[k]);
    const c = bars.map((b) => b.close);
    return { ...i, price: round(c[c.length - 1]), ret, gap52h: round((1 - c[c.length - 1] / Math.max(...bars.slice(-250).map((b) => b.high))) * 100), rsi: round(rsi(c), 1), above200: c.length >= 200 ? c[c.length - 1] > sma(c, 200) : null };
  }).then((rows) => ({ at: Date.now(), rows: rows.filter(Boolean) }));
  idx.promise.catch(() => (idx.promise = null));
  return idx.promise;
}
