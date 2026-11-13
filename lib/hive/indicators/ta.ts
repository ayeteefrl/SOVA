// Pine-style series maths. Arrays are aligned to bars; NaN means "no value yet" (Pine's na).
import * as qt from "../engine/indicators.js";
import type { Bar } from "../data";

type S = number[];
export const N = NaN;
export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const source = qt.source as unknown as (bars: Bar[], name?: string) => S;
export const sma = qt.sma as unknown as (s: S, n: number) => S;
export const ema = qt.ema as unknown as (s: S, n: number) => S;
export const rma = qt.rma as unknown as (s: S, n: number) => S;
export const wma = qt.wma as unknown as (s: S, n: number) => S;
export const vwma = qt.vwma as unknown as (s: S, v: S, n: number) => S;
export const hma = qt.hma as unknown as (s: S, n: number) => S;
export const linreg = qt.linreg as unknown as (s: S, n: number, offset?: number) => S;
export const stdev = qt.stdev as unknown as (s: S, n: number) => S;
export const highest = qt.highest as unknown as (s: S, n: number) => S;
export const lowest = qt.lowest as unknown as (s: S, n: number) => S;
export const tr = qt.tr as unknown as (bars: Bar[]) => S;
export const atr = qt.atr as unknown as (bars: Bar[], n?: number) => S;
export const rsi = qt.rsiOf as unknown as (s: S, n?: number) => S;
export const crossover = qt.crossover as unknown as (a: S, b: S) => boolean[];
export const crossunder = qt.crossunder as unknown as (a: S, b: S) => boolean[];
export const change = qt.change as unknown as (s: S, n?: number) => S;
export const sum = qt.sum as unknown as (s: S, n: number) => S;

// Pine's ta.ma by name, for the "MA type" inputs TradingView indicators have.
export const MA_TYPES = ["SMA", "EMA", "SMMA (RMA)", "WMA", "VWMA"];
export function ma(type: string, s: S, n: number, volume?: S): S {
  switch (type) {
    case "EMA":
      return ema(s, n);
    case "SMMA (RMA)":
    case "RMA":
      return rma(s, n);
    case "WMA":
      return wma(s, n);
    case "VWMA":
      return volume ? vwma(s, volume, n) : sma(s, n);
    case "HMA":
      return hma(s, n);
    default:
      return sma(s, n);
  }
}

export const nz = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
export const shift = (s: S, k: number): S => s.map((_, i) => (i - k >= 0 && i - k < s.length ? s[i - k] : N));
export const cum = (s: S): S => {
  let t = 0;
  return s.map((v) => (t += nz(v)));
};
export const roc = (s: S, n: number): S => s.map((v, i) => (i >= n && s[i - n] ? (100 * (v - s[i - n])) / s[i - n] : N));
export const mom = (s: S, n: number): S => s.map((v, i) => (i >= n ? v - s[i - n] : N));

// Rolling window helper: fn gets the last n values (oldest first) once n are available.
export function rolling(s: S, n: number, fn: (w: S) => number): S {
  const out = new Array(s.length).fill(N);
  for (let i = n - 1; i < s.length; i++) {
    const w = s.slice(i - n + 1, i + 1);
    if (w.every(Number.isFinite)) out[i] = fn(w);
  }
  return out;
}

export const median = (s: S, n: number) =>
  rolling(s, n, (w) => {
    const a = [...w].sort((x, y) => x - y);
    return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
  });

// Pine's ta.percentrank: % of the previous n values less than or equal to the current one.
export const percentrank = (s: S, n: number) =>
  s.map((v, i) => {
    if (i < n || !Number.isFinite(v)) return N;
    let c = 0;
    for (let k = i - n; k < i; k++) if (s[k] <= v) c++;
    return (100 * c) / n;
  });

// Pine's ta.correlation (Pearson over n bars).
export function correlation(a: S, b: S, n: number): S {
  return a.map((_, i) => {
    if (i < n - 1) return N;
    let sa = 0,
      sb = 0,
      saa = 0,
      sbb = 0,
      sab = 0;
    for (let k = i - n + 1; k <= i; k++) {
      const x = a[k],
        y = b[k];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return N;
      sa += x;
      sb += y;
      saa += x * x;
      sbb += y * y;
      sab += x * y;
    }
    const cov = sab / n - (sa / n) * (sb / n);
    const va = saa / n - (sa / n) ** 2,
      vb = sbb / n - (sb / n) ** 2;
    return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : N;
  });
}

// Pine's ta.pivothigh/pivotlow: the value at bar i-right when it's the extreme of left+right+1 bars.
// Returned aligned to the bar where the pivot is confirmed (i), like Pine.
export function pivotHigh(s: S, left: number, right: number): S {
  return s.map((_, i) => {
    const c = i - right;
    if (c - left < 0) return N;
    const v = s[c];
    // Higher than everything to its left, at least as high as everything to its right.
    for (let k = c - left; k < c; k++) if (!(s[k] < v)) return N;
    for (let k = c + 1; k <= i; k++) if (s[k] > v) return N;
    return v;
  });
}
export function pivotLow(s: S, left: number, right: number): S {
  return s.map((_, i) => {
    const c = i - right;
    if (c - left < 0) return N;
    const v = s[c];
    for (let k = c - left; k < c; k++) if (!(s[k] > v)) return N;
    for (let k = c + 1; k <= i; k++) if (s[k] < v) return N;
    return v;
  });
}

export function barsSince(cond: boolean[]): S {
  let last = -1;
  return cond.map((c, i) => {
    if (c) last = i;
    return last < 0 ? N : i - last;
  });
}

// Pine's ta.valuewhen(cond, src, 0): the source value on the most recent bar where cond was true.
export function valueWhen(cond: boolean[], s: S): S {
  let v = N;
  return cond.map((c, i) => (c ? (v = s[i]) : v));
}

export const hl2 = (bars: Bar[]) => bars.map((b) => (b.high + b.low) / 2);
export const hlc3 = (bars: Bar[]) => bars.map((b) => (b.high + b.low + b.close) / 3);
export const SOURCE_INPUT = { key: "source", label: "Source", type: "source" as const, default: "close" };
export const len = (d: number, label = "Length", key = "length") => ({ key, label, type: "int" as const, default: d, min: 1 });
