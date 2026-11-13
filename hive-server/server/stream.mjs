// Live updates for the browser, over one websocket per tab (/stream).
//
// Client -> server  {op:"auth", token}  (first message, and again with a fresh token before it expires)
//                   {op:"sub", s, tf}   {op:"unsub", s, tf}   {op:"qsub", s:[..]}   {op:"qunsub", s:[..]}
// Server -> client  {t:"auth", exp}   {t:"bar", s, tf, bar}   {t:"quote", s, q}   {t:"status", feeds}
//
// Close codes: 4401 not authenticated / token expired (the client fetches a new token and reconnects),
// 4429 too many sockets or messages, 1001 server shutting down. A disallowed Origin is refused (403)
// before the upgrade.
//
// One upstream feed for everybody: channels ("SYM|tf") and quote subscriptions are shared and ref-counted,
// so a symbol that ten users watch is one Upstox subscription and one Binance socket.
//
// Sources, fastest first: the Upstox tick feed (Indian symbols with a token), Binance kline
// sockets (Binance spot and perps), otherwise polling the same candles the chart loaded.

import WebSocket, { WebSocketServer } from "ws";
import * as market from "./market.mjs";
import * as up from "./upstox.mjs";
import { parseTf } from "../lib/engine/series.js";
import { validSymbol, validTf } from "./guard.mjs";

const BINANCE_TF = { "1s": "1s", "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "8h": "8h", "12h": "12h", "1D": "1d", "3D": "3d", "1W": "1w", "1M": "1M" };
const PUSH_MS = 200; // at most five bar pushes a second per chart

const channels = new Map(); // "SYM|tf" -> Channel
const quoteSubs = new Map(); // symbol -> Set<client>
const lastQuote = new Map();
const vttSeen = new Map(); // Indian symbol -> last day volume, to turn it into per-bar volume

class Channel {
  constructor(symbol, tf) {
    this.symbol = symbol;
    this.tf = tf;
    this.key = `${symbol}|${tf}`;
    this.clients = new Set();
    this.bar = null;
    this.dirty = false;
    this.timer = null;
    this.start().catch((e) => console.warn(`[stream] ${this.key}: ${e.message}`));
  }

  async start() {
    const id = this.symbol;
    if (market.isIndian(id) && up.hasToken()) {
      const seed = await market.candles(id, this.tf, 2).catch(() => null);
      this.bar = seed?.candles?.at(-1) || null;
      this.exchange = seed?.meta?.exchange || id.split(":")[0];
      // Upstox caps subscriptions per connection; past our cap this chart polls like non-Indian symbols.
      if (await up.feed.subscribe(id)) {
        this.indian = true;
        return;
      }
      return this.poll();
    }
    const [ex, ticker] = id.split(":");
    if (ex === "BINANCE" && BINANCE_TF[this.tf]) {
      const perp = ticker.endsWith(".P");
      if (!(perp && this.tf === "1s")) {
        const pair = ticker.replace(/\.P$/, "").toLowerCase();
        const hosts = perp ? ["wss://fstream.binance.com/ws/"] : ["wss://stream.binance.com:9443/ws/", "wss://data-stream.binance.vision/ws/"];
        return this.binance(`${pair}@kline_${BINANCE_TF[this.tf]}`, hosts, 0);
      }
    }
    this.poll();
  }

  binance(stream, hosts, i) {
    if (this.closed) return;
    if (i >= hosts.length) return this.poll();
    let opened = false;
    const ws = new WebSocket(hosts[i] + stream);
    this.ws = ws;
    ws.on("open", () => (opened = true));
    ws.on("message", (m) => {
      const k = JSON.parse(m).k;
      if (k) this.set({ time: k.t / 1000, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v });
    });
    ws.on("error", () => {});
    ws.on("close", () => {
      if (this.closed || this.ws !== ws) return;
      if (!opened) this.binance(stream, hosts, i + 1);
      else setTimeout(() => this.binance(stream, hosts, 0), 2000);
    });
  }

  poll() {
    const crypto = /^(BINANCE|COINBASE|KRAKEN):/.test(this.symbol);
    const every = crypto ? 2000 : 5000;
    const tick = async () => {
      if (this.closed) return;
      try {
        const r = await market.candles(this.symbol, this.tf, 3);
        for (const b of r.candles) if (!this.bar || b.time >= this.bar.time) this.set(b);
      } catch {
        /* keep trying */
      }
      this.pollTimer = setTimeout(tick, every);
    };
    this.pollTimer = setTimeout(tick, 500);
  }

  // An Upstox tick: fold it into the current bar of this channel's timeframe.
  onTick(t, volDelta) {
    const time = up.istBucket(Math.floor(t.ltt / 1000), this.tf, this.exchange);
    const p = t.ltp;
    if (!this.bar || time > this.bar.time) {
      this.set({ time, open: p, high: p, low: p, close: p, volume: volDelta });
    } else if (time === this.bar.time) {
      const b = this.bar;
      this.set({ ...b, high: Math.max(b.high, p), low: Math.min(b.low, p), close: p, volume: (b.volume || 0) + volDelta });
    }
  }

  set(bar) {
    this.bar = bar;
    this.dirty = true;
    if (!this.timer) this.timer = setTimeout(() => this.flush(), PUSH_MS);
  }

  flush() {
    this.timer = null;
    if (!this.dirty || !this.bar) return;
    this.dirty = false;
    const msg = JSON.stringify({ t: "bar", s: this.symbol, tf: this.tf, bar: this.bar });
    for (const c of this.clients) if (c.readyState === WebSocket.OPEN) c.send(msg);
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearTimeout(this.pollTimer);
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.terminate();
    }
    if (this.indian) up.feed.unsubscribe(this.symbol);
  }
}

