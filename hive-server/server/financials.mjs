// Company financials for the Nifty 500: latest quarter's sales / profit / EPS with growth, plus annual growth,
// ROCE, ROE and debt. Source is Yahoo's fundamentals timeseries (the same numbers companies file with the
// exchange, reshaped; NSE's own results feed is about two years out of date so it can't be used).
// One request per company, cached on disk, built in the background like the scanner snapshot.
import fs from "node:fs";
import path from "node:path";
import * as breadth from "./breadth.mjs";

const CACHE_FILE = path.join(process.env.QT_DATA_DIR || "data", "financials-cache.json");
const TTL = 12 * 3600e3; // results change a few times a year; half a day is plenty
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const Q = ["TotalRevenue", "NetIncome", "DilutedEPS", "OperatingIncome"].map((t) => "quarterly" + t);
const A = ["TotalRevenue", "NetIncome", "DilutedEPS", "EBIT", "TotalDebt", "StockholdersEquity", "TotalAssets", "CurrentLiabilities"].map((t) => "annual" + t);
const DAY = 86400e3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (x, d = 1) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const crore = (v) => (v == null ? null : round(v / 1e7, 1)); // Yahoo reports rupees

let coolUntil = 0;
async function timeseries(symbol) {
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}.NS?type=${[...Q, ...A].join(",")}&period1=1420070400&period2=${Math.floor(Date.now() / 1000) + 5 * 86400}&merge=false`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = coolUntil - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429 || r.status >= 500) {
        coolUntil = Date.now() + 3000 * (attempt + 1);
        continue;
      }
      if (!r.ok) return null; // not listed on Yahoo
      const j = await r.json();
      const out = {};
      for (const x of j?.timeseries?.result || []) {
        const key = x.meta?.type?.[0];
        out[key] = (x[key] || [])
          .map((e) => ({ t: Date.parse(e.asOfDate), v: e.reportedValue?.raw }))
          .filter((e) => Number.isFinite(e.t) && Number.isFinite(e.v))
          .sort((a, b) => a.t - b.t);
      }
      return out;
    } catch {
      coolUntil = Date.now() + 2000;
    }
  }
  return null;
}

// The point in a series about `days` before `t` (within `tol` days), or null.
const near = (series, t, days, tol) => series?.find((e) => Math.abs(t - e.t - days * DAY) <= tol * DAY) ?? null;
const growth = (now, then) => (now != null && then != null && then > 0 ? round((now / then - 1) * 100) : null); // undefined from a loss
const cagr = (now, then, years) => (now != null && then != null && now > 0 && then > 0 ? round(((now / then) ** (1 / years) - 1) * 100) : null);

function compute(ts) {
  const rev = ts[Q[0]], ni = ts[Q[1]], eps = ts[Q[2]], op = ts[Q[3]];
  if (!rev?.length) return null;
  const last = rev[rev.length - 1];
  const same = (s) => s?.find((e) => e.t === last.t)?.v ?? null; // the same quarter in another series
  const nowRev = last.v, nowNi = same(ni), nowEps = same(eps), nowOp = same(op);
  const prevQ = { rev: near(rev, last.t, 91, 12)?.v, ni: near(ni, last.t, 91, 12)?.v, eps: near(eps, last.t, 91, 12)?.v };
  const prevY = { rev: near(rev, last.t, 365, 20)?.v, ni: near(ni, last.t, 365, 20)?.v, eps: near(eps, last.t, 365, 20)?.v };

  // Annual: growth over the last year and compound growth over three, return on capital, debt.
  const aRev = ts[A[0]], aNi = ts[A[1]], aEps = ts[A[2]];
  const fy = aRev?.[aRev.length - 1];
  const sameFy = (s) => (fy ? s?.find((e) => e.t === fy.t)?.v ?? null : null);
  const back = (s, days, tol) => (fy ? near(s, fy.t, days, tol)?.v ?? null : null);
  const ebit = sameFy(ts[A[3]]), debt = sameFy(ts[A[4]]), equity = sameFy(ts[A[5]]), assets = sameFy(ts[A[6]]), curLiab = sameFy(ts[A[7]]);
  const fyNi = sameFy(aNi);
  const capital = assets != null && curLiab != null ? assets - curLiab : null;

  return {
    qDate: last.t,
    rev: crore(nowRev),
    ni: crore(nowNi),
    eps: round(nowEps, 2),
    opm: nowOp != null && nowRev > 0 ? round((nowOp / nowRev) * 100) : null,
    npm: nowNi != null && nowRev > 0 ? round((nowNi / nowRev) * 100) : null,
    revQoQ: growth(nowRev, prevQ.rev),
    niQoQ: growth(nowNi, prevQ.ni),
    epsQoQ: growth(nowEps, prevQ.eps),
    revYoY: growth(nowRev, prevY.rev),
    niYoY: growth(nowNi, prevY.ni),
    epsYoY: growth(nowEps, prevY.eps),
    turnaround: nowNi != null && nowNi > 0 && ((prevQ.ni != null && prevQ.ni <= 0) || (prevY.ni != null && prevY.ni <= 0)), // loss last time, profit now
    // A swing this big usually means a merger, demerger or restated quarter rather than business growth.
    jump: [growth(nowRev, prevQ.rev), growth(nowRev, prevY.rev)].some((g) => g != null && Math.abs(g) > 100),
    fyDate: fy?.t ?? null,
    fyRev: crore(fy?.v),
    fyNi: crore(fyNi),
    revG1: growth(fy?.v, back(aRev, 365, 20)),
    revG3: cagr(fy?.v, back(aRev, 3 * 365, 40), 3),
    niG1: growth(fyNi, back(aNi, 365, 20)),
    niG3: cagr(fyNi, back(aNi, 3 * 365, 40), 3),
    epsG3: cagr(sameFy(aEps), back(aEps, 3 * 365, 40), 3),
    roce: ebit != null && capital > 0 ? round((ebit / capital) * 100) : null,
    roe: fyNi != null && equity > 0 ? round((fyNi / equity) * 100) : null,
    de: debt != null && equity > 0 ? round(debt / equity, 2) : null,
  };
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
        await sleep(120);
      }
    }),
  );
  return out;
}

const st = { at: 0, data: null, running: null, done: 0, total: 0, error: null };

async function build() {
  const rows = await breadth.constituentRows("NIFTY500");
  st.total = rows.length;
  st.done = 0;
  const out = await pool(
    rows,
    4,
    async (r) => {
      const ts = await timeseries(r.symbol);
      const c = ts && compute(ts);
      if (!c) return null;
      const lender = /financial/i.test(r.industry); // banks and lenders: debt and capital employed mean something else
      return { s: r.symbol, name: r.name, industry: r.industry, ...c, ...(lender ? { roce: null, de: null } : {}), lender };
    },
    () => st.done++,
  );
  const stocks = out.filter(Boolean);
  if (stocks.length < 50) throw new Error("Couldn't load enough company financials");
  const data = { count: stocks.length, members: rows.length, stocks };
  st.data = data;
  st.at = Date.now();
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ at: st.at, data }));
  } catch {
    /* cache is optional */
  }
  return data;
}

function refresh() {
  st.running ||= build()
    .catch((e) => {
      st.error = e.message;
      throw e;
    })
    .finally(() => (st.running = null));
  return st.running;
}

// Never makes the caller wait on the full build: progress while loading, the saved copy while refreshing.
export function financials() {
  if (!st.data) {
    try {
      const saved = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      if (saved?.data?.stocks?.length) (st.data = saved.data), (st.at = saved.at);
    } catch {
      /* no cache yet */
    }
  }
  if (!st.data || Date.now() - st.at > TTL) refresh().catch(() => {});
  if (!st.data) return { loading: true, done: st.done, total: st.total, error: st.error };
  return { ...st.data, at: st.at, refreshing: Boolean(st.running), loading: false };
}
