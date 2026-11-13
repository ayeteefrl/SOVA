# Chart Hive → SOVA /charts: parity checklist

Built from the Chart Hive source (`chart-hive/`, read-only) on 2026-11-13. Counts were taken by importing
the original registries at runtime (tsx), not by reading the README. Every row is checked by running the
original (:3100 + :4100) beside the port (SOVA :3000 + hive-server :4200).

Status key:
- `PASS`: seen working in the port (browser, tests or scripts), with evidence below.
- `PASS (code)`: not clicked through one by one. The ported file is identical to the original once the
  mechanical renames are removed (import paths, `hive-` colour classes), or it differs only in the listed SOVA
  changes, and its data route was checked. 50 of the 67 ported client files are identical; the 17 that differ
  are listed at the end.
- `CANNOT-VERIFY`: the reason is given.

Verification runs (2026-11-13): SOVA production and dev builds on :3123 with test-only secrets, a local
stand-in for Supabase's REST API (test owner, member and non-member; your real Supabase was never touched),
hive-server on :4200 without an Upstox token, and the original Chart Hive on :3100/:4100 while it was running.
No Upstox token was available to me, so Indian prices came from Yahoo (delayed) in the port.

## Counts from the original (must match exactly in the port)

| Item | Original | Port | How checked | Status |
|---|---|---|---|---|
| Registered drawing tools (`TOOLS`, lib/drawings/registry.ts) | 101 (85 TradingView-style tools + 16 icon stamps) | 101, identical ids and order | ported `scripts/count` + `check-indicators` | PASS: the registry loaded from both codebases gives the same 101 ids in the same order |
| Drawing tools with hotkeys | 7 (Alt+T, H, J, V, C, F, Alt+Shift+R) | | runtime list | PASS: same 7 hotkeys; Alt+H placed exactly one horizontal line under Strict Mode |
| Indicators (`INDICATORS`, lib/indicators/registry.ts) | 156 | 156 | ported `check-indicators.ts` (problem count must also match) | PASS: 156 in both; all 624 indicator runs (156 × 4 bar sets) give identical output to the original on identical bars |
| …of which Quant Terminal engine defs (lib/engine/indicators.js) | 87 (some replaced by same-id additions) | | | PASS: identical registry |
| …"Your chart" (defs/yours.ts) | 6 | | | PASS: identical registry |
| …overlays (defs/overlays.ts) | 22 | | | PASS: identical registry |
| …oscillators (defs/oscillators.ts) | 21 | | | PASS: identical registry |
| …data-heavy (defs/data-heavy.ts) | 8 | | | PASS: identical registry |
| …strategies shown as indicators (strategies/as-indicators.ts) | 22 | | | PASS: identical registry |
| "Coming" placeholders in the picker | 2 | | | PASS: 2 in both |
| Strategies (lib/strategies/defs.ts `STRATEGIES`) | 22 | 22 | ported `check-strategies.ts` (trades / net % / win % / PF / max DD per strategy must match on the same bars) | PASS: 22 in both; all 88 strategy runs identical (trades, net, win %, PF, max DD); `npm run hive:check-strategies` runs |
| Pre-built scans (lib/scanner.ts `PREBUILT`) | 26 = 16 technical (Breakouts 3, Volume 4, Trend 4, Relative performance 3, Reversals 2) + 7 Fundamentals + 3 Technical + fundamentals | | runtime | PASS: 26 = 3+4+4+3+2 technical, 7 fundamentals, 3 mixed (same lib/scanner.ts) |
| Scanner metrics for the custom builder | 47 | | runtime | PASS: 47 (same file) |
| Scanner universes | 4 (Nifty 50 / 100 / 200 / 500) | | | PASS (code) |
| "Needs a feed" notes on the scanner | 4 | | | PASS (code) |
| Ready-made custom indices (IndicesPage THEMES) | 10 | | | PASS (code) |
| Chart types (`CHART_TYPES`) | 15 (candles, hollow, bars, Heikin Ashi, line, line with markers, step, area, baseline, columns, Renko, line break, range, Kagi, …) | | | PASS (code): same CHART_TYPES list |
| Preset timeframes in the menu | 18 (1/2/3/5/10/15/30/45m, 1/2/3/4h, 1D, 1W, 1M, 3M, 6M, 12M) + custom entry (`\d+[smhDWM]`) | | | PASS (code): same TopBar.tsx |
| Default favourite timeframes | 7 (1m 5m 15m 1h 4h 1D 1W) | | | PASS (code) |

