// A broker emulator that fills orders the way TradingView's strategy tester does by default:
// a strategy runs on each bar's close and places orders; they fill on the following bars.
//   market orders  next bar's open
//   stop orders    when price reaches the stop (at the open if it gaps through)
//   limit orders   when price reaches the limit (at the open if it gaps through)
// Inside a bar, prices are assumed to go open -> nearer of high/low -> the other -> close.
import type { Bar } from "../data";

export type Dir = "long" | "short";
export type Order = { id: string; dir: Dir; kind: "entry" | "exit"; stop?: number; limit?: number; fromEntry?: string; comment?: string; placedAt: number };
export type Trade = {
  n: number;
  dir: Dir;
  entryId: string;
  entryTime: number;
  entryPrice: number;
  exitId: string;
  exitTime: number;
  exitPrice: number;
  qty: number;
  profit: number; // after commission
  profitPct: number;
  commission: number;
  runUp: number;
  drawdown: number;
  bars: number;
  cumProfit: number;
  open?: boolean;
};

export type Properties = {
  capital: number;
  sizeType: "Fixed" | "% of equity" | "Cash";
  size: number;
  commissionPct: number;
  slippageTicks: number;
  pyramiding: number;
  direction: "Both" | "Long only" | "Short only";
  stopLossPct: number; // 0 = off
  takeProfitPct: number; // 0 = off
};

export const DEFAULT_PROPERTIES: Properties = {
  capital: 1000000,
  sizeType: "% of equity",
  size: 10,
  commissionPct: 0.03,
  slippageTicks: 0,
  pyramiding: 1,
  direction: "Both",
  stopLossPct: 0,
  takeProfitPct: 0,
};

export type StrategyApi = {
  i: number;
  bars: Bar[];
  mintick: number;
  position: () => { dir: Dir | null; qty: number; avgPrice: number };
  entry: (id: string, dir: Dir, opts?: { stop?: number; limit?: number; comment?: string }) => void;
  close: (id?: string, comment?: string) => void;
  closeAll: (comment?: string) => void;
  exit: (id: string, fromEntry: string, opts: { stop?: number; limit?: number; comment?: string }) => void;
  cancel: (id: string) => void;
  cancelAll: () => void;
};

type Lot = { id: string; dir: Dir; qty: number; price: number; time: number; index: number; hi: number; lo: number };

export type BacktestResult = {
  trades: Trade[];
  equity: { time: number; value: number; drawdown: number }[];
  buyHold: { time: number; value: number }[];
  stats: Stats;
  props: Properties;
  // When equity fell to zero or below, the time of the bar: the strategy stops trading there.
  ruinedAt: number | null;
};

