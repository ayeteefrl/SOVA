// The Chart Hive data server for SOVA /charts. Every route except /api/health needs a data token issued by
// SOVA (Authorization: Bearer), and browsers are only served for ALLOWED_ORIGINS.
//   GET /api/search?q=reliance          symbols across NSE, BSE, MCX, crypto, US, forex...
//   GET /api/bars?symbol=NSE:TCS&tf=15m&limit=1500
//   GET /api/quotes?symbols=NSE:NIFTY,BINANCE:BTCUSDT
//   GET /api/match?tokens=INFY,TCS       loose tickers (spreadsheet / OCR) -> NSE/BSE symbols, one result per token
//   GET /api/symbol?symbol=NSE:TCS
//   GET /api/breadth?universe=NIFTY50&tf=1D  advancing/declining NIFTY 50/100/200/500 stocks per bar
//   GET /api/snapshot                    Nifty 500 scan data (returns, SMAs, RSI, 52-week range...) for the scanner
//   GET /api/indices                     index returns for the market dashboard
//   GET /api/deals?days=1                bulk / block / short deals from NSE (history builds up as days are saved)
//   GET /api/announcements?days=2&symbol=  corporate filings from NSE
//   GET /api/calendar?days=14            board meetings and results dates from NSE
//   GET /api/financials                  latest quarter and annual financials for the Nifty 500 (loads in the background)
//   GET /api/shareholding                promoter / public holding by company, latest quarter vs the previous and year-ago
//   GET /api/stakes?days=30              substantial stake changes (takeover-code Reg 29 filings)
//   GET /api/health                      {ok:true}, no token (for the host's health check)
//   WS  /stream                          live bars and quotes (see stream.mjs); authenticates in its first message
//
// Configuration is environment-only (see config.mjs). Run one instance: it keeps in-memory state and a single
// Upstox websocket.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Local development only: .env.local / .env next to package.json (KEY=value lines). The Docker image never
// contains these files (.dockerignore), so production settings come from the host's environment.
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no file */
  }
}

const { loadConfig } = await import("./config.mjs");
const cfg = loadConfig(process.env, root);
if (!cfg.secret) {
  console.error("[data] HIVE_TOKEN_SECRET is missing or shorter than 32 characters; refusing to start.");
  process.exit(1);
}
if (!cfg.origins.size) console.warn("[data] ALLOWED_ORIGINS is empty: browsers will be refused (CORS and websocket).");

process.env.QT_DATA_DIR = cfg.dataDir; // read by the modules below when they load
const { copySeeds } = await import("./seed.mjs");
copySeeds(cfg.seedDir, cfg.dataDir);

const market = await import("./market.mjs");
const up = await import("./upstox.mjs");
const stream = await import("./stream.mjs");
const breadth = await import("./breadth.mjs");
const scanner = await import("./scanner.mjs");
const nse = await import("./nse.mjs");
const financials = await import("./financials.mjs");
const { verifyToken, bearer } = await import("./auth.mjs");
const { clientIp, Limiter, BadInput, intParam, symbolParam, tfParam, listParam, textParam } = await import("./guard.mjs");
const { memo } = await import("./memo.mjs");

// ---------- limits ----------
// Shared Upstox quota is about 2,000 requests per 30 minutes for everyone together; see README "Limits".
const limits = {
  ip: new Limiter(600, 60e3), // all requests from one address (several users behind one NAT)
  user: new Limiter(300, 60e3), // all requests from one SOVA account
  bars: new Limiter(60, 60e3), // candle history, the expensive upstream call
  quotes: new Limiter(90, 60e3),
  search: new Limiter(300, 60e3), // watchlist import searches each unmatched token
  heavy: new Limiter(20, 60e3), // match (fuzzy over every instrument), breadth (500 stocks' candles)
};

// ---------- shared caches: identical requests from several users cause one upstream call ----------
const intraday = (tf) => !/[DWM]$/.test(tf);
const cache = {
  bars: memo("bars", { ttl: 60e3, max: 600 }),
  quotes: memo("quotes", { ttl: 3e3, max: 400 }),
  search: memo("search", { ttl: 5 * 60e3, max: 2000 }),
  match: memo("match", { ttl: 10 * 60e3, max: 500 }),
  symbol: memo("symbol", { ttl: 10 * 60e3, max: 2000 }),
};

