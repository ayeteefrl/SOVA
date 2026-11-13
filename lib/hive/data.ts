// Talking to the data server: REST for history and search, one websocket for everything live.
// In SOVA the data server is hive-server, reached directly at NEXT_PUBLIC_HIVE_DATA_URL with a short-lived
// token (lib/hive/connection.ts), never through relative /api/* paths (those are SOVA's own routes).
import { HiveAccessEnded, hiveFetch, hiveToken, hiveWsUrl } from "./connection";

export type Bar = { time: number; open: number; high: number; low: number; close: number; volume?: number; oi?: number };
export type BarsResponse = {
  symbol: string;
  tf: string;
  provider: string;
  candles: Bar[];
  notes?: string[];
  meta?: { name?: string; exchange?: string; kind?: string; tick?: number; lot?: number };
};
export type SymbolInfo = { symbol: string; name?: string; exchange?: string; type?: string; tick?: number; lot?: number; currency?: string | null; timezone?: string };
export type SearchResult = { symbol: string; name: string; type: string; exchange: string };
export type Quote = { price: number; change?: number | null; changePct?: number | null; volume?: number | null; bid?: number; ask?: number; live?: boolean };
export type BreadthRow = { time: number; adv: number; dec: number; unch: number; advVol: number; decVol: number };
export type Breadth = { universe: string; tf: string; members: number; loaded: number; rows: BreadthRow[] };
export type FeedStatus = { upstox: string; market?: Record<string, string> };
export type Periods = { "1D": number | null; "1W": number | null; "1M": number | null; "3M": number | null; "6M": number | null; "1Y": number | null };
export type StockRow = {
  s: string; // NSE ticker
  name: string;
  industry: string;
  tier: number; // 1 = Nifty 50, 2 = Nifty 100, 3 = Nifty 200, 4 = Nifty 500
  close: number;
  sma50: number | null;
  sma200: number | null;
  rsi: number | null;
  vol: number;
  vol5: number | null;
  vol10: number | null;
  vol20: number | null;
  vol50: number | null;
  valueCr: number | null;
  hi52: number;
  lo52: number;
  gap52h: number;
  gap52l: number;
  gap26h: number;
  brk52: boolean;
  brk26: boolean;
  goldenAgo: number | null;
  ret: Periods;
  rel: Omit<Periods, "1D">; // return minus the Nifty 500's over the same period
  t: number;
  src?: "upstox" | "yahoo";
};
export type Snapshot = { loading: false; at: number; refreshing: boolean; count: number; members: number; bench: Periods | null; stocks: StockRow[]; yahooFallback?: number } | { loading: true; done: number; total: number; error: string | null };
export type IndexRow = { group: string; symbol: string; name: string; price: number; ret: Periods; gap52h: number; rsi: number | null; above200: boolean | null };

// From NSE's public feeds (server/nse.mjs). Times are epoch milliseconds.
export type Deal = { kind: "bulk" | "block" | "short"; date: number; symbol: string; name: string; client: string; side: string; qty: number; price: number | null; valueCr: number | null; remarks: string; n500: boolean };
export type DealsResponse = { asOn: number | null; days: number[]; historyDays: number; rows: Deal[] };
export type Announcement = { id: string; t: number | null; symbol: string; name: string; category: string; text: string; file: string; size: string; n500: boolean };
export type AnnouncementsResponse = { from: string; to: string; count: number; rows: Announcement[] };
export type CalendarRow = { symbol: string; name: string; purpose: string; desc: string; date: number; n500: boolean };
export type CalendarResponse = { from: string; to: string; count: number; rows: CalendarRow[] };

export type HoldingRow = { symbol: string; name: string; promoter: number | null; prevPromoter: number | null; chg: number | null; chgYoY: number | null; public: number | null; filed: number; n500: boolean };
export type ShareholdingResponse = { quarter: number; prevQuarter: number; yoyQuarter: number; count: number; rows: HoldingRow[] };
export type StakeChange = { t: number; symbol: string; name: string; acquirer: string; promoter: boolean; side: "BUY" | "SELL"; mode: string; shares: number | null; pctAfter: number | null; file: string; n500: boolean };
export type StakesResponse = { from: string; to: string; count: number; rows: StakeChange[] };