export function runStrategy(bars: Bar[], onBar: (s: StrategyApi) => void, props: Properties, mintick = 0.01): BacktestResult {
  let cash = props.capital;
  let lots: Lot[] = [];
  let orders: Order[] = [];
  const trades: Trade[] = [];
  const equity: BacktestResult["equity"] = [];
  let peak = props.capital;
  let cum = 0;
  let ruinedAt: number | null = null;
  const slip = props.slippageTicks * mintick;
  const allowed = (dir: Dir) => props.direction === "Both" || (props.direction === "Long only" ? dir === "long" : dir === "short");

  const posDir = (): Dir | null => (lots.length ? lots[0].dir : null);
  const posQty = () => lots.reduce((a, l) => a + l.qty, 0);
  const mark = (price: number) => lots.reduce((a, l) => a + (l.dir === "long" ? 1 : -1) * l.qty * (price - l.price), 0);

  const sizeFor = (price: number) => {
    const eq = cash + mark(price);
    if (props.sizeType === "Fixed") return props.size;
    const money = props.sizeType === "Cash" ? props.size : (eq * props.size) / 100;
    // Whole units for stocks; fractional for anything priced like crypto under 1 unit of money.
    const q = money / price;
    return q >= 1 ? Math.floor(q) : Math.floor(q * 1e6) / 1e6;
  };

  const closeLot = (l: Lot, price: number, time: number, index: number, exitId: string, qty = l.qty) => {
    const sign = l.dir === "long" ? 1 : -1;
    const fill = price - sign * slip;
    const commission = ((l.price * qty + fill * qty) * props.commissionPct) / 100;
    const profit = sign * (fill - l.price) * qty - commission;
    cash += profit;
    cum += profit;
    trades.push({
      n: trades.length + 1,
      dir: l.dir,
      entryId: l.id,
      entryTime: l.time,
      entryPrice: l.price,
      exitId,
      exitTime: time,
      exitPrice: fill,
      qty,
      profit,
      profitPct: (sign * (fill - l.price) * 100) / l.price,
      commission,
      runUp: sign > 0 ? (l.hi - l.price) * qty : (l.price - l.lo) * qty,
      drawdown: sign > 0 ? (l.lo - l.price) * qty : (l.price - l.hi) * qty,
      bars: index - l.index,
      cumProfit: cum,
    });
    l.qty -= qty;
  };

  const flatten = (price: number, time: number, index: number, exitId: string) => {
    for (const l of lots) closeLot(l, price, time, index, exitId);
    lots = [];
  };

  const fillEntry = (o: Order, price: number, time: number, index: number) => {
    const cur = posDir();
    if (cur && cur !== o.dir) flatten(price, time, index, o.id); // reversal
    else if (cur === o.dir && lots.length >= props.pyramiding) return false;
    const sign = o.dir === "long" ? 1 : -1;
    const fill = price + sign * slip;
    const qty = sizeFor(fill);
    if (qty <= 0) return false;
    lots.push({ id: o.id, dir: o.dir, qty, price: fill, time, index, hi: fill, lo: fill });
    // A new entry replaces any stop/target left over from an earlier entry with the same id.
    orders = orders.filter((x) => !(x.kind === "exit" && x.fromEntry === o.id));
    // Stop loss / take profit from the properties ride along as an exit bracket.
    if (props.stopLossPct > 0 || props.takeProfitPct > 0)
      orders.push({
        id: `${o.id} SL/TP`,
        dir: o.dir,
        kind: "exit",
        fromEntry: o.id,
        stop: props.stopLossPct > 0 ? fill * (1 - (sign * props.stopLossPct) / 100) : undefined,
        limit: props.takeProfitPct > 0 ? fill * (1 + (sign * props.takeProfitPct) / 100) : undefined,
        placedAt: index,
      });
    return true;
  };

  // Where an order would fill on bar b, or null. Prices visited: open, near extreme, far extreme, close.
  const triggerPrice = (o: Order, b: Bar, isBuy: boolean): number | null => {
    if (o.stop == null && o.limit == null) return b.open;
    const candidates: number[] = [];
    if (o.stop != null) {
      if (isBuy && b.high >= o.stop) candidates.push(Math.max(b.open, o.stop));
      if (!isBuy && b.low <= o.stop) candidates.push(Math.min(b.open, o.stop));
    }
    if (o.limit != null) {
      if (isBuy && b.low <= o.limit) candidates.push(Math.min(b.open, o.limit));
      if (!isBuy && b.high >= o.limit) candidates.push(Math.max(b.open, o.limit));
    }
    if (!candidates.length) return null;
    // The one reached first along the open -> near extreme -> far extreme path.
    const nearHighFirst = Math.abs(b.high - b.open) < Math.abs(b.open - b.low);
    const order = (p: number) => (p === b.open ? 0 : nearHighFirst ? (p >= b.open ? 1 : 2) : p <= b.open ? 1 : 2);
    candidates.sort((x, y) => order(x) - order(y));
    return candidates[0];
  };

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    // 1) Fill what was placed on earlier bars.
    if (i > 0) {
      const pending = orders;
      orders = [];
      for (const o of pending) {
        if (o.kind === "entry") {
          if (!allowed(o.dir)) continue;
          const px = triggerPrice(o, b, o.dir === "long");
          if (px == null || !fillEntry(o, px, b.time, i)) orders.push(o);
        } else {
          const lot = o.fromEntry ? lots.find((l) => l.id === o.fromEntry) : lots[0];
          if (!lot) continue; // the entry it protects is gone
          const px = triggerPrice(o, b, lot.dir === "short");
          if (px == null) orders.push(o);
          else {
            for (const l of lots.filter((x) => !o.fromEntry || x.id === o.fromEntry)) closeLot(l, px, b.time, i, o.id);
            lots = lots.filter((l) => l.qty > 0);
          }
        }
      }
    }
    for (const l of lots) (l.hi = Math.max(l.hi, b.high)), (l.lo = Math.min(l.lo, b.low));
    // 2) Run the strategy on this bar's close.
    const api: StrategyApi = {
      i,
      bars,
      mintick,
      position: () => ({ dir: posDir(), qty: posQty(), avgPrice: lots.length ? lots.reduce((a, l) => a + l.price * l.qty, 0) / posQty() : 0 }),
      entry: (id, dir, opts = {}) => {
        if (!allowed(dir)) {
          // TradingView: an entry in a disallowed direction closes the opposite position.
          if (posDir() && posDir() !== dir) orders.push({ id: `Close ${id}`, dir: posDir()!, kind: "exit", placedAt: i, comment: opts.comment });
          return;
        }
        orders = orders.filter((o) => o.id !== id);
        orders.push({ id, dir, kind: "entry", stop: opts.stop, limit: opts.limit, comment: opts.comment, placedAt: i });
      },
      close: (id, comment) => {
        if (lots.some((l) => !id || l.id === id)) orders.push({ id: `Close ${id || "position"}`, dir: posDir()!, kind: "exit", fromEntry: id, placedAt: i, comment });
      },
      closeAll: (comment) => {
        if (lots.length) orders.push({ id: "Close position", dir: posDir()!, kind: "exit", placedAt: i, comment });
      },
      exit: (id, fromEntry, opts) => {
        orders = orders.filter((o) => o.id !== id);
        orders.push({ id, dir: posDir() || "long", kind: "exit", fromEntry, stop: opts.stop, limit: opts.limit, comment: opts.comment, placedAt: i });
      },
      cancel: (id) => (orders = orders.filter((o) => o.id !== id)),
      cancelAll: () => (orders = orders.filter((o) => o.kind === "exit")),
    };
    if (ruinedAt == null) onBar(api);
    const eq = cash + mark(b.close);
    if (eq <= 0 && ruinedAt == null) {
      ruinedAt = b.time;
      flatten(b.close, b.time, i, "Margin call");
      orders = [];
    }
    peak = Math.max(peak, eq);
    equity.push({ time: b.time, value: eq, drawdown: eq - peak });
  }
  // Open position at the end: shown as an open trade, valued at the last close.
  const last = bars[bars.length - 1];
  if (last)
    for (const l of lots) {
      const sign = l.dir === "long" ? 1 : -1;
      trades.push({
        n: trades.length + 1,
        dir: l.dir,
        entryId: l.id,
        entryTime: l.time,
        entryPrice: l.price,
        exitId: "Open",
        exitTime: last.time,
        exitPrice: last.close,
        qty: l.qty,
        profit: sign * (last.close - l.price) * l.qty,
        profitPct: (sign * (last.close - l.price) * 100) / l.price,
        commission: 0,
        runUp: 0,
        drawdown: 0,
        bars: bars.length - 1 - l.index,
        cumProfit: cum + sign * (last.close - l.price) * l.qty,
        open: true,
      });
    }
  const first = bars[0];
  const buyHold = bars.map((b) => ({ time: b.time, value: first ? props.capital * (b.close / first.close) : props.capital }));
  return { trades, equity, buyHold, stats: stats(trades, equity, props, bars), props, ruinedAt };
}

