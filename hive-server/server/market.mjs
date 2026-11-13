// One door for every market: Indian symbols go to Upstox (or Yahoo without a token), everything
// else to Quant Terminal's providers (Binance, Coinbase, Kraken, Yahoo, Nasdaq, your own keys).

import * as qt from "./qt/providers.js";
import * as up from "./upstox.mjs";
import { parseTf } from "../lib/engine/series.js";

const INDIA = /^(NSE|BSE|MCX):/;
const IST = 19800;
export const isIndian = (id) => INDIA.test(String(id));

// "reliance" -> NSE:RELIANCE, "nifty" -> NSE:NIFTY, "btc" -> BINANCE:BTCUSDT, "aapl" -> US:AAPL.
// A bare ticker that NSE/BSE list is read as Indian; type US:INFY for the American listing.
export async function resolve(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) throw Object.assign(new Error("Empty symbol"), { status: 400 });
  if (INDIA.test(s)) {
    const id = s.replace(/\s+/g, "");
    if (!(await up.lookup(id))) throw Object.assign(new Error(`${id} isn't listed on Upstox`), { status: 404 });
    return id;
  }
  if (/^[A-Z0-9&-]+!?$/.test(s.replace(/\s+/g, ""))) {
    const x = await up.resolveBare(s).catch(() => null);
    if (x) return x.id;
  }
  return (await qt.resolve(s)).id;
}

export async function candles(raw, tf = "1D", limit = 1500) {
  parseTf(tf);
  const id = await resolve(raw);
  if (!isIndian(id)) return qt.getCandles(id, tf, limit);
  const inst = await up.lookup(id);
  const meta = { name: inst?.name, exchange: inst?.exchange, kind: inst?.kind, tick: inst?.tick, lot: inst?.lot };
  if (up.hasToken()) {
    try {
      return await up.candles(id, tf, limit);
    } catch (e) {
      if (!e.upstream) throw e;
      const fb = await yahooFallback(id, tf, limit, meta).catch(() => null);
      if (fb) return { ...fb, notes: [`Upstox didn't answer (${e.message}); showing Yahoo, which is delayed`] };
      throw e;
    }
  }
  const fb = await yahooFallback(id, tf, limit, meta);
  if (!fb) throw Object.assign(new Error(`${id} needs your Upstox token (add UPSTOX_ANALYTICS_TOKEN to .env.local)`), { status: 424 });
  return fb;
}

async function yahooFallback(id, tf, limit, meta) {
  const y = await up.yahooTicker(id);
  if (!y) return null;
  const r = await qt.getCandles(`YAHOO:${y}`, tf, limit);
  const daily = parseTf(tf).seconds >= 86400;
  return {
    ...r,
    symbol: id,
    provider: "Yahoo (delayed)",
    candles: daily ? r.candles.map((b) => ({ ...b, time: Math.floor((b.time + IST) / 86400) * 86400 })) : r.candles,
    notes: ["Delayed Yahoo prices. Add your Upstox token for live NSE/BSE data."],
    meta,
  };
}

export async function search(q) {
  const [india, rest] = await Promise.all([
    up.search(q, 25).catch(() => []),
    qt.search(q).catch(() => []),
  ]);
  const seen = new Set();
  // Upstox already covers NSE and BSE, so drop Yahoo's RELIANCE.NS / RELIANCE.BO duplicates.
  const yahooIndian = (r) => /^YAHOO:.+\.(NS|BO)$/i.test(r.symbol);
  return [...india, ...rest].filter((r) => !yahooIndian(r) && !seen.has(r.symbol) && seen.add(r.symbol)).slice(0, 50);
}

export async function quotes(raws) {
  const ids = await Promise.all(raws.map((s) => resolve(s).catch(() => null)));
  const india = ids.filter((x) => x && isIndian(x));
  const other = ids.filter((x) => x && !isIndian(x));
  const out = {};
  if (india.length) {
    let got = {};
    if (up.hasToken()) got = await up.quotes(india).catch(() => ({}));
    Object.assign(out, got);
    const missing = india.filter((x) => !got[x]);
    await Promise.all(
      missing.map(async (x) => {
        try {
          const r = await candles(x, "1D", 3);
          const [p, l] = r.candles.slice(-2);
          if (l) out[x] = { price: l.close, change: p ? l.close - p.close : null, changePct: p ? ((l.close - p.close) / p.close) * 100 : null, volume: l.volume };
        } catch {
          /* leave it out */
        }
      }),
    );
  }
  if (other.length) Object.assign(out, await qt.getQuotes(other).catch(() => ({})));
  return out;
}

export async function symbolInfo(raw) {
  const id = await resolve(raw);
  if (isIndian(id)) {
    const x = await up.lookup(id);
    return { symbol: id, name: x?.name, exchange: x?.exchange, type: x?.kind, tick: x?.tick, lot: x?.lot, currency: "INR", timezone: "Asia/Kolkata" };
  }
  const [exchange, ticker] = id.split(":");
  return { symbol: id, name: ticker, exchange, type: qt.kindOf(id), currency: /USDT$|USD$/.test(ticker) ? "USD" : null };
}