// Company financials (server/financials.mjs). Money is in ₹ crore, growth and margins in %, EPS in ₹.
export type FinRow = {
  s: string; name: string; industry: string; lender: boolean; jump: boolean;
  qDate: number; rev: number | null; ni: number | null; eps: number | null; opm: number | null; npm: number | null;
  revQoQ: number | null; niQoQ: number | null; epsQoQ: number | null; revYoY: number | null; niYoY: number | null; epsYoY: number | null; turnaround: boolean;
  fyDate: number | null; fyRev: number | null; fyNi: number | null; revG1: number | null; revG3: number | null; niG1: number | null; niG3: number | null; epsG3: number | null;
  roce: number | null; roe: number | null; de: number | null;
};
export type FinSnapshot = { loading: false; at: number; refreshing: boolean; count: number; stocks: FinRow[] } | { loading: true; done: number; total: number; error: string | null };

async function get<T>(path: string): Promise<T> {
  const r = await hiveFetch(path, { cache: "no-store" });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j as T;
}

export const api = {
  bars: (symbol: string, tf: string, limit = 3000) =>
    get<BarsResponse>(`/api/bars?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&limit=${limit}`),
  search: (q: string) => get<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
  match: (tokens: string[]) => get<{ token: string; symbol: string | null; name?: string; fuzzy?: boolean; prefix?: boolean; candidates?: { symbol: string; name: string }[] }[]>(`/api/match?tokens=${tokens.map(encodeURIComponent).join(",")}`),
  breadth: (universe: string, tf: string) => get<Breadth>(`/api/breadth?universe=${universe}&tf=${encodeURIComponent(tf)}`),
  snapshot: () => get<Snapshot>("/api/snapshot"),
  indices: () => get<{ at: number; rows: IndexRow[] }>("/api/indices"),
  deals: (days: number) => get<DealsResponse>(`/api/deals?days=${days}`),
  announcements: (days: number) => get<AnnouncementsResponse>(`/api/announcements?days=${days}`),
  calendar: (days: number) => get<CalendarResponse>(`/api/calendar?days=${days}`),
  financials: () => get<FinSnapshot>("/api/financials"),
  shareholding: () => get<ShareholdingResponse>("/api/shareholding"),
  stakes: (days: number) => get<StakesResponse>(`/api/stakes?days=${days}`),
  symbol: (symbol: string) => get<SymbolInfo>(`/api/symbol?symbol=${encodeURIComponent(symbol)}`),
  quotes: (symbols: string[]) => get<Record<string, Quote>>(`/api/quotes?symbols=${symbols.map(encodeURIComponent).join(",")}`),
};

type BarListener = (bar: Bar) => void;
type QuoteListener = (symbol: string, q: Quote) => void;

// One socket per tab, shared by every chart and the watchlist. Reconnects and resubscribes.
class Stream {
  private ws: WebSocket | null = null;
  private bars = new Map<string, Set<BarListener>>();
  private quoteCounts = new Map<string, number>();
  private quoteListeners = new Set<QuoteListener>();
  private statusListeners = new Set<(s: FeedStatus) => void>();
  private retry = 0;
  status: FeedStatus = { upstox: "connecting" };
  connected = false;

  private connecting = false;
  private ended = false; // access revoked or signed out: stop reconnecting
  private reauthTimer: ReturnType<typeof setTimeout> | undefined;

  // The token goes in the first message (never the URL). The server closes the socket with 4401 when the
  // token expires, so a fresh one is sent on the open socket about a minute before that, and after any close
  // the socket reconnects with a freshly issued token.
  private ensure() {
    if (typeof window === "undefined" || this.ws || this.connecting || this.ended) return;
    this.connecting = true;
    hiveToken()
      .then(({ token }) => {
        this.connecting = false;
        if (this.ws || this.ended) return;
        this.open(token);
      })
      .catch((e) => {
        this.connecting = false;
        if (e instanceof HiveAccessEnded) {
          this.ended = true;
          return;
        }
        this.retryLater();
      });
  }

  private retryLater() {
    this.statusListeners.forEach((f) => f({ upstox: "offline" }));
    setTimeout(() => this.ensure(), Math.min(15000, 500 * 2 ** this.retry++));
  }