export type SideStats = {
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgTrade: number;
  avgWin: number;
  avgLoss: number;
  ratioAvgWinLoss: number;
  largestWin: number;
  largestLoss: number;
  avgBars: number;
  commission: number;
};
export type Stats = {
  all: SideStats;
  long: SideStats;
  short: SideStats;
  netProfitPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  buyHoldPct: number;
  sharpe: number | null;
  sortino: number | null;
  openPL: number;
};

function side(ts: Trade[]): SideStats {
  const closed = ts.filter((t) => !t.open);
  const wins = closed.filter((t) => t.profit > 0),
    losses = closed.filter((t) => t.profit <= 0);
  const gp = wins.reduce((a, t) => a + t.profit, 0),
    gl = -losses.reduce((a, t) => a + t.profit, 0);
  const avgWin = wins.length ? gp / wins.length : 0,
    avgLoss = losses.length ? gl / losses.length : 0;
  return {
    netProfit: gp - gl,
    grossProfit: gp,
    grossLoss: gl,
    profitFactor: gl ? gp / gl : gp ? Infinity : 0,
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    avgTrade: closed.length ? (gp - gl) / closed.length : 0,
    avgWin,
    avgLoss,
    ratioAvgWinLoss: avgLoss ? avgWin / avgLoss : 0,
    largestWin: Math.max(0, ...wins.map((t) => t.profit)),
    largestLoss: Math.min(0, ...losses.map((t) => t.profit)),
    avgBars: closed.length ? closed.reduce((a, t) => a + t.bars, 0) / closed.length : 0,
    commission: closed.reduce((a, t) => a + t.commission, 0),
  };
}

