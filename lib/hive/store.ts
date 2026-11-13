// App state in one place, saved to this browser (localStorage) on every change.
import { useSyncExternalStore } from "react";
import type { IndicatorInstance, Magnet } from "./chart/engine";
import type { Drawing } from "./drawings/types";
import { hiveKey, hiveUser } from "./user";

export type WatchSection = { name: string; symbols: string[] };
export type WatchSort = { key: "symbol" | "last" | "chg" | "chgPct"; dir: "asc" | "desc" };
export type WatchList = { id: string; name: string; sections: WatchSection[]; sort?: WatchSort | null }; // sort: null/absent = custom order

export type State = {
  symbol: string;
  tf: string;
  type: string;
  log: boolean;
  percent: boolean;
  indicators: IndicatorInstance[];
  drawings: Record<string, Drawing[]>;
  lists: WatchList[]; // each one is its own watchlist "page"
  activeList: string;
  favoriteTfs: string[];
  favoriteTools: string[];
  lastTool: Record<string, string>; // group -> last used tool, like TradingView's toolbar
  magnet: Magnet;
  keepDrawing: boolean;
  lockAll: boolean;
  hideAll: boolean;
  theme: "dark" | "light";
  rightPanel: "watchlist" | null;
  watchWidth: number; // px, dragged by the user
  watchCols: { symbol: boolean; last: boolean; chg: boolean; chgPct: boolean }; // which watchlist columns show
  favBar: boolean; // floating favourites bar on the chart
  favBarPos: { x: number; y: number }; // px from the chart's top-left
};

const DEFAULTS: State = {
  symbol: "NSE:NIFTY",
  tf: "1D",
  type: "candles",
  log: false,
  percent: false,
  indicators: [],
  drawings: {},
  lists: [
    {
      id: "main",
      name: "Watchlist",
      sections: [
      { name: "Indices", symbols: ["NSE:NIFTY", "NSE:BANKNIFTY", "NSE:FINNIFTY", "BSE:SENSEX", "NSE:INDIAVIX"] },
      { name: "Stocks", symbols: ["NSE:RELIANCE", "NSE:HDFCBANK", "NSE:ICICIBANK", "NSE:INFY", "NSE:TCS", "NSE:KRISHNADEF"] },
      { name: "Futures", symbols: ["NSE:NIFTY1!", "NSE:BANKNIFTY1!", "MCX:CRUDEOIL1!", "MCX:GOLD1!"] },
      { name: "Global", symbols: ["US:AAPL", "US:NVDA", "YAHOO:^GSPC", "FX:USDINR", "BINANCE:BTCUSDT", "BINANCE:ETHUSDT"] },
      ],
    },
  ],
  activeList: "main",
  favoriteTfs: ["1m", "5m", "15m", "1h", "4h", "1D", "1W"],
  favoriteTools: ["trend_line", "horizontal_line", "fib_retracement", "rectangle", "long_position", "price_range"],
  lastTool: {},
  magnet: "off",
  keepDrawing: false,
  lockAll: false,
  hideAll: false,
  theme: "dark",
  rightPanel: "watchlist",
  watchWidth: 300,
  watchCols: { symbol: true, last: true, chg: true, chgPct: true },
  favBar: true,
  favBarPos: { x: 120, y: 56 },
};

const KEY = "terminal.state.v1"; // stored as terminal.state.v1:<SOVA user id> (lib/hive/user.ts)

function load(): State {
  try {
    const raw = localStorage.getItem(hiveKey(KEY));
    if (raw) {
      const saved = JSON.parse(raw);
      // Older saves had one flat watchlist; it becomes the first list.
      if (!saved.lists && Array.isArray(saved.watchlist)) saved.lists = [{ id: "main", name: "Watchlist", sections: saved.watchlist }];
      delete saved.watchlist;
      const merged = { ...DEFAULTS, ...saved } as State;
      if (!merged.lists.some((l) => l.id === merged.activeList)) merged.activeList = merged.lists[0].id;
      return merged;
    }
  } catch {
    /* private window or blocked storage */
  }
  return DEFAULTS;
}

// Loaded lazily for the signed-in SOVA user (the original loaded at import time, before anyone is known).
let state: State = DEFAULTS;
let loadedFor: string | null = null;
function ensureLoaded() {
  const uid = typeof window === "undefined" ? null : hiveUser();
  if (!uid || loadedFor === uid) return;
  loadedFor = uid;
  state = load();
  past = [];
  future = [];
}
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getState() {
  ensureLoaded();
  return state;
}

// ---------- undo / redo ----------
// Every change to the app state (drawings, indicators, watchlists, symbol, settings) is one step.
// Changes that arrive within a moment of each other and touch the same things count as one step,
// so dragging a slider is one undo, not fifty. Panel width is layout, not an edit, so it's skipped.
const HISTORY_MAX = 200;
const MERGE_MS = 350;
const NOT_UNDOABLE: (keyof State)[] = ["watchWidth", "favBarPos"];
let past: State[] = [];
let future: State[] = [];
let lastEdit = { at: 0, sig: "" };

function commit() {
  listeners.forEach((l) => l());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(hiveKey(KEY), JSON.stringify(state));
    } catch {
      /* storage full or blocked */
    }
  }, 300);
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>), opts?: { history?: boolean }) {
  ensureLoaded();
  const p = typeof patch === "function" ? patch(state) : patch;
  const changed = (Object.keys(p) as (keyof State)[]).filter((k) => p[k] !== state[k] && !NOT_UNDOABLE.includes(k));
  if (changed.length && opts?.history !== false) {
    const sig = changed.sort().join();
    const now = Date.now();
    if (sig !== lastEdit.sig || now - lastEdit.at > MERGE_MS) {
      past.push(state);
      if (past.length > HISTORY_MAX) past.shift();
    }
    lastEdit = { at: now, sig };
    future = [];
  }
  state = { ...state, ...p };
  commit();
}

function travel(from: State[], to: State[]) {
  ensureLoaded();
  const target = from.pop();
  if (!target) return false;
  to.push(state);
  const keep = Object.fromEntries(NOT_UNDOABLE.map((k) => [k, state[k]]));
  state = { ...target, ...keep } as State;
  lastEdit = { at: 0, sig: "" };
  commit();
  return true;
}
export const undo = () => travel(past, future);
export const redo = () => travel(future, past);

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      ensureLoaded();
      return select(state);
    },
    () => select(DEFAULTS),
  );
}

let uidSeq = 0;
export const newUid = () => `i${Date.now().toString(36)}${(uidSeq++).toString(36)}`;
