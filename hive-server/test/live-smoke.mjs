// Manual smoke test with real public data (needs network). Not part of `npm test`.
//   node test/live-smoke.mjs   (starts its own server on :4296 with a temp data folder)
import { spawn } from "node:child_process";
import os from "node:os"; import fs from "node:fs"; import path from "node:path";
import { SignJWT } from "jose"; import WebSocket from "ws";
const S = "live-smoke-secret-0123456789abcdefghijkl", P = 4296, B = `http://127.0.0.1:${P}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hive-smoke-"));
const p = spawn(process.execPath, ["server/index.mjs"], { env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, PORT: String(P), QT_DATA_DIR: dir, HIVE_TOKEN_SECRET: S, ALLOWED_ORIGINS: "http://localhost:3000", UPSTOX_ANALYTICS_TOKEN: "" }, stdio: "inherit" });
const now = Math.floor(Date.now() / 1000);
const t = await new SignJWT({ role: "member" }).setProtectedHeader({ alg: "HS256" }).setSubject("22222222-2222-4222-8222-222222222222").setAudience("hive-data").setIssuer("sova").setExpirationTime(now + 600).sign(new TextEncoder().encode(S));
const H = { Authorization: `Bearer ${t}` };
for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
const show = async (u) => { const t0 = Date.now(); const r = await fetch(B + u, { headers: H }); const j = await r.json(); const n = Array.isArray(j) ? j.length : j.candles ? `${j.candles.length} bars via ${j.provider}` : j.rows ? `${j.rows.length} rows` : Object.keys(j).slice(0, 6).join(","); console.log(`${r.status} ${u} -> ${n} (${Date.now() - t0}ms)`); return j; };
await show("/api/search?q=infy");
const s = await show("/api/search?q=reliance"); console.log("   first:", s.slice(0, 3).map((x) => x.symbol).join(" "));
await show("/api/bars?symbol=BINANCE:BTCUSDT&tf=1h&limit=500");
await show("/api/bars?symbol=BINANCE:BTCUSDT&tf=1h&limit=500");
await show("/api/bars?symbol=infy&tf=1D&limit=300");
await show("/api/bars?symbol=US:AAPL&tf=1D&limit=300");
await show("/api/quotes?symbols=BINANCE:BTCUSDT,US:AAPL");
await show("/api/symbol?symbol=NSE:TCS");
await show("/api/match?tokens=INFY,TCS,RELIANC,HDFC...");
await show("/api/deals?days=5");
await show("/api/announcements?days=2");
await show("/api/calendar?days=14");
const ws = new WebSocket(`ws://127.0.0.1:${P}/stream`, { headers: { Origin: "http://localhost:3000" } });
ws.on("open", () => { ws.send(JSON.stringify({ op: "auth", token: t })); ws.send(JSON.stringify({ op: "sub", s: "BINANCE:BTCUSDT", tf: "1m" })); ws.send(JSON.stringify({ op: "qsub", s: ["BINANCE:ETHUSDT"] })); });
const seen = new Set();
ws.on("message", (m) => { const j = JSON.parse(m); if (!seen.has(j.t)) { seen.add(j.t); console.log("ws", j.t, JSON.stringify(j).slice(0, 140)); } });
await new Promise((r) => setTimeout(r, 9000));
console.log("ws message types:", [...seen].join(","));
ws.close(); p.kill(); process.exit(0);
