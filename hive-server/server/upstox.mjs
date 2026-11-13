// Indian markets through Upstox: the instrument list (public), candle history and the live
// websocket feed (both need UPSTOX_ANALYTICS_TOKEN, a free read-only token valid for a year).
//
//   Symbols   NSE:RELIANCE  BSE:RELIANCE  NSE:NIFTY  NSE:BANKNIFTY  BSE:SENSEX  MCX:CRUDEOIL1!
//             NSE:NIFTY1!  (nearest future, TradingView style)  NSE:NIFTY27000CE29DEC26 (an option)
//
// Times: intraday bars are true UTC instants; daily and longer bars sit at 00:00 UTC of their IST
// date, like every other market in this app, so a daily candle is labelled with its trading day.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import protobuf from "protobufjs";
import { parseTf, resample, bucketStart } from "../lib/engine/series.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.QT_DATA_DIR || path.join(here, "..", "data");
const API = "https://api.upstox.com";
const EXCHANGES = ["NSE", "BSE", "MCX"];
const IST = 19800; // +05:30 in seconds
const token = () => (process.env.UPSTOX_ANALYTICS_TOKEN || "").trim();
export const hasToken = () => Boolean(token());

// Equity series worth charting (EQ, BE, SME...). The rest of *_EQ is bonds, T-bills, NCDs.
const EQUITY = new Set(["EQ", "BE", "SM", "ST", "BZ", "A", "B", "T", "X", "XT", "M", "MT", "Z", "ZP", "P", "IF", "MS"]);

// ---------- instruments ----------
let db = null; // { byId, byKey, list }
let loading = null;

const symbolOf = (t) => String(t).toUpperCase().replace(/\s+/g, "");