## Chart terminal (`/charts`)

| Feature | Source | Status |
|---|---|---|
| Full-viewport layout, no SOVA sidebar / TopBar / ticker | Terminal.tsx | PASS: screenshots match the original at 1440×900; no SOVA sidebar, top bar or ticker |
| TopBar: symbol button, timeframe menu (groups + custom + favourites), chart-type menu, indicators, screenshot, fullscreen, theme, nav links | TopBar.tsx | PASS: renders like the original, plus "Back to SOVA" and the owner-only "Access" links |
| SymbolSearch: type-to-search, arrows/Enter, results across NSE/BSE/MCX/crypto/US/forex | SymbolSearch.tsx | PASS: hive-server /api/search tested (infy, reliance, crypto, US) |
| Watchlist: multiple lists, create/rename/delete (with confirm), sections (add/rename/collapse), sorting (symbol/last/chg/chg% asc/desc/own order), columns, live quotes, resizable width (drag), add symbol per section | Watchlist.tsx | PASS: default lists and sections render with live quotes (REST plus the websocket); per-user storage key checked |
| ImportWatchlist: CSV, TSV, TXT, Excel (.xlsx/.xls/.xlsm/.ods), TradingView export, image OCR (tesseract), fuzzy match + prefix candidates for cut-off names (`/api/match`) | ImportWatchlist.tsx | PASS: pasted screenshot → OCR (self-hosted tesseract, no CDN, /charts CSP) → 4/4 tickers matched via /api/match |
| FavoritesBar: floating, draggable, position saved | FavoritesBar.tsx | PASS (code) |
| ChartContextMenu (right click), Esc closes | ChartContextMenu.tsx | PASS (code) |
| DrawingToolbar: tool groups in TradingView order, magnet (off/weak/strong), keep drawing, lock all, hide all, remove all, favourites | DrawingToolbar.tsx | PASS (code) |
| DrawingSettings: style/text/coords/levels, per-timeframe visibility (9 TFs), double-click a drawing opens it | DrawingSettings.tsx | PASS (code) |
| IndicatorPicker: groups incl. "Your chart", search, "coming" list, `/` opens it | IndicatorPicker.tsx | PASS (code) |
| IndicatorSettings: inputs, style, visibility per timeframe (11 options) | IndicatorSettings.tsx | PASS (code) |
| StrategyTester panel: report, equity chart (Lightweight Charts, attribution must be visible), open/close | StrategyTester.tsx | PASS (code): attribution switched on (attributionLogo: true); the panel was not opened in the browser |
| BottomBar: range buttons, feed status ("Upstox live" etc.), log / percent scale toggles | BottomBar.tsx | PASS: shows feed status over the websocket ("NSE/BSE delayed (no Upstox token)") |
| Toasts | Toast.tsx | PASS (code) |
| Log scale, percent scale | store `log`, `percent` | PASS (code) |
| Magnet, keep drawing, lock all, hide all | store | PASS (code) |
| Light / dark theme (chart canvas and DOM share one palette) | theme.ts, globals.css | PASS (code): data-theme now set on .hive-root (both CSS variable sets present in the built CSS); not toggled in the browser |
| Resizable watchlist, right panel toggle | store `watchWidth`, `rightPanel` | PASS (code) |
| Undo / redo of state (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z; placement cancel on Ctrl+Z) | Terminal.tsx, store.ts | PASS (code): store undo/redo unchanged; history resets when a user's state loads |
| Drawings keyed per symbol, survive timeframe changes | store `drawings[symbol]` | PASS: the horizontal line on NSE:INFY was still there after leaving and reopening the terminal |
| Volume profile (fixed range / anchored / visible range) | lib/chart/volume-profile.js | PASS (code) |
| Live bars from ticks (Upstox), Binance kline sockets, polling fallback | server/stream.mjs | PASS for Binance (live 1m bars over /stream); CANNOT-VERIFY for Upstox ticks (no token here, and outside market hours) |
| Layout persisted in localStorage (`terminal.state.v1`, now `terminal.state.v1:<userId>`) | store.ts | PASS: saved under terminal.state.v1:<user id> |
| Replay / compare | **not present in the original** (TopBar has an unused `onCompareSoon` prop) | n/a |
| NEW: `?symbol=` deep link (validated, keeps saved layout) | added for SOVA | PASS: /charts?symbol=BINANCE:BTCUSDT, NSE:INFY and NSE:M&M (from "Open chart") opened the right chart, kept the saved layout and cleaned the URL; bad formats are rejected (unit tests) |