// ---------- Upstox ticks -> bars and quotes ----------
up.feed.on("tick", (t) => {
  let volDelta = 0;
  if (t.vtt != null) {
    const prev = vttSeen.get(t.id);
    if (prev != null && t.vtt >= prev) volDelta = t.vtt - prev;
    vttSeen.set(t.id, t.vtt);
  }
  for (const ch of channels.values()) if (ch.symbol === t.id && ch.indian) ch.onTick(t, volDelta);
  if (quoteSubs.has(t.id)) {
    const q = {
      price: t.ltp,
      change: t.cp ? t.ltp - t.cp : null,
      changePct: t.cp ? ((t.ltp - t.cp) / t.cp) * 100 : null,
      bid: t.bid,
      ask: t.ask,
      volume: t.vtt,
      live: true,
    };
    pushQuote(t.id, q);
  }
});
up.feed.on("status", () => broadcastStatus());

function pushQuote(symbol, q) {
  lastQuote.set(symbol, q);
  const msg = JSON.stringify({ t: "quote", s: symbol, q });
  for (const c of quoteSubs.get(symbol) || []) if (c.readyState === WebSocket.OPEN) c.send(msg);
}

// Symbols without a tick feed get their quotes polled together every few seconds (one poll for all users).
const quotePoller = setInterval(async () => {
  const polled = [...quoteSubs.keys()].filter((s) => !(market.isIndian(s) && up.hasToken() && up.feed.status === "live" && up.feed.has(s)));
  if (!polled.length) return;
  try {
    const qs = await market.quotes(polled);
    for (const [s, q] of Object.entries(qs)) pushQuote(s, q);
  } catch {
    /* next round */
  }
}, 4000);

// ---------- clients ----------
const clients = new Set();

function status() {
  return { upstox: up.hasToken() ? up.feed.status : "no token", market: up.feed.marketStatus };
}
function broadcastStatus() {
  const msg = JSON.stringify({ t: "status", feeds: status() });
  for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(msg);
}