async function download(ex) {
  const file = path.join(DATA_DIR, `instruments-${ex}.json.gz`);
  let fresh = false;
  try {
    fresh = Date.now() - fs.statSync(file).mtimeMs < 20 * 3600e3;
  } catch {
    /* not downloaded yet */
  }
  if (!fresh) {
    try {
      const r = await fetch(`https://assets.upstox.com/market-quote/instruments/exchange/${ex}.json.gz`, {
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`Upstox ${ex} instrument list: HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      zlib.gunzipSync(buf); // don't replace a good copy with a broken download
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, file);
    } catch (e) {
      // An older copy (the image's seed on a fresh volume, or yesterday's download) beats no instruments.
      if (!fs.existsSync(file)) throw e;
      console.warn(`[upstox] ${e.message}; using the saved ${ex} list`);
    }
  }
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function kindOf(x) {
  if (x.instrument_type === "INDEX") return "index";
  if (x.instrument_type === "FUT") return "futures";
  if (x.instrument_type === "CE" || x.instrument_type === "PE") return "option";
  if (x.segment?.endsWith("_EQ")) return EQUITY.has(x.instrument_type) ? "stock" : null;
  if (x.instrument_type === "COM") return "commodity";
  return null;
}

export function instruments() {
  if (db) return Promise.resolve(db);
  loading ||= (async () => {
    const byId = new Map(),
      byKey = new Map(),
      list = [];
    const futs = new Map(); // "NSE:NIFTY" -> [{expiry, id}]
    const now = Date.now();
    for (const ex of EXCHANGES) {
      let rows;
      try {
        rows = await download(ex);
      } catch (e) {
        console.warn(`[upstox] ${e.message}`);
        continue;
      }
      for (const x of rows) {
        const kind = kindOf(x);
        if (!kind || (x.expiry && x.expiry < now)) continue;
        const exch = x.exchange || ex;
        const id = `${exch}:${symbolOf(x.trading_symbol)}`;
        if (byId.has(id)) continue;
        const inst = {
          id,
          key: x.instrument_key,
          exchange: exch,
          symbol: x.trading_symbol,
          name: x.short_name || x.name,
          kind,
          tick: x.tick_size ? x.tick_size / 100 : 0.05,
          lot: x.lot_size || 1,
          expiry: x.expiry || null,
          underlying: x.underlying_symbol || null,
        };
        byId.set(id, inst);
        byKey.set(inst.key, inst);
        list.push(inst);
        if (kind === "futures") {
          const root = `${exch}:${symbolOf(x.underlying_symbol || x.asset_symbol || x.name)}`;
          if (!futs.has(root)) futs.set(root, []);
          futs.get(root).push(inst);
        }
      }
    }
    // Continuous futures: NSE:NIFTY1! is the nearest expiry, NSE:NIFTY2! the next.
    for (const [root, arr] of futs) {
      arr.sort((a, b) => a.expiry - b.expiry);
      arr.slice(0, 2).forEach((f, i) => {
        const id = `${root}${i + 1}!`;
        const alias = { ...f, id, symbol: `${root.split(":")[1]}${i + 1}!`, name: `${f.name} futures (${i ? "next" : "front"} month)`, continuous: true };
        byId.set(id, alias);
        list.push(alias);
      });
    }
    db = { byId, byKey, list };
    console.log(`[upstox] ${list.length.toLocaleString()} Indian instruments loaded`);
    return db;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

const KIND_RANK = { index: 0, stock: 1, futures: 2, commodity: 3, option: 4 };
const EX_RANK = { NSE: 0, BSE: 1, MCX: 2 };

export async function search(q, limit = 30) {
  const query = symbolOf(q).replace(/^(NSE|BSE|MCX):/, "");
  const exFilter = /^(NSE|BSE|MCX):/.exec(String(q).toUpperCase())?.[1];
  if (!query) return [];
  const { list } = await instruments();
  const words = String(q).toUpperCase().replace(/^(NSE|BSE|MCX):/, "").trim().split(/\s+/);
  const scored = [];
  for (const x of list) {
    if (exFilter && x.exchange !== exFilter) continue;
    const sym = symbolOf(x.symbol);
    let score;
    if (sym === query) score = 0;
    else if (sym.startsWith(query)) score = 10 + (sym.length - query.length) / 10;
    else if (words.every((w) => String(x.name).toUpperCase().includes(w))) score = 30;
    else continue;
    // Options only match when the query looks like one (has digits), so "NIFTY" isn't 30k strikes.
    if (x.kind === "option" && !/\d/.test(query)) continue;
    score += KIND_RANK[x.kind] * 2 + EX_RANK[x.exchange] + (x.continuous ? -1.5 : 0);
    scored.push([score, x]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, limit).map(([, x]) => ({
    symbol: x.id,
    name: x.name,
    type: x.kind,
    exchange: x.exchange,
  }));
}

// Edit distance that gives up once it passes `max` (OCR slips like O/0, I/1, S/5 are one edit each).
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Match loose tickers (from a spreadsheet or OCR) to real NSE/BSE stocks and indices.
// Exact matches win; otherwise the closest spelling within a small edit distance.
export async function matchTokens(tokens) {
  const { byId, list } = await instruments();
  const pool = list.filter((x) => (x.kind === "stock" || x.kind === "index") && !x.continuous);
  return tokens.map((raw) => {
    const token = symbolOf(raw);
    const bare = token.replace(/^(NSE|BSE|MCX):/, "");
    // A name cut off in a screenshot ("HDFC…"): list every symbol that starts that way and let the user pick.
    if (/(…|\.{2,})$/.test(bare)) {
      const prefix = bare.replace(/(…|\.{2,})$/, "");
      const seen = new Map();
      for (const x of pool) {
        const sym = symbolOf(x.symbol);
        if (!sym.startsWith(prefix)) continue;
        const prev = seen.get(sym);
        if (!prev || EX_RANK[x.exchange] < EX_RANK[prev.exchange]) seen.set(sym, x);
      }
      const cands = [...seen.values()]
        .sort((a, b) => (a.kind === "stock" ? 0 : 1) - (b.kind === "stock" ? 0 : 1) || a.symbol.length - b.symbol.length || a.symbol.localeCompare(b.symbol))
        .slice(0, 60)
        .map((x) => ({ symbol: x.id, name: x.name, index: x.kind === "index" }));
      return { token, prefix: true, candidates: cands, symbol: cands.length === 1 ? cands[0].symbol : null, name: cands.length === 1 ? cands[0].name : undefined };
    }
    for (const ex of /^(NSE|BSE|MCX):/.test(token) ? [token.split(":")[0]] : ["NSE", "BSE", "MCX"]) {
      const x = byId.get(`${ex}:${bare}`);
      if (x && x.kind !== "option") return { token, symbol: x.id, name: x.name, fuzzy: false };
    }
    const max = bare.length <= 3 ? 0 : bare.length <= 5 ? 1 : 2;
    if (!max) return { token, symbol: null };
    let best = null;
    for (const x of pool) {
      const s = symbolOf(x.symbol);
      const d = editDistance(bare, s, max);
      if (d > max) continue;
      const score = d * 10 + EX_RANK[x.exchange] + (x.kind === "index" ? 1 : 0);
      if (!best || score < best.score) best = { score, x };
    }
    return best ? { token, symbol: best.x.id, name: best.x.name, fuzzy: true } : { token, symbol: null };
  });
}

export async function lookup(id) {
  const { byId } = await instruments();
  return byId.get(String(id).toUpperCase()) || null;
}

// A bare ticker someone typed ("reliance", "nifty") that's an Indian stock or index.
export async function resolveBare(input) {
  const { byId } = await instruments();
  const s = symbolOf(input);
  for (const ex of ["NSE", "BSE", "MCX"]) {
    const x = byId.get(`${ex}:${s}`);
    if (x && x.kind !== "option") return x;
  }
  return null;
}

// ---------- candles ----------
async function upstoxGet(p) {
  const r = await fetch(`${API}${p}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status === "error") {
    const msg = j.errors?.[0]?.message || `HTTP ${r.status}`;
    throw Object.assign(new Error(`Upstox: ${msg}`), { status: r.status, upstream: true });
  }
  return j.data;
}

// The native Upstox unit for a timeframe, or null to build it from a smaller one.
function nativeOf(tf) {
  const { n, unit } = parseTf(tf);
  if (unit === "m" && n <= 300) return { unit: "minutes", n, chunkDays: n <= 15 ? 28 : 88 };
  if (unit === "h" && n <= 5) return { unit: "hours", n, chunkDays: 88 };
  if (unit === "D" && n === 1) return { unit: "days", n: 1, chunkDays: 3600 };
  if (unit === "W" && n === 1) return { unit: "weeks", n: 1, chunkDays: 36500 };
  if (unit === "M" && n === 1) return { unit: "months", n: 1, chunkDays: 36500 };
  return null;
}

function baseFor(tf) {
  const { unit } = parseTf(tf);
  if (unit === "s") throw new Error("Indian markets chart from 1 minute up");
  if (unit === "h") return "1h";
  if (unit === "D" || unit === "W" || unit === "M") return "1D";
  return "1m";
}

const ymd = (ms) => new Date(ms + IST * 1000).toISOString().slice(0, 10);

function toBar(c, daily) {
  // [ "2026-10-30T09:15:00+05:30", o, h, l, c, v, oi ]
  const ms = Date.parse(c[0]);
  const time = daily ? Date.parse(String(c[0]).slice(0, 10) + "T00:00:00Z") / 1000 : ms / 1000;
  return { time, open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] || 0, oi: c[6] || 0 };
}

async function nativeCandles(inst, nat, limit) {
  const daily = ["days", "weeks", "months"].includes(nat.unit);
  const key = encodeURIComponent(inst.key);
  const seen = new Map();
  // Today's session isn't in the historical endpoint; the intraday one has it.
  if (nat.unit === "minutes" || nat.unit === "hours" || nat.unit === "days") {
    try {
      const d = await upstoxGet(`/v3/historical-candle/intraday/${key}/${nat.unit}/${nat.n}`);
      for (const c of d?.candles || []) {
        const b = toBar(c, daily);
        seen.set(b.time, b);
      }
    } catch {
      /* no session today, or not open yet */
    }
  }
  let to = Date.now();
  const earliest = Date.parse(daily ? "2000-01-01" : "2022-01-01");
  // Bars per chunk is rough (6.25h sessions, ~250 days a year); stop once there are enough.
  for (let guard = 0; guard < 40 && seen.size < limit && to > earliest; guard++) {
    const from = Math.max(earliest, to - nat.chunkDays * 86400e3);
    let d;
    try {
      d = await upstoxGet(`/v3/historical-candle/${key}/${nat.unit}/${nat.n}/${ymd(to)}/${ymd(from)}`);
    } catch (e) {
      if (seen.size) break;
      throw e;
    }
    const candles = d?.candles || [];
    for (const c of candles) {
      const b = toBar(c, daily);
      if (!seen.has(b.time)) seen.set(b.time, b);
    }
    if (!candles.length && to - from > 400 * 86400e3) break; // no older data
    to = from - 86400e3;
    if (nat.unit === "weeks" || nat.unit === "months") break;
  }
  return [...seen.values()].sort((a, b) => a.time - b.time);
}

// NSE/BSE sessions open at 09:15 IST, so intraday buckets are anchored there (TradingView does the
// same: a 1h bar runs 09:15-10:15). MCX opens at 09:00.
export function sessionAnchor(exchange) {
  return exchange === "MCX" ? 9 * 3600 : 9 * 3600 + 15 * 60;
}
export function istBucket(t, tf, exchange) {
  const { seconds, unit } = parseTf(tf);
  if (unit === "D" || unit === "W" || unit === "M") {
    const day = Math.floor((t + IST) / 86400) * 86400; // IST date at 00:00 UTC
    return unit === "D" && seconds === 86400 ? day : bucketStart(day, tf);
  }
  const local = t + IST;
  const dayStart = Math.floor(local / 86400) * 86400;
  const open = dayStart + sessionAnchor(exchange);
  const start = local >= open ? open + Math.floor((local - open) / seconds) * seconds : dayStart + Math.floor((local - dayStart) / seconds) * seconds;
  return start - IST;
}

function resampleIst(bars, tf, exchange) {
  const out = [];
  let cur = null;
  for (const b of bars) {
    const start = istBucket(b.time, tf, exchange);
    if (!cur || cur.time !== start) {
      cur = { ...b, time: start };
      out.push(cur);
    } else {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume || 0;
      cur.oi = b.oi;
    }
  }
  return out;
}

export async function candles(id, tf, limit = 1500) {
  if (!hasToken()) throw Object.assign(new Error("No Upstox token"), { noToken: true });
  const inst = await lookup(id);
  if (!inst) throw Object.assign(new Error(`Unknown Indian symbol ${id}`), { status: 404 });
  const nat = nativeOf(tf);
  let bars;
  if (nat) bars = await nativeCandles(inst, nat, limit);
  else {
    const base = baseFor(tf);
    const raw = await nativeCandles(inst, nativeOf(base), limit * Math.max(1, Math.round(parseTf(tf).seconds / parseTf(base).seconds)));
    bars = parseTf(tf).unit.match(/[DWM]/) ? resample(raw, tf) : resampleIst(raw, tf, inst.exchange);
  }
  return {
    symbol: inst.id,
    tf,
    provider: "Upstox",
    candles: bars.slice(-limit),
    notes: [],
    meta: { name: inst.name, exchange: inst.exchange, kind: inst.kind, tick: inst.tick, lot: inst.lot, key: inst.key },
  };
}

export async function quotes(ids) {
  if (!hasToken() || !ids.length) return {};
  const insts = (await Promise.all(ids.map(lookup))).filter(Boolean);
  if (!insts.length) return {};
  const out = {};
  for (let i = 0; i < insts.length; i += 500) {
    const chunk = insts.slice(i, i + 500);
    // Full quotes carry net_change against the previous session's close.
    const d = await upstoxGet(`/v2/market-quote/quotes?instrument_key=${chunk.map((x) => encodeURIComponent(x.key)).join(",")}`);
    for (const v of Object.values(d || {})) {
      const inst = chunk.find((x) => x.key === v.instrument_token);
      if (!inst) continue;
      const change = v.net_change ?? null;
      const prev = change != null ? v.last_price - change : null;
      out[inst.id] = {
        price: v.last_price,
        change,
        changePct: prev ? (change / prev) * 100 : null,
        volume: v.volume ?? null,
      };
    }
  }
  return out;
}

// ---------- live feed ----------
// One websocket for every Indian symbol anyone is watching. Emits "tick" with
// { id, ltp, ltt (ms), ltq, vtt (day volume), cp (previous close), bid, ask, oi }.
let FeedResponse = null;
async function decoder() {
  if (FeedResponse) return FeedResponse;
  const root = await protobuf.load(path.join(here, "proto", "MarketDataFeedV3.proto"));
  FeedResponse = root.lookupType("com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse");
  return FeedResponse;
}

// Upstox limits how many instruments one feed connection may subscribe to (2,000 in "full" mode at the time
// of writing). Everyone shares this one connection, so stay safely below it; past the cap, charts and quotes
// for further symbols fall back to polling (stream.mjs).
const MAX_KEYS = Math.max(1, Number(process.env.UPSTOX_MAX_SUBSCRIPTIONS) || 1500);

class UpstoxFeed extends EventEmitter {
  constructor() {
    super();
    this.keys = new Map(); // instrument_key -> refcount
    this.ws = null;
    this.status = "idle";
    this.retry = 0;
    this.marketStatus = {};
  }

  async subscribe(id) {
    if (!hasToken()) return false;
    const inst = await lookup(id);
    if (!inst) return false;
    const n = this.keys.get(inst.key) || 0;
    if (n === 0 && this.keys.size >= MAX_KEYS) return false;
    this.keys.set(inst.key, n + 1);
    if (n === 0) {
      if (this.ws?.readyState === WebSocket.OPEN) this.send("sub", [inst.key]);
      else this.connect();
    }
    return true;
  }

  async unsubscribe(id) {
    const inst = await lookup(id);
    if (!inst || !this.keys.has(inst.key)) return;
    const n = this.keys.get(inst.key) - 1;
    if (n > 0) return void this.keys.set(inst.key, n);
    this.keys.delete(inst.key);
    if (this.ws?.readyState === WebSocket.OPEN) this.send("unsub", [inst.key]);
  }

  // Is this symbol on the shared Upstox subscription? (Synchronous; false until the instrument list loads.)
  has(id) {
    const inst = db?.byId.get(String(id).toUpperCase());
    return Boolean(inst && this.keys.has(inst.key));
  }

  close() {
    this.closed = true;
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.terminate();
    } catch {
      /* gone */
    }
  }

  send(method, keys) {
    // A stale socket's "open" can fire while a newer one is still connecting; the new socket
    // re-sends every subscription when it opens, so skipping here loses nothing (and doesn't crash).
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    for (let i = 0; i < keys.length; i += 100) {
      const msg = { guid: `g${Date.now()}${i}`, method, data: { mode: "full", instrumentKeys: keys.slice(i, i + 100) } };
      if (method === "unsub") delete msg.data.mode;
      this.ws.send(Buffer.from(JSON.stringify(msg)));
    }
  }

  async connect() {
    if (this.closed) return;
    if (this.connecting || this.ws?.readyState === WebSocket.OPEN) return;
    this.connecting = true;
    try {
      await decoder();
      const r = await fetch(`${API}/v3/feed/market-data-feed/authorize`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      let url = r.headers.get("location");
      if (!url) {
        const j = await r.json().catch(() => ({}));
        url = j?.data?.authorized_redirect_uri || j?.data?.authorizedRedirectUri;
        if (!url) throw new Error(j?.errors?.[0]?.message || `authorize: HTTP ${r.status}`);
      }
      const ws = new WebSocket(url, { followRedirects: true, headers: { Authorization: `Bearer ${token()}` } });
      this.ws = ws;
      ws.on("open", () => {
        this.status = "live";
        this.retry = 0;
        this.emit("status", this.status);
        if (this.keys.size) this.send("sub", [...this.keys.keys()]);
      });
      ws.on("message", (buf) => this.onMessage(buf));
      ws.on("close", () => {
        if (this.ws !== ws) return;
        this.ws = null;
        this.status = "reconnecting";
        this.emit("status", this.status);
        if (this.keys.size) setTimeout(() => this.connect(), Math.min(30000, 1000 * 2 ** this.retry++));
      });
      ws.on("error", (e) => console.warn(`[upstox] feed: ${e.message}`));
    } catch (e) {
      this.status = `error: ${e.message}`;
      this.emit("status", this.status);
      console.warn(`[upstox] feed: ${e.message}`);
      if (this.keys.size) setTimeout(() => this.connect(), Math.min(60000, 2000 * 2 ** this.retry++));
    } finally {
      this.connecting = false;
    }
  }

  onMessage(buf) {
    let msg;
    try {
      msg = FeedResponse.toObject(FeedResponse.decode(new Uint8Array(buf)), { longs: Number, enums: String, defaults: false });
    } catch (e) {
      return console.warn(`[upstox] undecodable frame: ${e.message}`);
    }
    if (msg.marketInfo?.segmentStatus) {
      this.marketStatus = msg.marketInfo.segmentStatus;
      this.emit("market", this.marketStatus);
    }
    for (const [key, f] of Object.entries(msg.feeds || {})) {
      const inst = db?.byKey.get(key);
      if (!inst) continue;
      const m = f.fullFeed?.marketFF,
        x = f.fullFeed?.indexFF,
        g = f.firstLevelWithGreeks;
      const ltpc = f.ltpc || m?.ltpc || x?.ltpc || g?.ltpc;
      if (!ltpc?.ltp) continue;
      const depth = m?.marketLevel?.bidAskQuote?.[0] || g?.firstDepth;
      const day = (m?.marketOHLC || x?.marketOHLC)?.ohlc?.find((o) => o.interval === "1d");
      const tick = {
        key,
        ltp: ltpc.ltp,
        ltt: Number(ltpc.ltt) || Number(msg.currentTs) || Date.now(),
        ltq: Number(ltpc.ltq) || 0,
        cp: ltpc.cp,
        vtt: m?.vtt != null ? Number(m.vtt) : g?.vtt != null ? Number(g.vtt) : null,
        bid: depth?.bidP,
        ask: depth?.askP,
        oi: m?.oi ?? g?.oi,
        day,
      };
      // A continuous future (NSE:NIFTY1!) shares its contract's key, so tell every alias.
      for (const id of idsForKey(key)) this.emit("tick", { ...tick, id });
    }
  }
}

function idsForKey(key) {
  const out = [];
  for (const x of db?.list || []) if (x.key === key && (x.continuous || db.byKey.get(key) === x)) out.push(x.id);
  return out;
}

export const feed = new UpstoxFeed();

// Yahoo tickers for when there's no Upstox token (delayed, may be rate limited).
const YAHOO_INDEX = {
  "NSE:NIFTY": "^NSEI",
  "NSE:BANKNIFTY": "^NSEBANK",
  "NSE:FINNIFTY": "NIFTY_FIN_SERVICE.NS",
  "NSE:INDIAVIX": "^INDIAVIX",
  "NSE:NIFTYIT": "^CNXIT",
  "NSE:NIFTYNXT50": "^NSMIDCP",
  "NSE:NIFTYMIDCAP100": "NIFTY_MIDCAP_100.NS",
  "NSE:NIFTYAUTO": "^CNXAUTO",
  "NSE:NIFTYPHARMA": "^CNXPHARMA",
  "NSE:NIFTYFMCG": "^CNXFMCG",
  "NSE:NIFTYMETAL": "^CNXMETAL",
  "NSE:NIFTYREALTY": "^CNXREALTY",
  "NSE:NIFTYENERGY": "^CNXENERGY",
  "NSE:NIFTYPSUBANK": "^CNXPSUBANK",
  "BSE:SENSEX": "^BSESN",
};
export async function yahooTicker(id) {
  if (YAHOO_INDEX[id]) return YAHOO_INDEX[id];
  const inst = await lookup(id);
  if (!inst || inst.kind !== "stock") return null;
  return `${symbolOf(inst.symbol)}.${inst.exchange === "BSE" ? "BO" : "NS"}`;
}
