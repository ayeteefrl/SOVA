# hive-server

The Chart Hive data server behind SOVA's `/charts`: HTTP routes for history, search, the scanner snapshot and NSE
filings, plus the `/stream` websocket for live bars and quotes. It is a separate deployable. It is **not** part of the
Next.js app, is excluded from SOVA's `tsconfig.json`, and is never uploaded to Vercel (`.vercelignore`). Browsers call
it directly over `https://` and `wss://`, because Vercel can't proxy websockets.

Ported from the original Chart Hive `server/` (Quant Terminal providers, MIT: `server/qt/LICENSE-quant-terminal`).
Data behaviour is unchanged. What's new is the security layer: tokens, CORS, limits, caching and container support.

## Configuration (environment only)

| Variable | Required | Value |
|---|---|---|
| `HIVE_TOKEN_SECRET` | yes | Same value as SOVA's `HIVE_TOKEN_SECRET`, 32+ characters. The server exits at start without it. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ALLOWED_ORIGINS` | yes | Comma-separated SOVA origins, e.g. `https://sova.example.com`. Anything else is refused (CORS and websocket). |
| `HOST` | no | Default `127.0.0.1`. Containers: `0.0.0.0`. |
| `PORT` | no | Default `4200` (`DATA_PORT` also works). Containers: `8080`. |
| `QT_DATA_DIR` | no | Writable data folder. Default `hive-server/data`. On Fly: `/data` (the volume). |
| `HIVE_SEED_DIR` | no | Seed files copied into `QT_DATA_DIR` when missing. Default `hive-server/seed`; `/app/seed` in the image. |
| `UPSTOX_ANALYTICS_TOKEN` | no | Live NSE/BSE/MCX prices and full candle history. Without it, Indian symbols come from Yahoo (delayed) and futures and options are unavailable. |
| `TRUST_PROXY` | no | `fly` (use `Fly-Client-IP`), `xff` (last `X-Forwarded-For` hop) or `none`. Set it only when the server really sits behind that proxy, because it decides the per-IP rate-limit key. |
| `UPSTOX_MAX_SUBSCRIPTIONS` | no | Cap on instruments in the one shared Upstox feed (default 1500; Upstox allows 2,000 in full mode). |

The server loads `hive-server/.env.local` for local development only. The Docker image never contains env files
(`.dockerignore`).

## Local development

From the SOVA folder:

```bash
npm run hive:install     # once: installs ws, protobufjs, jose into hive-server/node_modules
npm run hive:dev         # data server on http://127.0.0.1:4200 (restarts on changes in server/)
npm run dev              # SOVA on http://localhost:3000
```

`hive-server/.env.local`:

```
HIVE_TOKEN_SECRET=<same as SOVA>
ALLOWED_ORIGINS=http://localhost:3000
UPSTOX_ANALYTICS_TOKEN=<optional>
```

SOVA `.env.local` additionally needs `HIVE_OWNER_USER_ID`, the same `HIVE_TOKEN_SECRET`, and
`NEXT_PUBLIC_HIVE_DATA_URL=http://localhost:4200`. The original Chart Hive can keep running on :3100/:4100 alongside.

Tests: `npm run hive:test` starts a real server on an empty temporary data folder and checks tokens, CORS,
validation, limits, websocket auth and expiry, and the seed copy. `node test/live-smoke.mjs` (inside
`hive-server`) fetches real public data through a throwaway server.

## Deploy to Fly.io (region sin)

One always-on machine with one volume. **Always deploy with `--ha=false`.** The server keeps in-memory state
(channels, caches, the single Upstox websocket), and a second machine would need its own volume.

```bash
cd hive-server
fly apps create <app-name>                      # then put the name in fly.toml (app = ...)
fly volumes create hive_data --region sin --size 1
fly secrets set HIVE_TOKEN_SECRET=<same as SOVA> ALLOWED_ORIGINS=https://<your SOVA domain> UPSTOX_ANALYTICS_TOKEN=<token>
fly deploy --ha=false
fly certs add data.<your-domain>                # then add the DNS record Fly prints (CNAME data -> <app-name>.fly.dev)
curl https://data.<your-domain>/api/health      # {"ok":true}
```

Then set `NEXT_PUBLIC_HIVE_DATA_URL=https://data.<your-domain>` in Vercel and redeploy SOVA, so the CSP and the
client pick it up. The variable is read at build time.

`fly.toml` already sets `HOST=0.0.0.0`, `PORT=8080`, `QT_DATA_DIR=/data`, `TRUST_PROXY=fly`, `force_https`,
`auto_stop_machines = "off"`, `min_machines_running = 1`, a 512 MB shared-cpu-1x VM, the `hive_data` mount at
`/data` and an HTTP check on `/api/health`.

### Moving to another host (e.g. a VPS in India if NSE blocks Fly's IPs)

Nothing in the code is Fly-specific. Build the same Dockerfile, mount a persistent folder at `/data`, pass the same
environment variables (`TRUST_PROXY=xff` behind nginx/Caddy, which must forward websocket upgrades and keep idle
connections open for at least 60 s), copy `/data/deals/` from the old volume, and point the DNS record at the new host.

## Data folder and the seed

