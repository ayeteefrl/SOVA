// TradingView standard indicators in their own pane.
import * as qt from "../../engine/indicators.js";
import type { Bar } from "../../data";
import type { IndicatorDef, Label, Segment } from "../types";
import { N, SOURCE_INPUT, atr, change, correlation, cum, ema, highest, isNum, len, lowest, pivotHigh, pivotLow, roc, rsi, sma, source, sum, wma } from "../ta";

const qc = qt.compute as unknown as (id: string, bars: Bar[], p?: Record<string, unknown>) => Record<string, number[]>;

// Rank correlation index (Spearman of price vs time), as TradingView computes RCI.
function rci(s: number[], n: number) {
  return s.map((_, i) => {
    if (i < n - 1) return N;
    const w = s.slice(i - n + 1, i + 1);
    const order = w.map((v, k) => ({ v, k })).sort((a, b) => b.v - a.v);
    const rank = new Array(n);
    order.forEach((o, r) => (rank[o.k] = r + 1));
    let d = 0;
    for (let k = 0; k < n; k++) d += (n - k - rank[k]) ** 2;
    return (1 - (6 * d) / (n * (n * n - 1))) * 100;
  });
}

export const OSCILLATOR_INDICATORS: IndicatorDef[] = [
  {
    id: "vol24",
    name: "24-hour volume",
    group: "Volume",
    overlay: false,
    volumeFormat: true,
    inputs: [{ key: "quote", label: "In quote currency (price × volume)", type: "bool", default: true }],
    outputs: [{ key: "value", label: "24h volume", kind: "line", color: "#2962ff" }],
    calc: (bars, p) => {
      const out = new Array(bars.length).fill(N);
      let j = 0,
        acc = 0;
      const v = bars.map((b) => (b.volume || 0) * (p.quote ? b.close : 1));
      for (let i = 0; i < bars.length; i++) {
        acc += v[i];
        while (bars[i].time - bars[j].time >= 86400) acc -= v[j++];
        out[i] = acc;
      }
      return { value: out };
    },
  },
  {
    id: "aroonosc",
    name: "Aroon oscillator",
    group: "Trend",
    overlay: false,
    inputs: [len(14)],
    outputs: [{ key: "value", label: "Aroon oscillator", kind: "line", color: "#2962ff" }],
    levels: [-90, 0, 90],
    fills: [
      { id: "pos", label: "Positive", from: "value", to: "level:0", clip: "above", color: "rgba(8,153,129,0.2)" },
      { id: "neg", label: "Negative", from: "value", to: "level:0", clip: "below", color: "rgba(242,54,69,0.2)" },
    ],
    calc: (bars, p) => {
      const a = qc("aroon", bars, p);
      return { value: a.up.map((u, i) => u - a.down[i]) };
    },
  },
  {
    id: "adr",
    name: "Average daily range",
    group: "Volatility",
    overlay: false,
    inputs: [len(14)],
    outputs: [{ key: "value", label: "ADR", kind: "line", color: "#2962ff" }],
    calc: (bars, p) => ({ value: sma(bars.map((b) => b.high - b.low), p.length as number) }),
  },
  {
    id: "bbpower",
    name: "Bull bear power",
    group: "Momentum",
    overlay: false,
    inputs: [len(13)],
    outputs: [{ key: "value", label: "BBPower", kind: "histogram", color: "#089981" }],
    calc: (bars, p) => {
      const e = ema(source(bars, "close"), p.length as number);
      const value = bars.map((b, i) => b.high - e[i] + (b.low - e[i]));
      return { value, colors: value.map((v, i) => (v >= 0 ? (v >= (value[i - 1] ?? 0) ? "#089981" : "#b2dfdb") : v <= (value[i - 1] ?? 0) ? "#f23645" : "#ffcdd2")) };
    },
  },
  {
    id: "correlation",
    name: "Correlation coefficient",
    group: "Momentum",
    overlay: false,
    inputs: [{ key: "symbol", label: "Symbol", type: "symbol", default: "NSE:NIFTY" }, len(20), SOURCE_INPUT],
    outputs: [{ key: "value", label: "Correlation", kind: "line", color: "#2962ff", plot: "area" }],
    levels: [1, 0, -1],
    calc: (bars, p) => {
      const cmp = p.symbol__bars as (Bar | null)[] | undefined;
      if (!cmp) return { pending: true };
      const a = source(bars, p.source as string),
        b = cmp.map((x) => (x ? (x as unknown as Record<string, number>)[(p.source as string) || "close"] ?? x.close : N));
      return { value: correlation(a, b, p.length as number) };
    },
  },
  {
    id: "nvi",
    name: "Negative volume index",
    group: "Volume",
    overlay: false,
    inputs: [{ key: "emaLength", label: "EMA length", type: "int", default: 255, min: 1 }],
    outputs: [
      { key: "value", label: "NVI", kind: "line", color: "#2962ff" },
      { key: "ema", label: "NVI EMA", kind: "line", color: "#ff6d00" },
    ],
    calc: (bars, p) => {
      let x = 1000;
      const value = bars.map((b, i) => (i && (b.volume || 0) < (bars[i - 1].volume || 0) ? (x += (x * (b.close - bars[i - 1].close)) / bars[i - 1].close) : x));
      return { value, ema: ema(value, p.emaLength as number) };
    },
  },
  {
    id: "pvi",
    name: "Positive volume index",
    group: "Volume",
    overlay: false,
    inputs: [{ key: "emaLength", label: "EMA length", type: "int", default: 255, min: 1 }],
    outputs: [
      { key: "value", label: "PVI", kind: "line", color: "#2962ff" },
      { key: "ema", label: "PVI EMA", kind: "line", color: "#ff6d00" },
    ],
    calc: (bars, p) => {
      let x = 1000;
      const value = bars.map((b, i) => (i && (b.volume || 0) > (bars[i - 1].volume || 0) ? (x += (x * (b.close - bars[i - 1].close)) / bars[i - 1].close) : x));
      return { value, ema: ema(value, p.emaLength as number) };
    },
  },
  {
    id: "oi",
    name: "Open interest",
    group: "Volume",
    overlay: false,
    volumeFormat: true,
    description: "Open contracts on futures and options (Indian F&O through Upstox).",
    inputs: [],
    outputs: [{ key: "value", label: "Open interest", kind: "histogram", color: "#2962ff" }],
    calc: (bars) => {
      const value = bars.map((b) => (b.oi ? b.oi : N));
      if (!value.some(isNum)) return { error: "No open interest for this symbol (futures and options only)" };
      return { value, colors: value.map((v, i) => (i && v >= value[i - 1] ? "rgba(8,153,129,0.6)" : "rgba(242,54,69,0.6)")) };
    },
  },
  {
    id: "pvo",
    name: "Percentage volume oscillator",
    group: "Volume",
    overlay: false,
    inputs: [{ key: "fast", label: "Short length", type: "int", default: 12, min: 1 }, { key: "slow", label: "Long length", type: "int", default: 26, min: 1 }, { key: "signal", label: "Signal length", type: "int", default: 9, min: 1 }],
    outputs: [
      { key: "hist", label: "Histogram", kind: "histogram", color: "#26a69a" },
      { key: "pvo", label: "PVO", kind: "line", color: "#2962ff" },
      { key: "signal", label: "Signal", kind: "line", color: "#ff6d00" },
    ],
    levels: [0],
    calc: (bars, p) => {
      const v = source(bars, "volume");
      const f = ema(v, p.fast as number),
        s = ema(v, p.slow as number);
      const pvo = f.map((x, i) => (s[i] ? ((x - s[i]) / s[i]) * 100 : N));
      const sig = ema(pvo, p.signal as number);
      const hist = pvo.map((x, i) => x - sig[i]);
      return { pvo, signal: sig, hist, colors: hist.map((h, i) => (h >= 0 ? (h >= (hist[i - 1] ?? 0) ? "#26a69a" : "#b2dfdb") : h <= (hist[i - 1] ?? 0) ? "#ff5252" : "#ffcdd2")) };
    },
  },
  {
    id: "pmo",
    name: "Price momentum oscillator",
    group: "Momentum",
    overlay: false,
    inputs: [{ key: "l1", label: "First smoothing", type: "int", default: 35, min: 1 }, { key: "l2", label: "Second smoothing", type: "int", default: 20, min: 1 }, { key: "signal", label: "Signal", type: "int", default: 10, min: 1 }, SOURCE_INPUT],
    outputs: [
      { key: "pmo", label: "PMO", kind: "line", color: "#2962ff" },
      { key: "signal", label: "Signal", kind: "line", color: "#ff6d00" },
    ],
    levels: [0],
    calc: (bars, p) => {
      // DecisionPoint PMO: custom-smoothed 1-bar rate of change.
      const cs = (s: number[], n: number) => {
        const out = new Array(s.length).fill(N);
        for (let i = 0; i < s.length; i++) {
          if (!isNum(s[i])) continue;
          const prev = out[i - 1];
          out[i] = isNum(prev) ? prev + (s[i] - prev) * (2 / n) : s[i];
        }
        return out;
      };
      const r = roc(source(bars, p.source as string), 1);
      const pmo = cs(cs(r, p.l1 as number).map((x) => x * 10), p.l2 as number);
      return { pmo, signal: ema(pmo, p.signal as number) };
    },
  },
  {
    id: "specialk",
    name: "Pring's special K",
    group: "Momentum",
    overlay: false,
    inputs: [SOURCE_INPUT, { key: "signal", label: "Signal length", type: "int", default: 100, min: 1 }],
    outputs: [
      { key: "value", label: "Special K", kind: "line", color: "#2962ff" },
      { key: "signal", label: "Signal", kind: "line", color: "#ff6d00" },
    ],
    levels: [0],
    calc: (bars, p) => {
      const s = source(bars, p.source as string);
      const terms: [number, number, number][] = [
        [10, 10, 1], [15, 10, 2], [20, 10, 3], [30, 15, 4], [40, 50, 1], [65, 65, 2], [75, 75, 3], [100, 100, 4],
        [195, 130, 1], [265, 130, 2], [390, 130, 3], [530, 195, 4],
      ];
      const parts = terms.map(([r, m, w]) => sma(roc(s, r), m).map((x) => x * w));
      const value = s.map((_, i) => parts.reduce((a, x) => a + x[i], 0));
      return { value, signal: sma(value, p.signal as number) };
    },
  },
  {
    id: "rciribbon",
    name: "RCI ribbon",
    group: "Momentum",
    overlay: false,
    inputs: [{ key: "short", label: "Short RCI length", type: "int", default: 10, min: 2 }, { key: "middle", label: "Middle RCI length", type: "int", default: 30, min: 2 }, { key: "long", label: "Long RCI length", type: "int", default: 50, min: 2 }, SOURCE_INPUT],
    outputs: [
      { key: "short", label: "Short RCI", kind: "line", color: "#f23645" },
      { key: "middle", label: "Middle RCI", kind: "line", color: "#2962ff" },
      { key: "long", label: "Long RCI", kind: "line", color: "#089981" },
    ],
    levels: [80, 0, -80],
    calc: (bars, p) => {
      const s = source(bars, p.source as string);
      return { short: rci(s, p.short as number), middle: rci(s, p.middle as number), long: rci(s, p.long as number) };
    },
  },
  {
    id: "rvat",
    name: "Relative volume at time",
    group: "Volume",
    overlay: false,
    inputs: [{ key: "days", label: "Average over (sessions)", type: "int", default: 10, min: 1 }, { key: "cumulative", label: "Cumulative", type: "bool", default: true }],
    outputs: [{ key: "value", label: "Relative volume", kind: "histogram", color: "#2962ff" }],
    levels: [1],
    calc: (bars, p, _ta, ctx) => {
      // Today's volume up to this time of day against the average of the last N sessions at the same time.
      if ((ctx?.tfSeconds || 86400) >= 86400) return { error: "Relative volume at time needs an intraday chart" };
      const dayOf = (t: number) => Math.floor((t + 19800) / 86400);
      const tod = (t: number) => (t + 19800) % 86400;
      const byDay = new Map<number, Map<number, number>>();
      for (const b of bars) {
        const d = dayOf(b.time);
        if (!byDay.has(d)) byDay.set(d, new Map());
        byDay.get(d)!.set(tod(b.time), b.volume || 0);
      }
      const days = [...byDay.keys()].sort((a, b) => a - b);
      const cumAt = (d: number, t: number) => {
        let v = 0;
        for (const [k, x] of byDay.get(d) || []) if (p.cumulative ? k <= t : k === t) v += x;
        return v;
      };
      const value = bars.map((b) => {
        const d = dayOf(b.time),
          t = tod(b.time);
        const prev = days.filter((x) => x < d).slice(-(p.days as number));
        if (!prev.length) return N;
        const avg = prev.reduce((a, x) => a + cumAt(x, t), 0) / prev.length;
        return avg ? cumAt(d, t) / avg : N;
      });
      return { value, colors: value.map((v) => (v >= 1 ? "rgba(8,153,129,0.7)" : "rgba(242,54,69,0.7)")) };
    },
  },
  {
    id: "relvalue",
    name: "RelativeValue",
    group: "Volume",
    overlay: false,
    inputs: [{ key: "length", label: "Average over (bars)", type: "int", default: 20, min: 1 }, { key: "field", label: "Value", type: "select", options: ["Volume", "Range", "Traded value"], default: "Volume" }],
    outputs: [{ key: "value", label: "Relative value", kind: "histogram", color: "#2962ff" }],
    levels: [1],
    calc: (bars, p) => {
      const x = bars.map((b) => (p.field === "Range" ? b.high - b.low : p.field === "Traded value" ? (b.volume || 0) * b.close : b.volume || 0));
      const a = sma(x, p.length as number);
      const value = x.map((v, i) => (a[i - 1] ? v / a[i - 1] : N));
      return { value, colors: value.map((v) => (v >= 1 ? "rgba(8,153,129,0.7)" : "rgba(120,123,134,0.6)")) };
    },
  },
  {
    id: "adxbreakout",
    name: "Rob Booker — ADX breakout",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "length", label: "Box lookback", type: "int", default: 20, min: 2 }, { key: "adxLength", label: "ADX length", type: "int", default: 14, min: 1 }, { key: "threshold", label: "ADX lower than", type: "float", default: 18, step: 1 }],
    outputs: [
      { key: "top", label: "Box top", kind: "line", color: "#089981", plot: "step" },
      { key: "bottom", label: "Box bottom", kind: "line", color: "#f23645", plot: "step" },
    ],
    calc: (bars, p) => {
      // While ADX says "no trend", track the range box; a close outside it is the breakout.
      const adx = qc("adx", bars, { diLength: p.adxLength, adxSmoothing: p.adxLength }).adx;
      const hi = highest(source(bars, "high"), p.length as number),
        lo = lowest(source(bars, "low"), p.length as number);
      const top = new Array(bars.length).fill(N),
        bottom = new Array(bars.length).fill(N);
      const labels: Label[] = [];
      for (let i = 1; i < bars.length; i++) {
        if (adx[i] < (p.threshold as number)) (top[i] = hi[i]), (bottom[i] = lo[i]);
        if (isNum(top[i - 1]) && bars[i].close > top[i - 1]) labels.push({ time: bars[i].time, price: bars[i].low, text: "Buy", color: "#089981", position: "below" });
        if (isNum(bottom[i - 1]) && bars[i].close < bottom[i - 1]) labels.push({ time: bars[i].time, price: bars[i].high, text: "Sell", color: "#f23645", position: "above" });
      }
      return { top, bottom, labels };
    },
  },
  {
    id: "rsidiv",
    name: "RSI divergence indicator",
    group: "Momentum",
    overlay: false,
    inputs: [len(14, "RSI period"), SOURCE_INPUT, { key: "left", label: "Pivot lookback left", type: "int", default: 5, min: 1 }, { key: "right", label: "Pivot lookback right", type: "int", default: 5, min: 1 }, { key: "maxRange", label: "Max of lookback range", type: "int", default: 60, min: 2 }, { key: "minRange", label: "Min of lookback range", type: "int", default: 5, min: 1 }, { key: "bull", label: "Plot bullish", type: "bool", default: true }, { key: "hiddenBull", label: "Plot hidden bullish", type: "bool", default: false }, { key: "bear", label: "Plot bearish", type: "bool", default: true }, { key: "hiddenBear", label: "Plot hidden bearish", type: "bool", default: false }],
    outputs: [{ key: "value", label: "RSI", kind: "line", color: "#7e57c2", lineWidth: 2 }],
    levels: [70, 50, 30],
    fills: [{ id: "bg", label: "Background", from: "level:70", to: "level:30", color: "rgba(126,87,194,0.1)" }],
    calc: (bars, p) => {
      const r = rsi(source(bars, p.source as string), p.length as number);
      const L = p.left as number,
        R = p.right as number;
      const pl = pivotLow(r, L, R),
        ph = pivotHigh(r, L, R);
      const segments: Segment[] = [],
        labels: Label[] = [];
      let lastL = -1,
        lastH = -1;
      const inRange = (a: number, b: number) => b - a >= (p.minRange as number) && b - a <= (p.maxRange as number);
      const add = (a: number, c: number, color: string, text: string, pos: "above" | "below") => {
        segments.push({ t1: bars[a].time, p1: r[a], t2: bars[c].time, p2: r[c], color, width: 2 });
        labels.push({ time: bars[c].time, price: r[c], text, color, position: pos });
      };
      for (let i = 0; i < r.length; i++) {
        if (isNum(pl[i])) {
          const c = i - R;
          if (lastL >= 0 && inRange(lastL, c)) {
            if (p.bull && r[c] > r[lastL] && bars[c].low < bars[lastL].low) add(lastL, c, "#089981", "Bull", "below");
            if (p.hiddenBull && r[c] < r[lastL] && bars[c].low > bars[lastL].low) add(lastL, c, "rgba(8,153,129,0.6)", "H Bull", "below");
          }
          lastL = c;
        }
        if (isNum(ph[i])) {
          const c = i - R;
          if (lastH >= 0 && inRange(lastH, c)) {
            if (p.bear && r[c] < r[lastH] && bars[c].high > bars[lastH].high) add(lastH, c, "#f23645", "Bear", "above");
            if (p.hiddenBear && r[c] > r[lastH] && bars[c].high < bars[lastH].high) add(lastH, c, "rgba(242,54,69,0.6)", "H Bear", "above");
          }
          lastH = c;
        }
      }
      return { value: r, segments, labels };
    },
  },
  {
    id: "smi",
    name: "Stochastic momentum index",
    group: "Momentum",
    overlay: false,
    inputs: [{ key: "k", label: "%K length", type: "int", default: 10, min: 1 }, { key: "d", label: "%D length", type: "int", default: 3, min: 1 }, { key: "ema", label: "EMA length", type: "int", default: 3, min: 1 }],
    outputs: [
      { key: "smi", label: "SMI", kind: "line", color: "#2962ff" },
      { key: "signal", label: "SMI-based EMA", kind: "line", color: "#ff6d00" },
    ],
    levels: [40, 0, -40],
    fills: [{ id: "bg", label: "Background", from: "level:40", to: "level:-40", color: "rgba(33,150,243,0.1)" }],
    calc: (bars, p) => {
      const n = p.k as number,
        d = p.d as number;
      const hh = highest(source(bars, "high"), n),
        ll = lowest(source(bars, "low"), n);
      const rel = bars.map((b, i) => b.close - (hh[i] + ll[i]) / 2),
        rng = hh.map((h, i) => h - ll[i]);
      const ds = (s: number[]) => ema(ema(s, d), d);
      const a = ds(rel),
        b = ds(rng);
      const smi = a.map((x, i) => (b[i] ? (200 * x) / b[i] : N));
      return { smi, signal: ema(smi, p.ema as number) };
    },
  },
  {
    id: "ulcer",
    name: "Ulcer index",
    group: "Volatility",
    overlay: false,
    inputs: [SOURCE_INPUT, len(14)],
    outputs: [{ key: "value", label: "Ulcer index", kind: "line", color: "#2962ff", plot: "area" }],
    calc: (bars, p) => {
      const s = source(bars, p.source as string),
        n = p.length as number;
      const hh = highest(s, n);
      const dd = s.map((v, i) => (hh[i] ? ((100 * (v - hh[i])) / hh[i]) ** 2 : N));
      return { value: sma(dd, n).map(Math.sqrt) };
    },
  },
  {
    id: "woodiescci",
    name: "Woodies CCI",
    group: "Momentum",
    overlay: false,
    inputs: [{ key: "cci", label: "CCI turbo length", type: "int", default: 6, min: 1 }, { key: "long", label: "CCI 14 length", type: "int", default: 14, min: 1 }],
    outputs: [
      { key: "hist", label: "CCI histogram", kind: "histogram", color: "#787b86" },
      { key: "turbo", label: "CCI turbo", kind: "line", color: "#ff9800" },
      { key: "cci", label: "CCI 14", kind: "line", color: "#2962ff", lineWidth: 2 },
    ],
    levels: [100, 0, -100],
    calc: (bars, p) => {
      const c14 = qc("cci", bars, { length: p.long, source: "hlc3" }).value;
      const turbo = qc("cci", bars, { length: p.cci, source: "hlc3" }).value;
      // Bars coloured by trend: 6+ bars on one side of zero is a trend.
      let run = 0;
      const colors = c14.map((v, i) => {
        if (!isNum(v)) return "#787b86";
        run = i && Math.sign(v) === Math.sign(c14[i - 1]) ? run + 1 : 1;
        return run >= 6 ? (v > 0 ? "#089981" : "#f23645") : run === 5 ? "#ffeb3b" : "#787b86";
      });
      return { hist: c14, colors, turbo, cci: c14 };
    },
  },
  {
    id: "performance",
    name: "Performance",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "position", label: "Table position", type: "select", options: ["Top Right", "Top Left", "Bottom Right", "Bottom Left"], default: "Top Right" }],
    outputs: [],
    calc: (bars, p) => {
      if (!bars.length) return {};
      const last = bars[bars.length - 1];
      const ago = (days: number) => {
        const t = last.time - days * 86400;
        for (let i = bars.length - 1; i >= 0; i--) if (bars[i].time <= t) return bars[i].close;
        return N;
      };
      const ytd = (() => {
        const y = new Date(last.time * 1000).getUTCFullYear();
        const t = Date.UTC(y, 0, 1) / 1000;
        for (let i = bars.length - 1; i >= 0; i--) if (bars[i].time < t) return bars[i].close;
        return N;
      })();
      const cell = (base: number) => {
        if (!isNum(base)) return { text: "—" };
        const r = ((last.close - base) / base) * 100;
        return { text: `${r >= 0 ? "+" : ""}${r.toFixed(2)}%`, color: "#fff", bg: r >= 0 ? "rgba(8,153,129,0.7)" : "rgba(242,54,69,0.7)" };
      };
      const periods: [string, number][] = [["1W", 7], ["1M", 30], ["3M", 91], ["6M", 182], ["1Y", 365]];
      return {
        table: {
          position: (p.position as string).toLowerCase().replace(" ", "_") as "top_right",
          rows: [
            [...periods.map(([k]) => k), "YTD"],
            [...periods.map(([, d]) => cell(ago(d))), cell(ytd)],
          ],
        },
      };
    },
  },
  {
    id: "ratings",
    name: "Technical ratings",
    group: "Trend",
    overlay: false,
    description: "TradingView's method: each moving average and oscillator votes buy (+1), neutral (0) or sell (−1); the rating is the average.",
    inputs: [{ key: "basis", label: "Rating based on", type: "select", options: ["MAs and oscillators", "MAs", "Oscillators"], default: "MAs and oscillators" }],
    outputs: [
      { key: "rating", label: "Rating", kind: "histogram", color: "#2962ff" },
      { key: "ma", label: "MA rating", kind: "line", color: "#ff9800", hiddenByDefault: true },
      { key: "osc", label: "Oscillator rating", kind: "line", color: "#9c27b0", hiddenByDefault: true },
    ],
    levels: [0.5, 0.1, -0.1, -0.5],
    calc: (bars, p) => {
      const c = source(bars, "close");
      const maVotes: number[][] = [];
      for (const n of [10, 20, 30, 50, 100, 200]) {
        for (const m of [sma(c, n), ema(c, n)]) maVotes.push(m.map((v, i) => (!isNum(v) ? N : c[i] > v ? 1 : c[i] < v ? -1 : 0)));
      }
      const ichi = qc("ichimoku", bars, {});
      maVotes.push(c.map((v, i) => (!isNum(ichi.base?.[i]) ? N : ichi.base[i] > ichi.spanA?.[i] && v > ichi.base[i] ? 1 : ichi.base[i] < ichi.spanA?.[i] && v < ichi.base[i] ? -1 : 0)));
      const vw = qc("vwma", bars, { length: 20 }).value,
        hm = qc("hma", bars, { length: 9 }).value;
      maVotes.push(c.map((v, i) => (!isNum(vw[i]) ? N : v > vw[i] ? 1 : v < vw[i] ? -1 : 0)));
      maVotes.push(hm.map((v, i) => (!isNum(v) || !isNum(hm[i - 1]) ? N : v > hm[i - 1] && c[i] > v ? 1 : v < hm[i - 1] && c[i] < v ? -1 : 0)));

      const rising = (s: number[], i: number) => s[i] > s[i - 1],
        falling = (s: number[], i: number) => s[i] < s[i - 1];
      const r = rsi(c, 14);
      const st = qc("stoch", bars, { k: 14, smoothK: 3, d: 3 });
      const cci = qc("cci", bars, { length: 20, source: "hlc3" }).value;
      const dmi = qc("dmi", bars, { diLength: 14, adxSmoothing: 14 });
      const ao = qc("ao", bars, {}).value;
      const mo = change(c, 10);
      const macd = qc("macd", bars, { fast: 12, slow: 26, signal: 9 });
      const srsi = qc("stochrsi", bars, { smoothK: 3, smoothD: 3, rsiLength: 14, stochLength: 14 });
      const wr = qc("willr", bars, { length: 14 }).value;
      const e13 = ema(c, 13);
      const bull = bars.map((b, i) => b.high - e13[i]),
        bear = bars.map((b, i) => b.low - e13[i]);
      const uo = qc("uo", bars, {}).value;
      const oscVotes: ((i: number) => number)[] = [
        (i) => (r[i] < 30 && rising(r, i) ? 1 : r[i] > 70 && falling(r, i) ? -1 : 0),
        (i) => (st.k[i] < 20 && st.d[i] < 20 && st.k[i] > st.d[i] ? 1 : st.k[i] > 80 && st.d[i] > 80 && st.k[i] < st.d[i] ? -1 : 0),
        (i) => (cci[i] < -100 && rising(cci, i) ? 1 : cci[i] > 100 && falling(cci, i) ? -1 : 0),
        (i) => (dmi.adx[i] > 20 && dmi.plus[i] > dmi.minus[i] && rising(dmi.adx, i) ? 1 : dmi.adx[i] > 20 && dmi.plus[i] < dmi.minus[i] && rising(dmi.adx, i) ? -1 : 0),
        (i) => (ao[i] > 0 && rising(ao, i) ? 1 : ao[i] < 0 && falling(ao, i) ? -1 : 0),
        (i) => (rising(mo, i) ? 1 : falling(mo, i) ? -1 : 0),
        (i) => (macd.macd[i] > macd.signal[i] ? 1 : macd.macd[i] < macd.signal[i] ? -1 : 0),
        (i) => (falling(e13, i) ? 0 : srsi.k[i] < 20 && srsi.d[i] < 20 && srsi.k[i] > srsi.d[i] ? 1 : srsi.k[i] > 80 && srsi.d[i] > 80 && srsi.k[i] < srsi.d[i] ? -1 : 0),
        (i) => (wr[i] < -80 && rising(wr, i) ? 1 : wr[i] > -20 && falling(wr, i) ? -1 : 0),
        (i) => (rising(e13, i) && bear[i] < 0 && rising(bear, i) ? 1 : falling(e13, i) && bull[i] > 0 && falling(bull, i) ? -1 : 0),
        (i) => (uo[i] > 70 ? 1 : uo[i] < 30 ? -1 : 0),
      ];
      const avg = (vs: number[]) => {
        const ok = vs.filter(isNum);
        return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : N;
      };
      const ma = c.map((_, i) => avg(maVotes.map((v) => v[i])));
      const osc = c.map((_, i) => (i < 30 ? N : avg(oscVotes.map((f) => f(i)))));
      const rating = c.map((_, i) => (p.basis === "MAs" ? ma[i] : p.basis === "Oscillators" ? osc[i] : avg([ma[i], osc[i]])));
      const colors = rating.map((v) => (v > 0.5 ? "#089981" : v > 0.1 ? "#81c784" : v < -0.5 ? "#f23645" : v < -0.1 ? "#ef9a9a" : "#787b86"));
      return { rating, ma, osc, colors };
    },
  },
];

export { atr, cum, sum, wma };
