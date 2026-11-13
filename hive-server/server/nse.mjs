// NSE's own public data: bulk / block / short deals, corporate announcements and the board-meeting
// (results) calendar. These are the same JSON feeds nseindia.com's pages use. They need a browser
// User-Agent and a Referer, they throttle bursts (403/429/503), and they only ever return public filings,
// so everything is cached and a stale copy is served if NSE is briefly unreachable.
import fs from "node:fs";
import path from "node:path";
import * as breadth from "./breadth.mjs";

const BASE = "https://www.nseindia.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const DEALS_DIR = path.join(process.env.QT_DATA_DIR || "data", "deals");
const IST = 5.5 * 3600e3;
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

// ---------- dates (NSE works in India time) ----------
const pad = (n) => String(n).padStart(2, "0");
const istParts = (ms) => new Date(ms + IST);
const dmy = (ms) => {
  const d = istParts(ms);
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
};
const isoDay = (ms) => istParts(ms).toISOString().slice(0, 10);
// "11-Nov-2026 02:35:39" or "09-NOV-2026" -> epoch ms
export function parseStamp(s) {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s || "");
  if (!m) return null;
  const mo = MON.indexOf(m[2].toLowerCase());
  if (mo < 0) return null;
  return Date.UTC(+m[3], mo, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - IST;
}

// ---------- fetching ----------
let coolUntil = 0; // one pause shared by every request after NSE pushes back

async function nseJson(pathAndQuery) {
  let lastErr = "NSE didn't answer";
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = coolUntil - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const r = await fetch(BASE + pathAndQuery, {
        headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", Referer: `${BASE}/` },
        signal: AbortSignal.timeout(45000),
      });
      const text = await r.text();
      // A block page comes back as HTML (sometimes with a 200), real data starts with [ or {.
      if (r.ok && /^\s*[[{]/.test(text)) return JSON.parse(text);
      lastErr = `NSE returned HTTP ${r.status}`;
      coolUntil = Date.now() + 4000 * (attempt + 1);
    } catch (e) {
      lastErr = e.message || lastErr;
      coolUntil = Date.now() + 2000 * (attempt + 1);
    }
  }
  throw Object.assign(new Error(`Couldn't read ${pathAndQuery.split("?")[0]} from NSE: ${lastErr}`), { upstream: true });
}

// Per-key cache. Concurrent callers share one fetch; on failure the last good copy is returned.
const store = new Map();
async function cached(key, ttl, fn) {
  const hit = store.get(key);
  if (hit?.value && Date.now() - hit.at < ttl) return hit.value;
  if (hit?.promise) return hit.promise;
  const entry = hit || {};
  store.set(key, entry);
  entry.promise = fn()
    .then((value) => {
      entry.value = value;
      entry.at = Date.now();
      return value;
    })
    .catch((e) => {
      if (entry.value) return entry.value;
      throw e;
    })
    .finally(() => (entry.promise = null));
  return entry.promise;
}

// Which filings belong to Nifty 500 companies (the rest are the long tail of listed companies).
async function n500() {
  try {
    return new Set((await breadth.constituentRows("NIFTY500")).map((r) => r.symbol.toUpperCase()));
  } catch {
    return new Set();
  }
}

// ---------- bulk / block / short deals ----------
// NSE publishes only the latest session. Each one is saved to data/deals/ so the history builds up from here.
async function fetchDeals() {
  const j = await nseJson("/api/snapshot-capital-market-largedeal");
  const asOn = parseStamp(j.as_on_date);
  const norm = (kind) => (x) => {
    const qty = Number(x.qty);
    const price = x.watp == null || x.watp === "" ? NaN : Number(x.watp); // short-selling rows carry a quantity only
    return {
      kind,
      date: parseStamp(x.date) ?? asOn,
      symbol: x.symbol,
      name: x.name,
      client: x.clientName || "",
      side: String(x.buySell || "").toUpperCase(),
      qty: Number.isFinite(qty) ? qty : 0,
      price: Number.isFinite(price) ? price : null,
      valueCr: Number.isFinite(qty) && Number.isFinite(price) ? round((qty * price) / 1e7, 2) : null, // ₹ crore
      remarks: x.remarks && x.remarks !== "-" ? x.remarks : "",
    };
  };
  const rows = [...(j.BULK_DEALS_DATA || []).map(norm("bulk")), ...(j.BLOCK_DEALS_DATA || []).map(norm("block")), ...(j.SHORT_DEALS_DATA || []).map(norm("short"))];
  if (asOn && rows.length) {
    try {
      fs.mkdirSync(DEALS_DIR, { recursive: true });
      fs.writeFileSync(path.join(DEALS_DIR, `${isoDay(asOn)}.json`), JSON.stringify({ asOn, rows }));
    } catch {
      /* history is optional */
    }
  }
  return { asOn, rows };
}