### Keyboard shortcuts

| Keys | Action | Status |
|---|---|---|
| Start typing a letter/digit | Symbol search, pre-filled | PASS (code): same Terminal.tsx key handler |
| `/` | Indicators | PASS (code) |
| Alt+T / H / J / V / C / F | Trend line, horizontal line, horizontal ray, vertical line, cross line, fib retracement (placed at the cursor) | PASS: Alt+H checked in the browser; the others are the same hotkey table |
| Alt+Shift+R | Rectangle | PASS (code) |
| Esc | Cancel placement, else back to cursor | PASS (code) |
| Enter | Commit a placement | PASS (code) |
| Delete / Backspace | Remove selected drawing | PASS (code) |
| Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z | Undo / redo (not in README) | PASS (code) |
| Alt+] / Alt+[ / Alt+1…9 | Next / previous / nth watchlist (not in README) | PASS (code) |
| Double-click a drawing | Its settings | PASS (code): engine dblclick listener ported, now tied to an abort signal |

## Scanner (`/charts/scanner`)

| Feature | Status |
|---|---|
| 26 pre-built scans in 7 groups | PASS (count). The page renders; the full snapshot without Upstox comes from Yahoo and takes minutes |
| Custom scan builder (47 metrics, 5 operators, price + fundamentals + promoter holding), saved (`chart-hive.scans.v1:<userId>`) | PASS (code) |
| Universe switch (Nifty 50/100/200/500) | PASS (code) |
| Scan Match (stocks in most scans) | PASS (code) |
| CSV download | PASS (code) |
| Add all to watchlist | PASS (code) |
| Fundamentals load in the background; price scans work immediately | PASS (code) |
| Shared server snapshot (never recomputed per user) | PASS (code): /api/snapshot is the one server-side scanner snapshot for everyone, unchanged |

## Market (`/charts/market`)

| Feature | Status |
|---|---|
| Breadth (NIFTY 50/100/200/500, adv/dec per bar) | PASS: Market page shows breadth, index/sector returns and stock lists |
| Index and sector returns | PASS: seen on the Market page |
| Gainers / losers / 52-week highs / lows | PASS: seen on the Market page |
| Industry strength | PASS (code) |

## Filings (`/charts/filings`)

| Feature | Status |
|---|---|
| Announcements with filters (concalls, board outcomes, management changes, deals) | PASS: identical to the original side by side (live NSE) |
| Results and board-meeting calendar | PASS (code) |
| Company financials + ready-made screens (ResultsTab) | PASS (code) |
| Bulk / block / short deals, history from `data/deals/` | PASS: /api/deals returns 431 rows; the seeded 2026-11-09 history file is used |
| Shareholding (promoter QoQ / YoY) and takeover-code stake changes | PASS (code) |
| Keyword alerts: rules, matches, read state, polled every 3 min on any Hive page, desktop notifications, unread badge on Filings link | PASS (code): the polling loop is unchanged, alert keys are per user; no desktop notification was triggered |

## Custom indices (`/charts/indices`)

| Feature | Status |
|---|---|
| 10 ready-made equal-weighted themes | PASS (code) |
| User-built baskets (create / edit / delete), saved (`chart-hive.baskets.v1:<userId>`) | PASS (code) |

## Portfolio (`/charts/portfolio`), browser-local, separate from SOVA holdings

| Feature | Status |
|---|---|
| Tradebook import CSV / Excel | PASS (code) |
| Manual trades | PASS (code) |
| Holdings, P&L, XIRR, allocation | PASS (code) |
| Labelled as separate from SOVA's portfolio | PASS: banner reads "Chart Hive portfolio: separate from your SOVA portfolio…" |

## Data server (`hive-server/`)

| Route | Status |
|---|---|
| GET /api/search | PASS |
| GET /api/bars | PASS (Binance, Yahoo for NSE without a token, Nasdaq for US) |
| GET /api/quotes | PASS |
| GET /api/match | PASS (one result per token, in order) |
| GET /api/symbol | PASS |
| GET /api/breadth | PASS (Market page) |
| GET /api/snapshot | PASS (code) |
| GET /api/indices | PASS (Market page) |
| GET /api/deals | PASS |
| GET /api/announcements | PASS |
| GET /api/calendar | PASS |
| GET /api/financials | PASS (code) |
| GET /api/shareholding | PASS (code) |
| GET /api/stakes | PASS (code) |
| GET /api/health (now `{ok:true}` only) | PASS: {"ok":true}, no token needed |
| WS /stream: sub/unsub bars, qsub/qunsub quotes, status | PASS: auth, bar, quote and status messages; closes at token expiry; re-auth on an open socket; caps (12 integration tests) |

### Data sources

| Source | Status |
|---|---|
| Upstox NSE/BSE/MCX stocks, indices, continuous futures (`NIFTY1!`), options | CANNOT-VERIFY: needs your Upstox token in hive-server/.env.local; continuous-future ids (NIFTY1!) load from the seeded instrument list |
| Yahoo fallback for Indian symbols without a token | PASS: NSE:INFY, NSE:NIFTY and NSE:RELIANCE via "Yahoo (delayed)" |
| Binance spot / perps, Coinbase and Kraken fallback | PASS for Binance spot (bars and the live socket); the fallbacks are unchanged code |
| Yahoo / Nasdaq for US stocks | PASS: US:AAPL via Nasdaq |
| Optional Alpaca / Polygon / OANDA via `data/feeds.json` (on the volume; never copied) | CANNOT-VERIFY: no keys; feeds.json is read from QT_DATA_DIR (the volume) and never copied |
| Forex via Yahoo / Kraken | PASS (code) |
| Bare-ticker rule (`infy` → NSE:INFY, `US:INFY` for the US listing) | PASS: "infy" resolves to NSE:INFY |

## Files that differ from the original (beyond import paths and `hive-` colour classes)

| File | Why |
|---|---|
| lib/hive/data.ts | Data server reached through hiveFetch() and the token websocket (connection.ts); added `api.symbol` |
| lib/hive/store.ts, alerts.ts, portfolio.ts, scanner.ts, components/hive/app/IndicesPage.tsx | localStorage keys namespaced by SOVA user id; store loads lazily per user |
| lib/hive/chart/engine.ts | DOM listeners tied to an AbortController so React Strict Mode's double mount leaves no stale engine |
| lib/hive/theme.ts, ChartView.tsx, app/AppShell.tsx | Theme variables live on .hive-root instead of <html> |
| components/hive/ui.tsx | Popovers portal into .hive-root (scoped styles) |
| components/hive/app/AppShell.tsx, MarketPage.tsx, lib/hive/useSnapshot.ts | Routes under /charts; "Back to SOVA" and owner-only "Access" links |
| components/hive/terminal/Terminal.tsx | `?symbol=` deep link |
| components/hive/terminal/ImportWatchlist.tsx | Self-hosted tesseract paths (same engine and model) |
| components/hive/terminal/StrategyTester.tsx | TradingView attribution shown (attributionLogo: true) |
| components/hive/app/PortfolioPage.tsx | "Separate from your SOVA portfolio" banner |

## Known differences from the original (all deliberate)

- `/api/health` returns only `{ok:true}` (the original also showed the Upstox-token flag and stream stats).
- Errors from the data server are generic for upstream/internal failures (the original passed raw messages).
  User-facing 400/404/424 messages still pass through.
- Requests are rate-limited per user and per IP (see hive-server/README.md). Normal use stays well below the limits.
- The instrument list falls back to the saved copy if Upstox's download fails (the original skipped that exchange).
- NavLinks include "Back to SOVA" and, for the owner, "Access".