| Path in `QT_DATA_DIR` | What | Survives redeploys? |
|---|---|---|
| `deals/YYYY-MM-DD.json` | NSE bulk/block/short deals, one file per session. NSE only publishes the latest session, so **this history can't be rebuilt**. | Must: it's on the volume. Back it up before deleting a volume. |
| `instruments-NSE/BSE/MCX.json.gz` | Upstox instrument lists. Re-downloaded when older than 20 h; the saved copy is used if a download fails. | cache |
| `snapshot-cache.json`, `financials-cache.json`, `shareholding-cache.json` | Scanner snapshot (30 min), Yahoo financials (12 h), NSE shareholding | cache |
| `feeds.json` | Optional Alpaca/Polygon/OANDA keys (see `server/qt/feeds.js`). Create it on the volume yourself; it is never in git or the image. | yours |

A volume mounted at `/data` hides anything baked into the image there, so the image keeps its seed in `/app/seed`.
On every start `server/seed.mjs` copies any missing seed file into `QT_DATA_DIR`, keeping its original date, so an
old instrument list is still refreshed from Upstox. Existing files are never overwritten. A fresh, empty volume
therefore starts with the instrument lists (a fallback if Upstox's file can't be fetched) and the deals history
collected so far. `seed/tv-standard.json` is a research artefact from the original; no code reads it.

The container starts as root only long enough to `chown` the volume, then runs Node as the unprivileged `node`
user (`docker-entrypoint.sh`, via `setpriv`).

## Security model

- **Tokens.** SOVA's `POST /api/hive/token` issues HS256 JWTs (`aud: hive-data`, `iss: sova`, `sub` = SOVA user id,
  `role` owner|member) valid for 10 minutes, only to the owner and invited members. Every route except
  `/api/health` requires `Authorization: Bearer <token>`. No token, a bad signature, an expired token, the wrong
  audience, issuer or algorithm, or a SOVA session cookie all get `401 {"error":"Unauthorized"}`.
- **Websocket.** The token goes in the first message (`{op:"auth", token}`), never in the URL, so it can't end up in
  access logs. Sockets that don't authenticate within 5 s are closed with code 4401. Each socket closes (4401
  "token expired") when its token expires, unless the client re-authenticates on the open socket with a fresh token.
  The SOVA client does this about a minute before expiry, and reconnects with a fresh token after any close.
- **Revocation timing.** When the owner removes a member, SOVA refuses their next token request at once (membership
  is cached for 5 s at most). Their current token keeps working until it expires, so they lose new HTTP access and
  live websocket data within **10 minutes** at most.
- **CORS.** Only `ALLOWED_ORIGINS` are echoed back. Requests from any other `Origin` get 403, including websocket
  upgrades and preflights. Preflight allows `GET` with the `Authorization` header (cached for 10 minutes).
- **Errors.** No stack traces. Validation errors and the original's user-facing messages ("isn't listed on Upstox")
  pass through; upstream and internal failures are generic. Logs never contain tokens, headers or query strings.
- **`/api/health`** returns only `{"ok":true}`.

## Limits (and why)

Several people now share one Upstox token, which allows roughly 2,000 requests per 30 minutes, and the scanner's
background refresh already uses most of that. The limits stop any one person from draining it or starving others,
while staying above what normal use of every page needs.

| Limit | Value | Why |
|---|---|---|
| Per IP, all routes | 600 / min | Flood guard. High enough for several members behind one office or home NAT. |
| Per user, all routes | 300 / min | The scanner polls the snapshot every 1.5 s while it loads; that plus a chart and a watchlist is ~100/min. |
| Per user, `/api/bars` | 60 / min | The expensive upstream call. One chart, plus compare/indicator symbols and strategy sub-bars, uses a handful per symbol change. |
| Per user, `/api/quotes` | 90 / min | The portfolio page polls quotes; live quotes otherwise come over the websocket. |
| Per user, `/api/search` | 300 / min | The watchlist import searches each unmatched token (6 at a time), so imports need bursts. |
| Per user, `/api/match` + `/api/breadth` | 20 / min | Fuzzy matching over 120k instruments, and breadth (candles for up to 500 stocks, then shared). |
| Websockets per user / per IP | 6 / 30 | Tabs per account, and a cap per address. |
| Per socket | 40 live charts, 400 quote symbols, 240 messages/min | A chart plus its extra symbols; the largest watchlists; normal use sends a few messages a minute. |
| Shared Upstox feed | 1,500 instruments | Below Upstox's 2,000 per connection. Past it, charts and quotes for further symbols fall back to polling. |

**Shared work, so one request serves everyone:**
- Identical requests within a short window share one upstream call, including requests still in flight. TTLs:
  bars 10 s intraday / 60 s daily+, quotes 3 s, search 5 min, match 10 min, symbol 10 min.
- The scanner snapshot, financials, shareholding, breadth and NSE feeds were already shared server-side caches. They
  are computed once for everybody, never per user.
- Live data uses one upstream feed: one Upstox websocket and one Binance socket per symbol/timeframe, ref-counted
  across all users' sockets, with one shared quote poll for symbols without a live feed.

## Graceful shutdown

On `SIGTERM` or `SIGINT` the server stops accepting connections, closes websockets with code 1001 (clients reconnect),
closes upstream sockets and exits, forcing an exit after 8 s. Cache files are written synchronously when each refresh
completes, so nothing is left to flush. A refresh interrupted half-way restarts from the last complete file. Times
for NSE and Upstox are computed in IST by the code itself; no `TZ` setting is needed.