export async function deals(days = 1) {
  const latest = await cached("deals", 10 * 60e3, fetchDeals);
  const [inN500, saved] = [await n500(), readSavedDeals()];
  const byDay = new Map(saved.map((d) => [d.asOn, d]));
  byDay.set(latest.asOn, latest);
  const picked = [...byDay.values()].sort((a, b) => b.asOn - a.asOn).slice(0, Math.max(1, Math.min(30, days)));
  const rows = picked.flatMap((d) => d.rows).map((r) => ({ ...r, n500: inN500.has(String(r.symbol).toUpperCase()) }));
  return { asOn: latest.asOn, days: picked.map((d) => d.asOn), historyDays: byDay.size, rows };
}

function readSavedDeals() {
  try {
    return fs
      .readdirSync(DEALS_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .slice(-30)
      .map((f) => JSON.parse(fs.readFileSync(path.join(DEALS_DIR, f), "utf8")));
  } catch {
    return [];
  }
}

// ---------- corporate announcements ----------
export async function announcements({ days = 2, symbol = "" } = {}) {
  const d = Math.max(1, Math.min(7, Math.floor(days) || 1));
  const sym = String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9&-]/g, "");
  const now = Date.now();
  const from = dmy(now - (d - 1) * 86400e3);
  const to = dmy(now);
  const raw = await cached(`ann|${from}|${to}|${sym}`, 5 * 60e3, () => nseJson(`/api/corporate-announcements?index=equities&from_date=${from}&to_date=${to}${sym ? `&symbol=${encodeURIComponent(sym)}` : ""}`));
  const inN500 = await n500();
  const seen = new Set();
  const rows = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const id = x.seq_id || `${x.symbol}|${x.an_dt}|${x.desc}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      t: parseStamp(x.an_dt),
      symbol: x.symbol,
      name: x.sm_name || x.symbol,
      category: x.desc || "Other",
      text: x.attchmntText || "",
      file: x.attchmntFile && /^https?:\/\//.test(x.attchmntFile) ? x.attchmntFile : "",
      size: x.fileSize || "",
      n500: inN500.has(String(x.symbol).toUpperCase()),
    });
  }
  rows.sort((a, b) => (b.t ?? 0) - (a.t ?? 0));
  return { from, to, count: rows.length, rows };
}

// ---------- shareholding pattern (promoter vs public, quarter on quarter) ----------
// One bulk call per quarter returns every company's filing, so three calls cover the whole market.
const MONTH_ENDS = [[2, 31], [5, 30], [8, 30], [11, 31]]; // Mar, Jun, Sep, Dec (month index, last day)
const quarterEnd = (year, i) => Date.UTC(year, MONTH_ENDS[i][0], MONTH_ENDS[i][1]) - IST;

// Latest quarter whose filings are all due (21 days after quarter end), then 1 and 4 quarters before it.
function quarters(now = Date.now()) {
  const list = [];
  for (let y = istParts(now).getUTCFullYear() + 1; y >= istParts(now).getUTCFullYear() - 2; y--) for (let i = 3; i >= 0; i--) list.push(quarterEnd(y, i));
  const cur = list.findIndex((q) => now >= q + 21 * 86400e3);
  return { cur: list[cur], prev: list[cur + 1], yoy: list[cur + 4] };
}

async function quarterFilings(q) {
  const from = dmy(q + 86400e3);
  const to = dmy(Math.min(Date.now(), q + 120 * 86400e3));
  const raw = await nseJson(`/api/corporate-share-holdings-master?index=equities&from_date=${from}&to_date=${to}`);
  const out = new Map();
  for (const x of Array.isArray(raw) ? raw : []) {
    if (!x.symbol || isoDay(parseStamp(x.date) ?? 0) !== isoDay(q)) continue; // other quarters filed late in this window
    const promoter = Number(x.pr_and_prgrp), pub = Number(x.public_val);
    if (!Number.isFinite(promoter) || !Number.isFinite(pub)) continue;
    const filed = parseStamp(x.broadcastDate) ?? 0;
    const have = out.get(x.symbol);
    if (!have || filed > have.filed) out.set(x.symbol, { name: x.name, promoter, pub, filed }); // a later filing is a revision
  }
  return out;
}

async function buildShareholding() {
  const q = quarters();
  const [cur, prev, yoy] = [await quarterFilings(q.cur), await quarterFilings(q.prev), await quarterFilings(q.yoy)];
  const inN500 = await n500();
  const rows = [...cur].map(([symbol, c]) => {
    const p = prev.get(symbol), y = yoy.get(symbol);
    return {
      symbol,
      name: c.name,
      promoter: round(c.promoter),
      prevPromoter: p ? round(p.promoter) : null,
      chg: p ? round(c.promoter - p.promoter) : null, // percentage points vs the previous quarter
      chgYoY: y ? round(c.promoter - y.promoter) : null,
      public: round(c.pub),
      filed: c.filed,
      n500: inN500.has(symbol.toUpperCase()),
    };
  });
  const data = { quarter: q.cur, prevQuarter: q.prev, yoyQuarter: q.yoy, count: rows.length, rows };
  try {
    fs.writeFileSync(path.join(process.env.QT_DATA_DIR || "data", "shareholding-cache.json"), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* cache is optional */
  }
  return data;
}

export async function shareholding() {
  return cached("shareholding", 6 * 3600e3, async () => {
    // Restart-proof: reuse the saved copy if it is fresh and for the same quarter.
    try {
      const saved = JSON.parse(fs.readFileSync(path.join(process.env.QT_DATA_DIR || "data", "shareholding-cache.json"), "utf8"));
      if (Date.now() - saved.at < 6 * 3600e3 && saved.data.quarter === quarters().cur) return saved.data;
    } catch {
      /* none yet */
    }
    return buildShareholding();
  });
}

// ---------- substantial stake changes (SEBI takeover rules, Reg 29 disclosures) ----------
export async function stakeChanges({ days = 30 } = {}) {
  const d = Math.max(1, Math.min(90, Math.floor(days) || 30));
  const now = Date.now();
  const from = dmy(now - d * 86400e3);
  const to = dmy(now);
  const raw = await cached(`sast|${from}|${to}`, 15 * 60e3, () => nseJson(`/api/corporate-sast-reg29?index=equities&from_date=${from}&to_date=${to}`));
  const inN500 = await n500();
  const num = (v) => (v == null || v === "" || v === "-" || !Number.isFinite(Number(v)) ? null : Number(v));
  const rows = (raw?.data || [])
    .map((x) => ({
      t: parseStamp(x.timestamp || x.sysTime),
      symbol: x.symbol,
      name: x.company,
      acquirer: x.acquirerName,
      promoter: x.promoterType === "Y",
      side: /sale|sell|dispos/i.test(x.acqSaleType || "") ? "SELL" : "BUY",
      mode: x.acquisitionMode || "",
      shares: num(x.noOfShareAcq) ?? num(x.noOfShareSale),
      pctAfter: num(x.totAftShare), // % of the company held after the change
      file: x.attachement && /^https?:\/\//.test(x.attachement) ? x.attachement : "",
      n500: inN500.has(String(x.symbol).toUpperCase()),
    }))
    .filter((r) => r.symbol && r.t != null)
    .sort((a, b) => b.t - a.t);
  return { from, to, count: rows.length, rows };
}

// ---------- board-meeting calendar (results dates and other meetings) ----------
export async function calendar({ days = 14 } = {}) {
  const d = Math.max(1, Math.min(45, Math.floor(days) || 14));
  const now = Date.now();
  const from = dmy(now);
  const to = dmy(now + d * 86400e3);
  const raw = await cached(`cal|${from}|${to}`, 30 * 60e3, () => nseJson(`/api/event-calendar?index=equities&from_date=${from}&to_date=${to}`));
  const inN500 = await n500();
  const rows = (Array.isArray(raw) ? raw : [])
    .map((x) => ({ symbol: x.symbol, name: x.company, purpose: x.purpose || "", desc: x.bm_desc || "", date: parseStamp(x.date), n500: inN500.has(String(x.symbol).toUpperCase()) }))
    .filter((r) => r.date != null)
    .sort((a, b) => a.date - b.date || a.symbol.localeCompare(b.symbol));
  return { from, to, count: rows.length, rows };
}