  private open(token: string) {
    let ws: WebSocket;
    try {
      ws = new WebSocket(hiveWsUrl());
    } catch {
      return this.retryLater();
    }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: "auth", token }));
      this.connected = true;
      this.retry = 0;
      for (const key of this.bars.keys()) {
        const [s, tf] = key.split("|");
        ws.send(JSON.stringify({ op: "sub", s, tf }));
      }
      if (this.quoteCounts.size) ws.send(JSON.stringify({ op: "qsub", s: [...this.quoteCounts.keys()] }));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === "bar") this.bars.get(`${m.s}|${m.tf}`)?.forEach((f) => f(m.bar));
      else if (m.t === "quote") this.quoteListeners.forEach((f) => f(m.s, m.q));
      else if (m.t === "status") {
        this.status = m.feeds;
        this.statusListeners.forEach((f) => f(m.feeds));
      } else if (m.t === "auth") this.scheduleReauth(ws, m.exp * 1000);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      clearTimeout(this.reauthTimer);
      this.ws = null;
      this.connected = false;
      if (e.code === 4401) {
        // Token expired or refused: get a new one right away (a removed member's request is refused here).
        this.statusListeners.forEach((f) => f({ upstox: "offline" }));
        this.connecting = true;
        hiveToken(true)
          .then(({ token }) => {
            this.connecting = false;
            if (!this.ws && !this.ended) this.open(token);
          })
          .catch((err) => {
            this.connecting = false;
            if (err instanceof HiveAccessEnded) this.ended = true;
            else this.retryLater();
          });
        return;
      }
      this.retryLater();
    };
  }

  private scheduleReauth(ws: WebSocket, expiresAtMs: number) {
    clearTimeout(this.reauthTimer);
    const wait = Math.max(5_000, expiresAtMs - Date.now() - 60_000);
    this.reauthTimer = setTimeout(() => {
      hiveToken(true)
        .then(({ token }) => {
          if (this.ws === ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: "auth", token }));
        })
        .catch((err) => {
          if (err instanceof HiveAccessEnded) this.ended = true;
        });
    }, wait);
  }

  private send(msg: object) {
    this.ensure();
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  subscribeBars(symbol: string, tf: string, fn: BarListener) {
    const key = `${symbol}|${tf}`;
    let set = this.bars.get(key);
    if (!set) {
      this.bars.set(key, (set = new Set()));
      this.send({ op: "sub", s: symbol, tf });
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (!set!.size) {
        this.bars.delete(key);
        this.send({ op: "unsub", s: symbol, tf });
      }
    };
  }

  watchQuotes(symbols: string[]) {
    const added = symbols.filter((s) => {
      const n = this.quoteCounts.get(s) || 0;
      this.quoteCounts.set(s, n + 1);
      return n === 0;
    });
    if (added.length) this.send({ op: "qsub", s: added });
    return () => {
      const gone = symbols.filter((s) => {
        const n = (this.quoteCounts.get(s) || 1) - 1;
        if (n <= 0) this.quoteCounts.delete(s);
        else this.quoteCounts.set(s, n);
        return n <= 0;
      });
      if (gone.length) this.send({ op: "qunsub", s: gone });
    };
  }

  onQuote(fn: QuoteListener) {
    this.ensure();
    this.quoteListeners.add(fn);
    return () => void this.quoteListeners.delete(fn);
  }

  onStatus(fn: (s: FeedStatus) => void) {
    this.ensure();
    this.statusListeners.add(fn);
    fn(this.status);
    return () => void this.statusListeners.delete(fn);
  }
}

export const stream = new Stream();

// ---------- formatting ----------
// Decimals that suit a price: 2 for most, more for very small prices.
export const digitsFor = (price: number) => {
  const a = Math.abs(price);
  return a >= 1 ? 2 : a >= 0.01 ? 4 : 8;
};

export function fmtPrice(v: number | null | undefined, digits?: number) {
  if (v == null || !Number.isFinite(v)) return "—";
  const d = digits ?? digitsFor(v);
  return v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtVol(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toFixed(0);
}
export const fmtPct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
export const ticker = (id: string) => id.split(":").pop() || id;
export const exchangeOf = (id: string) => (id.includes(":") ? id.split(":")[0] : "");