const MATCH_TOKEN = /^[A-Za-z0-9:&\-.…_]{1,40}$/;

const routes = {
  "/api/search": async (q) => {
    const s = textParam(q, "q", 64).trim();
    return cache.search.get(s.toUpperCase(), () => market.search(s));
  },
  "/api/bars": async (q) => {
    const symbol = symbolParam(q);
    const tf = tfParam(q);
    const limit = intParam(q, "limit", { def: 1500, min: 1, max: 5000 });
    return cache.bars.get(`${symbol.toUpperCase()}|${tf}|${limit}`, () => market.candles(symbol, tf, limit), intraday(tf) ? 10e3 : 60e3);
  },
  "/api/quotes": async (q) => {
    const symbols = listParam(q, "symbols", 300);
    const key = [...new Set(symbols.map((s) => s.toUpperCase()))].sort().join(",");
    return cache.quotes.get(key, () => market.quotes(symbols));
  },
  "/api/match": async (q) => {
    // One result per token, in order: the import dialog pairs results with tokens by position.
    const tokens = (q.get("tokens") || "").slice(0, 300 * 42).split(",").filter(Boolean).slice(0, 300);
    const ok = tokens.map((t) => MATCH_TOKEN.test(t));
    const valid = tokens.filter((_, i) => ok[i]);
    const matched = await cache.match.get(valid.join(","), () => matchTokens(valid));
    let j = 0;
    return tokens.map((t, i) => (ok[i] ? matched[j++] : { token: t, symbol: null }));
  },
  "/api/symbol": async (q) => {
    const s = symbolParam(q);
    return cache.symbol.get(s.toUpperCase(), () => market.symbolInfo(s));
  },
  "/api/breadth": async (q) => {
    const universe = (q.get("universe") || "NIFTY50").toUpperCase();
    if (!["NIFTY50", "NIFTY100", "NIFTY200", "NIFTY500"].includes(universe)) throw new BadInput("Unknown universe");
    // breadth.mjs caches per universe|tf|limit; the client never sends a limit, so it is fixed here to keep
    // one shared computation per universe and timeframe.
    return breadth.breadth(universe, tfParam(q), 1500);
  },
  "/api/snapshot": async () => scanner.snapshot(),
  "/api/indices": async () => scanner.indices(),
  "/api/deals": async (q) => nse.deals(intParam(q, "days", { def: 1, min: 1, max: 30 })),
  "/api/announcements": async (q) =>
    nse.announcements({ days: intParam(q, "days", { def: 2, min: 1, max: 7 }), symbol: symbolParam(q, "symbol", { required: false }) }),
  "/api/calendar": async (q) => nse.calendar({ days: intParam(q, "days", { def: 14, min: 1, max: 45 }) }),
  "/api/financials": async () => financials.financials(),
  "/api/shareholding": async () => nse.shareholding(),
  "/api/stakes": async (q) => nse.stakeChanges({ days: intParam(q, "days", { def: 30, min: 1, max: 90 }) }),
};

// Which extra bucket a route draws from, on top of the per-IP and per-user buckets.
const ROUTE_BUCKET = { "/api/bars": "bars", "/api/quotes": "quotes", "/api/search": "search", "/api/match": "heavy", "/api/breadth": "heavy" };

async function matchTokens(tokens) {
  const out = await up.matchTokens(tokens);
  // For names cut off in a screenshot, put the well-known stocks first.
  if (out.some((r) => r.prefix)) {
    const rank = await breadth.popularity();
    const score = (c) => (c.index ? 1.5 : (rank.get(c.symbol.split(":")[1]) ?? 9));
    for (const r of out)
      if (r.prefix) {
        r.candidates = r.candidates.sort((a, b) => score(a) - score(b)).slice(0, 12);
        if (r.candidates.length === 1) (r.symbol = r.candidates[0].symbol), (r.name = r.candidates[0].name);
      }
  }
  return out;
}