async function onMessage(client, raw) {
  let m;
  try {
    m = JSON.parse(raw);
  } catch {
    return;
  }
  if (!m || typeof m !== "object") return;
  if (m.op === "auth") return authenticate(client, m.token);
  if (!client.user) return; // nothing but auth before authenticating
  if ((m.op === "sub" || m.op === "unsub") && (!validSymbol(m.s) || !validTf(m.tf))) return;
  if (m.op === "sub" || m.op === "unsub") {
    let sym, tf;
    try {
      sym = await market.resolve(m.s);
      tf = m.tf;
      parseTf(tf);
    } catch {
      return;
    }
    const key = `${sym}|${tf}`;
    if (m.op === "sub") {
      if (!client.subs.has(key) && client.subs.size >= MAX_CHARTS_PER_SOCKET) return;
      let ch = channels.get(key);
      if (!ch) channels.set(key, (ch = new Channel(sym, tf)));
      ch.clients.add(client);
      client.subs.add(key);
      if (ch.bar) client.send(JSON.stringify({ t: "bar", s: sym, tf, bar: ch.bar }));
    } else leave(client, key);
  }
  if (m.op === "qsub" || m.op === "qunsub") {
    const list = (Array.isArray(m.s) ? m.s : [m.s]).slice(0, 300);
    for (const raw of list) {
      if (!validSymbol(raw)) continue;
      const sym = await market.resolve(raw).catch(() => null);
      if (!sym) continue;
      if (m.op === "qsub") {
        if (!client.quotes.has(sym) && client.quotes.size >= MAX_QUOTES_PER_SOCKET) break;
        if (!quoteSubs.has(sym)) {
          quoteSubs.set(sym, new Set());
          if (market.isIndian(sym)) up.feed.subscribe(sym);
        }
        quoteSubs.get(sym).add(client);
        client.quotes.add(sym);
        if (lastQuote.has(sym)) client.send(JSON.stringify({ t: "quote", s: sym, q: lastQuote.get(sym) }));
      } else leaveQuote(client, sym);
    }
  }
}

function leave(client, key) {
  const ch = channels.get(key);
  client.subs.delete(key);
  if (!ch) return;
  ch.clients.delete(client);
  if (!ch.clients.size) {
    ch.close();
    channels.delete(key);
  }
}

function leaveQuote(client, sym) {
  client.quotes.delete(sym);
  const set = quoteSubs.get(sym);
  if (!set) return;
  set.delete(client);
  if (!set.size) {
    quoteSubs.delete(sym);
    if (market.isIndian(sym)) up.feed.unsubscribe(sym);
  }
}

// ---------- connections, auth and limits ----------
const MAX_SOCKETS_PER_USER = 6; // open tabs per account
const MAX_SOCKETS_PER_IP = 30;
const MAX_CHARTS_PER_SOCKET = 40; // live bar channels per tab
const MAX_QUOTES_PER_SOCKET = 400; // watchlist + favourites quotes per tab
const MSG_PER_MINUTE = 240; // client messages per socket
const AUTH_GRACE_MS = 5000; // unauthenticated sockets are closed after this
const PING_MS = 25000; // keeps proxies (Fly closes idle connections after about 60 s) from dropping sockets

const perUser = new Map(); // sub -> Set<client>
const perIp = new Map(); // ip -> open sockets
let deps = null;

function closeWith(client, code, reason) {
  try {
    client.close(code, reason);
  } catch {
    /* already closed */
  }
  setTimeout(() => client.terminate?.(), 2000).unref?.();
}