function stats(trades: Trade[], equity: BacktestResult["equity"], props: Properties, bars: Bar[]): Stats {
  const all = side(trades);
  let maxDd = 0,
    maxDdPct = 0,
    peak = props.capital;
  for (const e of equity) {
    peak = Math.max(peak, e.value);
    maxDd = Math.min(maxDd, e.value - peak);
    maxDdPct = Math.min(maxDdPct, ((e.value - peak) / peak) * 100);
  }
  // Monthly returns, as TradingView's Sharpe and Sortino use (risk-free rate 2% a year).
  const monthly: number[] = [];
  let lastKey = "",
    start = props.capital,
    prev = props.capital;
  for (const e of equity) {
    const key = new Date(e.time * 1000).toISOString().slice(0, 7);
    if (key !== lastKey && lastKey) {
      monthly.push((prev - start) / start);
      start = prev;
    }
    lastKey = key;
    prev = e.value;
  }
  if (lastKey) monthly.push((prev - start) / start);
  const rf = 0.02 / 12;
  const mean = monthly.reduce((a, b) => a + b, 0) / (monthly.length || 1);
  const sd = Math.sqrt(monthly.reduce((a, r) => a + (r - mean) ** 2, 0) / (monthly.length || 1));
  const down = Math.sqrt(monthly.reduce((a, r) => a + Math.min(0, r - rf) ** 2, 0) / (monthly.length || 1));
  const open = trades.filter((t) => t.open).reduce((a, t) => a + t.profit, 0);
  return {
    all,
    long: side(trades.filter((t) => t.dir === "long")),
    short: side(trades.filter((t) => t.dir === "short")),
    netProfitPct: (all.netProfit / props.capital) * 100,
    maxDrawdown: maxDd,
    maxDrawdownPct: maxDdPct,
    buyHoldPct: bars.length ? ((bars[bars.length - 1].close - bars[0].close) / bars[0].close) * 100 : 0,
    sharpe: monthly.length > 2 && sd ? (mean - rf) / sd : null,
    sortino: monthly.length > 2 && down ? (mean - rf) / down : null,
    openPL: open,
  };
}
