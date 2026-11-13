// End-to-end checks against a real hive-server process on a fresh, empty data folder.
// Run: npm test (inside hive-server). Uses test-only secrets; needs no Upstox token.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import WebSocket from "ws";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4297;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = "http://localhost:3000";
const SECRET_TEXT = "hive-server-test-secret-0123456789-abcdef";
const SECRET = new TextEncoder().encode(SECRET_TEXT);
const SUB = "22222222-2222-4222-8222-222222222222";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hive-data-"));
let proc;
let logs = "";

async function token({ sub = SUB, role = "member", aud = "hive-data", iss = "sova", ttl = 600, secret = SECRET, alg = "HS256" } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role }).setProtectedHeader({ alg }).setSubject(sub).setAudience(aud).setIssuer(iss).setIssuedAt(now).setExpirationTime(now + ttl).sign(secret);
}
const get = (p, headers = {}) => fetch(BASE + p, { headers });

before(async () => {
  proc = spawn(process.execPath, ["server/index.mjs"], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      HOST: "127.0.0.1",
      PORT: String(PORT),
      QT_DATA_DIR: dataDir,
      HIVE_TOKEN_SECRET: SECRET_TEXT,
      ALLOWED_ORIGINS: `${ORIGIN}, https://sova.example/`,
      UPSTOX_ANALYTICS_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout.on("data", (d) => (logs += d));
  proc.stderr.on("data", (d) => (logs += d));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await get("/api/health")).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not start:\n${logs}`);
});

after(() => {
  proc?.kill();
});

test("first boot on an empty data folder copies the seed files, keeping their dates", () => {
  for (const f of ["instruments-NSE.json.gz", "instruments-BSE.json.gz", "instruments-MCX.json.gz", "tv-standard.json", path.join("deals", "2026-11-09.json")]) {
    assert.ok(fs.existsSync(path.join(dataDir, f)), `${f} seeded`);
  }
  const seedM = fs.statSync(path.join(root, "seed", "tv-standard.json")).mtimeMs;
  assert.ok(Math.abs(fs.statSync(path.join(dataDir, "tv-standard.json")).mtimeMs - seedM) < 2000);
  assert.match(logs, /seeded \d+ file/);
});

test("health is public and minimal", async () => {
  const r = await get("/api/health");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

const ROUTES = ["/api/search?q=infy", "/api/bars?symbol=NSE:TCS&tf=1D", "/api/quotes?symbols=NSE:NIFTY", "/api/match?tokens=INFY", "/api/symbol?symbol=NSE:TCS", "/api/breadth", "/api/snapshot", "/api/indices", "/api/deals", "/api/announcements", "/api/calendar", "/api/financials", "/api/shareholding", "/api/stakes"];

test("every data route refuses no token, bad, expired, wrong-audience, wrong-issuer, wrong-algorithm and session-cookie tokens", async () => {
  const bad = [
    {},
    { Authorization: "Bearer nonsense" },
    { Authorization: `Bearer ${await token({ secret: new TextEncoder().encode("x".repeat(40)) })}` },
    { Authorization: `Bearer ${await token({ ttl: -10 })}` },
    { Authorization: `Bearer ${await token({ aud: "other" })}` },
    { Authorization: `Bearer ${await token({ iss: "someone" })}` },
    { Authorization: `Bearer ${await token({ role: "admin" })}` },
    { Authorization: `Bearer ${await token({ sub: "not-a-uuid" })}` },
    { Authorization: `Bearer ${await token({ alg: "HS512", secret: new Uint8Array(64).fill(7) })}` },
    { Authorization: `Bearer ${await new SignJWT({ userId: SUB, email: "a@b.co" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(SECRET)}` },
  ];
  for (const route of ROUTES)
    for (const h of bad) {
      const r = await get(route, h);
      assert.equal(r.status, 401, `${route} ${JSON.stringify(h).slice(0, 40)}`);
      assert.deepEqual(await r.json(), { error: "Unauthorized" });
    }
});

test("CORS: allowed origin echoed, other origins refused, preflight answers for Authorization", async () => {
  const t = await token();
  const ok = await get("/api/deals?days=1", { Origin: ORIGIN, Authorization: `Bearer ${t}` });
  assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
  const evil = await get("/api/deals", { Origin: "https://evil.example", Authorization: `Bearer ${t}` });
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  const pre = await fetch(BASE + "/api/bars", { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(pre.headers.get("access-control-allow-headers"), /Authorization/i);
  const preEvil = await fetch(BASE + "/api/bars", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
  assert.equal(preEvil.status, 403);
  // a normalised entry with a trailing slash in ALLOWED_ORIGINS still matches
  const h2 = await get("/api/health", { Origin: "https://sova.example" });
  assert.equal(h2.status, 200);
  const post = await fetch(BASE + "/api/deals", { method: "POST", headers: { Authorization: `Bearer ${t}` } });
  assert.equal(post.status, 405);
});

test("query parameters are validated and errors are generic", async () => {
  const A = { Authorization: `Bearer ${await token()}` };
  for (const p of ["/api/bars?symbol=NSE:TCS&tf=banana", "/api/bars?tf=1D", "/api/bars?symbol=<script>&tf=1D", "/api/bars?symbol=NSE:TCS&limit=-5", "/api/breadth?universe=ALL", "/api/deals?days=abc", `/api/search?q=${"x".repeat(80)}`, `/api/quotes?symbols=${Array(301).fill("A").join(",")}`]) {
    const r = await get(p, A);
    assert.equal(r.status, 400, p);
    const j = await r.json();
    assert.ok(typeof j.error === "string" && !/\bat\s.+:\d+:\d+/.test(j.error), "no stack trace");
  }
  // match keeps one result per token, in order, even for unusable tokens
  const m = await get(`/api/match?tokens=${encodeURIComponent("$$$,ZZZZZZZZZZQ")}`, A);
  assert.equal(m.status, 200);
  const rows = await m.json();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].token, "$$$");
  assert.equal(rows[0].symbol, null);
  const nf = await get("/api/nothing", A);
  assert.equal(nf.status, 404);
});

test("per-user limit on expensive routes returns 429 with Retry-After", async () => {
  const A = { Authorization: `Bearer ${await token({ sub: "44444444-4444-4444-8444-444444444444" })}` };
  let limited = null;
  for (let i = 0; i < 25 && !limited; i++) {
    const r = await get(`/api/match?tokens=ZZZQ${i}`, A);
    if (r.status === 429) limited = r;
  }
  assert.ok(limited, "429 reached");
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
  // another user is unaffected
  const other = await get("/api/match?tokens=ZZZQ", { Authorization: `Bearer ${await token({ sub: "55555555-5555-4555-8555-555555555555" })}` });
  assert.equal(other.status, 200);
});

function ws(origin = ORIGIN) {
  return new WebSocket(`ws://127.0.0.1:${PORT}/stream`, { headers: origin ? { Origin: origin } : {} });
}
const closed = (s) => new Promise((r) => s.on("close", (code, reason) => r({ code, reason: String(reason) })));
const message = (s, t) => new Promise((r) => s.on("message", (m) => { const j = JSON.parse(m); if (j.t === t) r(j); }));

test("websocket: no auth closes 4401 quickly; bad, expired and wrong-audience tokens close 4401", async () => {
  const t0 = Date.now();
  const s = ws();
  const c = await closed(s);
  assert.equal(c.code, 4401);
  assert.ok(Date.now() - t0 < 8000);
  for (const bad of ["nonsense", await token({ ttl: -5 }), await token({ aud: "x" }), await token({ secret: new TextEncoder().encode("y".repeat(40)) })]) {
    const s2 = ws();
    s2.on("open", () => s2.send(JSON.stringify({ op: "auth", token: bad })));
    assert.equal((await closed(s2)).code, 4401);
  }
});

test("websocket: subscriptions before auth are ignored", async () => {
  const s = ws();
  let got = 0;
  s.on("message", () => got++);
  s.on("open", () => s.send(JSON.stringify({ op: "qsub", s: ["BINANCE:BTCUSDT"] })));
  assert.equal((await closed(s)).code, 4401);
  assert.equal(got, 0);
});

test("websocket: disallowed origin is refused at the upgrade", async () => {
  const s = ws("https://evil.example");
  const err = await new Promise((r) => s.on("unexpected-response", (_req, res) => r(res.statusCode)));
  assert.equal(err, 403);
});

test("websocket: valid token gets status, closes at token expiry, and re-auth on the open socket extends it", async () => {
  const s = ws();
  const status = message(s, "status");
  const auth1 = message(s, "auth");
  s.on("open", async () => s.send(JSON.stringify({ op: "auth", token: await token({ ttl: 2 }) })));
  await status;
  await auth1;
  const done = closed(s);
  const t0 = Date.now();
  const c = await done;
  assert.equal(c.code, 4401);
  assert.equal(c.reason, "token expired");
  assert.ok(Date.now() - t0 < 4000);

  const s2 = ws();
  s2.on("open", async () => s2.send(JSON.stringify({ op: "auth", token: await token({ ttl: 2 }) })));
  await message(s2, "auth");
  s2.send(JSON.stringify({ op: "auth", token: await token({ ttl: 600 }) }));
  await message(s2, "auth");
  await new Promise((r) => setTimeout(r, 3000));
  assert.equal(s2.readyState, WebSocket.OPEN, "still open after the first token's expiry");
  // a token for a different user on the same socket is refused
  s2.send(JSON.stringify({ op: "auth", token: await token({ sub: "66666666-6666-4666-8666-666666666666" }) }));
  assert.equal((await closed(s2)).code, 4401);
});

test("websocket: per-user socket cap", async () => {
  const sub = "77777777-7777-4777-8777-777777777777";
  const t = await token({ sub });
  const socks = [];
  const results = [];
  for (let i = 0; i < 7; i++) {
    const s = ws();
    socks.push(s);
    results.push(
      new Promise((r) => {
        s.on("open", () => s.send(JSON.stringify({ op: "auth", token: t })));
        s.on("message", (m) => JSON.parse(m).t === "auth" && r("ok"));
        s.on("close", (code) => r(code));
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
  }
  const out = await Promise.all(results);
  assert.equal(out.filter((x) => x === "ok").length, 6);
  assert.ok(out.includes(4429));
  socks.forEach((s) => s.close());
});

test("logs never contain tokens or query strings", async () => {
  const t = await token();
  await get(`/api/bars?symbol=NSE:NOPE_SECRETQUERY&tf=1D`, { Authorization: `Bearer ${t}` });
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(!logs.includes(t), "token not logged");
  assert.ok(!logs.includes("SECRETQUERY"), "query not logged");
  assert.ok(!logs.includes(SECRET_TEXT), "secret not logged");
});