async function authenticate(client, token) {
  let claims;
  try {
    claims = await deps.verifyToken(deps.cfg.secret, token);
  } catch {
    return closeWith(client, 4401, "unauthorized");
  }
  if (client.readyState !== WebSocket.OPEN) return;
  if (client.user && client.user !== claims.sub) return closeWith(client, 4401, "unauthorized");
  if (!client.user) {
    const set = perUser.get(claims.sub) || new Set();
    if (set.size >= MAX_SOCKETS_PER_USER) return closeWith(client, 4429, "too many connections");
    set.add(client);
    perUser.set(claims.sub, set);
    client.user = claims.sub;
    clearTimeout(client.authTimer);
    clients.add(client);
    client.send(JSON.stringify({ t: "status", feeds: status() }));
  }
  // The socket lives until this token expires, unless the client re-authenticates with a fresh one.
  clearTimeout(client.expiryTimer);
  client.expiryTimer = setTimeout(() => closeWith(client, 4401, "token expired"), Math.max(0, claims.exp * 1000 - Date.now()));
  client.send(JSON.stringify({ t: "auth", exp: claims.exp }));
}

export function attach(server, d) {
  deps = d;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on("upgrade", (req, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(req.url, "http://x").pathname;
    } catch {
      /* rejected below */
    }
    const reject = (code, text) => {
      socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      socket.destroy();
    };
    if (pathname !== "/stream") return reject(404, "Not Found");
    const origin = req.headers.origin;
    if (origin && !d.cfg.origins.has(origin)) return reject(403, "Forbidden");
    const ip = d.clientIp(req, d.cfg.trustProxy);
    if ((perIp.get(ip) || 0) >= MAX_SOCKETS_PER_IP) return reject(429, "Too Many Requests");
    wss.handleUpgrade(req, socket, head, (client) => {
      perIp.set(ip, (perIp.get(ip) || 0) + 1);
      client.ip = ip;
      wss.emit("connection", client);
    });
  });

  wss.on("connection", (client) => {
    client.subs = new Set();
    client.quotes = new Set();
    client.user = null;
    client.alive = true;
    client.queue = Promise.resolve();
    client.msgs = { n: 0, reset: Date.now() + 60e3 };
    client.authTimer = setTimeout(() => closeWith(client, 4401, "unauthorized"), AUTH_GRACE_MS);
    client.on("pong", () => (client.alive = true));
    client.on("message", (raw, isBinary) => {
      if (isBinary) return closeWith(client, 1003, "text only");
      const now = Date.now();
      if (now > client.msgs.reset) client.msgs = { n: 0, reset: now + 60e3 };
      if (++client.msgs.n > MSG_PER_MINUTE) return closeWith(client, 4429, "too many messages");
      // One at a time per socket, in order: a "sub" sent right after "auth" waits for the token check.
      const text = raw.toString();
      client.queue = client.queue.then(() => onMessage(client, text)).catch(() => {});
    });
    client.on("error", () => {});
    client.on("close", () => {
      clearTimeout(client.authTimer);
      clearTimeout(client.expiryTimer);
      clients.delete(client);
      const n = (perIp.get(client.ip) || 1) - 1;
      if (n > 0) perIp.set(client.ip, n);
      else perIp.delete(client.ip);
      if (client.user) {
        const set = perUser.get(client.user);
        set?.delete(client);
        if (set && !set.size) perUser.delete(client.user);
      }
      for (const key of [...client.subs]) leave(client, key);
      for (const sym of [...client.quotes]) leaveQuote(client, sym);
    });
  });

  // Pings keep idle sockets open through proxies and reap dead ones.
  wss.pinger = setInterval(() => {
    for (const c of wss.clients) {
      if (!c.alive) {
        c.terminate();
        continue;
      }
      c.alive = false;
      try {
        c.ping();
      } catch {
        /* closing */
      }
    }
  }, PING_MS);
  return wss;
}

export function shutdown(wss) {
  clearInterval(wss?.pinger);
  clearInterval(quotePoller);
  for (const c of wss?.clients || []) closeWith(c, 1001, "server restarting");
  for (const ch of channels.values()) ch.close();
  channels.clear();
  wss?.close();
}

export const stats = () => ({ channels: [...channels.keys()], quotes: [...quoteSubs.keys()], clients: clients.size, users: perUser.size, ...status() });
