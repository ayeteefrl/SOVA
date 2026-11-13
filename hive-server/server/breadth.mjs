// Market breadth for Indian indices: for every bar, how many constituents closed up or down and
// how much volume went with each side. Powers advance/decline and the cumulative volume index.
// Constituents come from NSE's published lists; bars from Upstox (or Yahoo without a token).
import * as market from "./market.mjs";

const LISTS = {
  NIFTY50: "ind_nifty50list",
  NIFTY100: "ind_nifty100list",
  NIFTY200: "ind_nifty200list",
  NIFTY500: "ind_nifty500list",
};
export const UNIVERSES = Object.keys(LISTS);

const members = new Map(); // universe -> { at, symbols, rows }
// Full rows from NSE's list: company name, industry and symbol (the scanner shows all three).
export async function constituentRows(universe) {
  await constituents(universe);
  return members.get(universe).rows;
}
async function constituents(universe) {
  const hit = members.get(universe);
  if (hit && Date.now() - hit.at < 24 * 3600e3) return hit.symbols;
  const file = LISTS[universe];
  if (!file) throw Object.assign(new Error(`Unknown universe ${universe}`), { status: 400 });
  let text = null;
  for (const host of ["https://archives.nseindia.com/content/indices/", "https://www.niftyindices.com/IndexConstituent/"]) {
    try {
      const r = await fetch(`${host}${file}.csv`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
      if (r.ok) {
        text = await r.text();
        break;
      }
    } catch {
      /* try the next host */
    }
  }
  if (!text) throw Object.assign(new Error(`Couldn't download the ${universe} constituent list from NSE`), { upstream: true });
  const rows = text.trim().split(/\r?\n/).slice(1);
  const symbols = rows.map((r) => r.split(",")[2]?.trim()).filter(Boolean);
  const detail = rows
    .map((r) => r.split(","))
    .filter((c) => c[2]?.trim())
    .map((c) => ({ name: c[0].replace(/^"|"$/g, "").trim(), industry: c[1]?.trim() || "", symbol: c[2].trim() }));
  members.set(universe, { at: Date.now(), symbols, rows: detail });
  return symbols;
}

// How well known each stock is, from NSE's index lists: Nifty 50 = 1, 100 = 2, 200 = 3, 500 = 4, anything else 9.
// Used to put "RELIANCE" ahead of "RELIABLE" when a name is cut off. Quietly empty if NSE can't be reached.
let popular = null;
export function popularity() {
  popular ||= (async () => {
    const rank = new Map();
    for (const [u, r] of [["NIFTY500", 4], ["NIFTY200", 3], ["NIFTY100", 2], ["NIFTY50", 1]]) {
      try {
        for (const sym of await constituents(u)) rank.set(sym.toUpperCase(), r);
      } catch {
        /* that list isn't available right now */
      }
    }
    if (!rank.size) popular = null; // try again next time
    return rank;
  })();
  return popular;
}

// Run fn over items, `limit` at a time.
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]).catch(() => null);
      }
    }),
  );
  return out;
}

const cache = new Map(); // `${universe}|${tf}` -> { at, promise }
export function breadth(universe = "NIFTY50", tf = "1D", limit = 1500) {
  const key = `${universe}|${tf}|${limit}`;
  const ttl = /[DWM]$/.test(tf) ? 15 * 60e3 : 60e3;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = (async () => {
    const symbols = await constituents(universe);
    const series = await pool(symbols, 6, (s) => market.candles(`NSE:${s}`, tf, limit));
    const byTime = new Map();
    let used = 0;
    for (const r of series) {
      const bars = r?.candles;
      if (!bars?.length) continue;
      used++;
      for (let i = 1; i < bars.length; i++) {
        const b = bars[i],
          chg = b.close - bars[i - 1].close;
        let row = byTime.get(b.time);
        if (!row) byTime.set(b.time, (row = { time: b.time, adv: 0, dec: 0, unch: 0, advVol: 0, decVol: 0 }));
        if (chg > 0) (row.adv++, (row.advVol += b.volume || 0));
        else if (chg < 0) (row.dec++, (row.decVol += b.volume || 0));
        else row.unch++;
      }
    }
    const rows = [...byTime.values()].sort((a, b) => a.time - b.time);
    return { universe, tf, members: symbols.length, loaded: used, rows };
  })();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}