// ---------- HTTP ----------
function corsHeaders(req) {
  const origin = req.headers.origin;
  if (origin && cfg.origins.has(origin)) return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  return { Vary: "Origin" };
}

function send(req, res, status, body, extra = {}) {
  if (res.headersSent) return;
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(req),
    ...extra,
  });
  res.end(JSON.stringify(body));
}

const tooMany = (req, res, retryAfter) => send(req, res, 429, { error: "Too many requests. Slow down a little." }, { "Retry-After": String(retryAfter) });

function publicError(e) {
  if (e instanceof BadInput || e?.expose) return { status: 400, error: e.message };
  // Messages the original app shows the user ("NSE:XYZ isn't listed on Upstox", "needs your Upstox token").
  if (e?.status === 404 || e?.status === 424 || e?.status === 400) return { status: e.status, error: String(e.message).slice(0, 200) };
  if (e?.upstream || e?.status === 502) return { status: 502, error: "The market data source didn't answer. Try again shortly." };
  return { status: 500, error: "Something went wrong on the data server." };
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, "http://x");
  } catch {
    return send(req, res, 400, { error: "Bad request" });
  }
  const origin = req.headers.origin;

  if (url.pathname === "/api/health") return send(req, res, 200, { ok: true });

  // Browsers: only SOVA's own origins. (Requests with no Origin, such as curl, still need a valid token.)
  if (origin && !cfg.origins.has(origin)) return send(req, res, 403, { error: "Origin not allowed" });

  if (req.method === "OPTIONS") {
    if (!origin) return send(req, res, 400, { error: "Bad request" });
    res.writeHead(204, {
      ...corsHeaders(req),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
    });
    return res.end();
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(req, res, 405, { error: "Method not allowed" }, { Allow: "GET, OPTIONS" });

  const route = routes[url.pathname];
  if (!route) return send(req, res, 404, { error: "Not found" });

  const ip = clientIp(req, cfg.trustProxy);
  const byIp = limits.ip.take(ip);
  if (!byIp.ok) return tooMany(req, res, byIp.retryAfter);

  let claims;
  try {
    claims = await verifyToken(cfg.secret, bearer(req));
  } catch {
    return send(req, res, 401, { error: "Unauthorized" }, { "WWW-Authenticate": 'Bearer realm="hive-data"' });
  }

  const byUser = limits.user.take(claims.sub);
  if (!byUser.ok) return tooMany(req, res, byUser.retryAfter);
  const bucket = ROUTE_BUCKET[url.pathname];
  if (bucket) {
    const r = limits[bucket].take(claims.sub);
    if (!r.ok) return tooMany(req, res, r.retryAfter);
  }

  try {
    send(req, res, 200, await route(url.searchParams));
  } catch (e) {
    const pe = publicError(e);
    // Log the route and a short reason only: never the query string or headers (tokens).
    if (pe.status >= 500) console.warn(`[data] ${url.pathname} -> ${pe.status}: ${String(e?.message || e).slice(0, 160)}`);
    send(req, res, pe.status, { error: pe.error });
  }
});
server.headersTimeout = 20e3;
server.requestTimeout = 60e3;
server.keepAliveTimeout = 65e3; // longer than typical proxy idle timeouts

const wss = stream.attach(server, { cfg, verifyToken, clientIp });

server.listen(cfg.port, cfg.host, () => {
  console.log(`[data] http://${cfg.host}:${cfg.port}  origins: ${[...cfg.origins].join(", ") || "(none)"}  Upstox token: ${up.hasToken() ? "yes" : "no (Indian prices from Yahoo, delayed)"}`);
  up.instruments().catch((e) => console.warn(`[upstox] ${e.message}`));
});

// ---------- graceful shutdown (SIGTERM from the host on deploys, Ctrl+C locally) ----------
// Cache files are written synchronously when each refresh finishes, so there is nothing buffered to flush;
// a refresh that is half-way is simply redone on the next start from the last complete file.
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[data] ${signal}: closing`);
  const force = setTimeout(() => process.exit(0), 8000);
  force.unref();
  stream.shutdown(wss);
  up.feed.close?.();
  for (const l of Object.values(limits)) l.stop();
  server.close(() => process.exit(0));
  server.closeIdleConnections?.();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
