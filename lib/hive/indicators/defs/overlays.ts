// TradingView standard indicators drawn on the price chart.
import * as qt from "../../engine/indicators.js";
import type { Bar } from "../../data";
import type { Box, IndicatorDef, Label, Segment } from "../types";
import { N, SOURCE_INPUT, atr, ema, highest, hl2, isNum, len, lowest, median, rma, sma, source, stdev, wma } from "../ta";

const qc = qt.compute as unknown as (id: string, bars: Bar[], p?: Record<string, unknown>) => Record<string, number[]>;

// Swing points by percentage deviation (TradingView's zig zag): alternating highs and lows.
export function zigzag(bars: Bar[], deviation: number, depth: number) {
  const pts: { i: number; price: number; high: boolean }[] = [];
  let dir = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const last = pts[pts.length - 1];
    if (!last) {
      pts.push({ i, price: b.high, high: true }, { i, price: b.low, high: false });
      continue;
    }
    if (dir >= 0) {
      if (last.high && b.high >= last.price) (last.i = i), (last.price = b.high);
      else if (!last.high && b.low <= last.price) (last.i = i), (last.price = b.low);
    }
    const ref = pts[pts.length - 1];
    if (ref.high && (ref.price - b.low) / ref.price >= deviation / 100 && i - ref.i >= Math.min(depth, 2)) {
      pts.push({ i, price: b.low, high: false });
      dir = 1;
    } else if (!ref.high && (b.high - ref.price) / ref.price >= deviation / 100 && i - ref.i >= Math.min(depth, 2)) {
      pts.push({ i, price: b.high, high: true });
      dir = 1;
    }
  }
  return pts.slice(2);
}

const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ["#787b86", "#f23645", "#ff9800", "#4caf50", "#089981", "#00bcd4", "#787b86"];

export const OVERLAY_INDICATORS: IndicatorDef[] = [
  {
    id: "vpvr",
    name: "Visible range volume profile",
    group: "Volume",
    overlay: true,
    inputs: [
      { key: "rows", label: "Row size (number of rows)", type: "int", default: 24, min: 4, max: 2000 },
      { key: "volume", label: "Volume", type: "select", options: ["Up/Down", "Total", "Delta"], default: "Up/Down" },
      { key: "style", label: "Style", type: "select", options: ["Bars", "Area", "Line"], default: "Bars" },
      { key: "valueArea", label: "Value area volume %", type: "int", default: 70, min: 10, max: 100 },
      { key: "width", label: "Width (% of the chart)", type: "int", default: 30, min: 5, max: 100 },
      { key: "placement", label: "Placement", type: "select", options: ["Right", "Left"], default: "Right" },
      { key: "upColor", label: "Up volume", type: "color", default: "rgba(41,98,255,0.25)" },
      { key: "downColor", label: "Down volume", type: "color", default: "rgba(251,192,45,0.25)" },
      { key: "vaUpColor", label: "Value area up", type: "color", default: "rgba(41,98,255,0.7)" },
      { key: "vaDownColor", label: "Value area down", type: "color", default: "rgba(251,192,45,0.7)" },
      { key: "showPoc", label: "POC", type: "bool", default: true },
      { key: "pocColor", label: "POC colour", type: "color", default: "#f44336" },
      { key: "showVa", label: "Value area high/low lines", type: "bool", default: false },
    ],
    outputs: [],
    calc: (_b, p) => ({ volumeProfile: { ...p } }),
  },
  {
    id: "svp",
    name: "Session volume profile",
    group: "Volume",
    overlay: true,
    inputs: [
      { key: "period", label: "Session", type: "select", options: ["Auto", "Day", "Week", "Month"], default: "Auto" },
      { key: "rows", label: "Rows", type: "int", default: 24, min: 4, max: 500 },
      { key: "volume", label: "Volume", type: "select", options: ["Up/Down", "Total", "Delta"], default: "Up/Down" },
      { key: "style", label: "Style", type: "select", options: ["Bars", "Area", "Line"], default: "Bars" },
      { key: "valueArea", label: "Value area volume %", type: "int", default: 70, min: 10, max: 100 },
      { key: "width", label: "Width (% of the session)", type: "int", default: 70, min: 5, max: 100 },
      { key: "showPoc", label: "POC", type: "bool", default: true },
      { key: "showVa", label: "Value area high/low lines", type: "bool", default: false },
    ],
    outputs: [],
    calc: (_b, p) => ({ sessionProfile: { ...p } }),
  },
  {
    id: "bb",
    name: "Bollinger Bands",
    group: "Volatility",
    overlay: true,
    inputs: [len(20), { key: "maType", label: "Basis MA type", type: "select", options: ["SMA", "EMA", "SMMA (RMA)", "WMA", "VWMA"], default: "SMA" }, SOURCE_INPUT, { key: "mult", label: "StdDev", type: "float", default: 2, step: 0.1 }, { key: "offset", label: "Offset", type: "int", default: 0 }],
    outputs: [
      { key: "basis", label: "Basis", kind: "line", color: "#2962ff" },
      { key: "upper", label: "Upper", kind: "line", color: "#f23645" },
      { key: "lower", label: "Lower", kind: "line", color: "#089981" },
    ],
    fills: [{ id: "bg", label: "Background", from: "upper", to: "lower", color: "rgba(33,150,243,0.05)" }],
    calc: (bars, p) => {
      const s = source(bars, p.source as string);
      const n = p.length as number;
      const basis = qc("sma", bars, { length: n, source: p.source }).value;
      const b = p.maType === "SMA" ? basis : maOf(p.maType as string, s, n, bars);
      const sd = stdev(s, n);
      const off = (p.offset as number) || 0;
      const sh = (x: number[]) => (off ? x.map((_, i) => x[i - off] ?? N) : x);
      return { basis: sh(b), upper: sh(b.map((v, i) => v + (p.mult as number) * sd[i])), lower: sh(b.map((v, i) => v - (p.mult as number) * sd[i])) };
    },
  },
  {
    id: "kc",
    name: "Keltner channels",
    group: "Volatility",
    overlay: true,
    inputs: [len(20), { key: "mult", label: "Multiplier", type: "float", default: 2, step: 0.1 }, SOURCE_INPUT, { key: "useEma", label: "Use exponential MA", type: "bool", default: true }, { key: "bands", label: "Bands style", type: "select", options: ["Average True Range", "True Range", "Range"], default: "Average True Range" }, { key: "atrLength", label: "ATR length", type: "int", default: 10, min: 1 }],
    outputs: [
      { key: "upper", label: "Upper", kind: "line", color: "#2962ff" },
      { key: "basis", label: "Basis", kind: "line", color: "#2962ff" },
      { key: "lower", label: "Lower", kind: "line", color: "#2962ff" },
    ],
    fills: [{ id: "bg", label: "Background", from: "upper", to: "lower", color: "rgba(33,150,243,0.05)" }],
    calc: (bars, p) => {
      const s = source(bars, p.source as string),
        n = p.length as number;
      const basis = p.useEma ? ema(s, n) : sma(s, n);
      const rng = p.bands === "True Range" ? qc("atr", bars, { length: 1 }).value : p.bands === "Range" ? ema(bars.map((b) => b.high - b.low), n) : atr(bars, p.atrLength as number);
      return { basis, upper: basis.map((v, i) => v + (p.mult as number) * rng[i]), lower: basis.map((v, i) => v - (p.mult as number) * rng[i]) };
    },
  },
  {
    id: "donchian",
    name: "Donchian channels",
    group: "Volatility",
    overlay: true,
    inputs: [len(20)],
    outputs: [
      { key: "upper", label: "Upper", kind: "line", color: "#2962ff" },
      { key: "basis", label: "Basis", kind: "line", color: "#ff6d00" },
      { key: "lower", label: "Lower", kind: "line", color: "#2962ff" },
    ],
    fills: [{ id: "bg", label: "Background", from: "upper", to: "lower", color: "rgba(33,150,243,0.05)" }],
    calc: (bars, p) => {
      const u = highest(source(bars, "high"), p.length as number),
        l = lowest(source(bars, "low"), p.length as number);
      return { upper: u, lower: l, basis: u.map((v, i) => (v + l[i]) / 2) };
    },
  },
  {
    id: "envelope",
    name: "Envelope",
    group: "Volatility",
    overlay: true,
    inputs: [len(20), { key: "percent", label: "Percent", type: "float", default: 10, step: 0.5 }, SOURCE_INPUT, { key: "exponential", label: "Exponential", type: "bool", default: false }],
    outputs: [
      { key: "upper", label: "Upper", kind: "line", color: "#2962ff" },
      { key: "basis", label: "Basis", kind: "line", color: "#ff6d00" },
      { key: "lower", label: "Lower", kind: "line", color: "#2962ff" },
    ],
    fills: [{ id: "bg", label: "Background", from: "upper", to: "lower", color: "rgba(33,150,243,0.05)" }],
    calc: (bars, p) => {
      const s = source(bars, p.source as string);
      const basis = p.exponential ? ema(s, p.length as number) : sma(s, p.length as number);
      const k = (p.percent as number) / 100;
      return { basis, upper: basis.map((v) => v * (1 + k)), lower: basis.map((v) => v * (1 - k)) };
    },
  },
  {
    id: "supertrend",
    name: "Supertrend",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "atrLength", label: "ATR length", type: "int", default: 10, min: 1 }, { key: "factor", label: "Factor", type: "float", default: 3, step: 0.1 }],
    outputs: [
      { key: "up", label: "Up trend", kind: "line", color: "#089981" },
      { key: "down", label: "Down trend", kind: "line", color: "#f23645" },
      { key: "body", label: "Body middle", kind: "line", color: "rgba(0,0,0,0)", hiddenByDefault: true },
    ],
    fills: [
      { id: "upFill", label: "Up trend background", from: "body", to: "up", color: "rgba(8,153,129,0.1)" },
      { id: "downFill", label: "Down trend background", from: "body", to: "down", color: "rgba(242,54,69,0.1)" },
    ],
    calc: (bars, p) => {
      const r = qc("supertrend", bars, p);
      const body = bars.map((b) => (b.open + b.close) / 2);
      const labels: Label[] = [];
      for (let i = 1; i < bars.length; i++) {
        if (isNum(r.up[i]) && !isNum(r.up[i - 1]) && isNum(r.down[i - 1])) labels.push({ time: bars[i].time, price: r.up[i], text: "Buy", color: "#089981", position: "below" });
        if (isNum(r.down[i]) && !isNum(r.down[i - 1]) && isNum(r.up[i - 1])) labels.push({ time: bars[i].time, price: r.down[i], text: "Sell", color: "#f23645", position: "above" });
      }
      return { ...r, body, labels };
    },
  },
  {
    id: "chandelier",
    name: "Chandelier exit",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "length", label: "ATR period", type: "int", default: 22, min: 1 }, { key: "mult", label: "ATR multiplier", type: "float", default: 3, step: 0.1 }, { key: "useClose", label: "Use close price for extremums", type: "bool", default: true }],
    outputs: [
      { key: "long", label: "Long stop", kind: "line", color: "#089981" },
      { key: "short", label: "Short stop", kind: "line", color: "#f23645" },
    ],
    calc: (bars, p) => {
      const n = p.length as number,
        a = atr(bars, n).map((v) => v * (p.mult as number));
      const hi = highest(source(bars, p.useClose ? "close" : "high"), n),
        lo = lowest(source(bars, p.useClose ? "close" : "low"), n);
      const ls: number[] = [],
        ss: number[] = [];
      let dir = 1;
      const long = new Array(bars.length).fill(N),
        short = new Array(bars.length).fill(N);
      const labels: Label[] = [];
      for (let i = 0; i < bars.length; i++) {
        let l = hi[i] - a[i],
          s = lo[i] + a[i];
        if (i > 0 && isNum(ls[i - 1])) l = bars[i - 1].close > ls[i - 1] ? Math.max(l, ls[i - 1]) : l;
        if (i > 0 && isNum(ss[i - 1])) s = bars[i - 1].close < ss[i - 1] ? Math.min(s, ss[i - 1]) : s;
        ls[i] = l;
        ss[i] = s;
        const prev = dir;
        if (i > 0 && isNum(ss[i - 1]) && bars[i].close > ss[i - 1]) dir = 1;
        else if (i > 0 && isNum(ls[i - 1]) && bars[i].close < ls[i - 1]) dir = -1;
        if (dir === 1) long[i] = l;
        else short[i] = s;
        if (i > 0 && dir !== prev && isNum(l) && isNum(s))
          labels.push(dir === 1 ? { time: bars[i].time, price: l, text: "Buy", color: "#089981", position: "below" } : { time: bars[i].time, price: s, text: "Sell", color: "#f23645", position: "above" });
      }
      return { long, short, labels };
    },
  },
  {
    id: "kama",
    name: "Kaufman's adaptive moving average",
    group: "Moving averages",
    overlay: true,
    inputs: [len(10), { key: "fast", label: "Fast length", type: "int", default: 2, min: 1 }, { key: "slow", label: "Slow length", type: "int", default: 30, min: 1 }, SOURCE_INPUT],
    outputs: [{ key: "value", label: "KAMA", kind: "line", color: "#6d1e7f" }],
    calc: (bars, p) => {
      const s = source(bars, p.source as string),
        n = p.length as number;
      const fs = 2 / ((p.fast as number) + 1),
        ss = 2 / ((p.slow as number) + 1);
      const out = new Array(s.length).fill(N);
      for (let i = n; i < s.length; i++) {
        const dirn = Math.abs(s[i] - s[i - n]);
        let vol = 0;
        for (let k = i - n + 1; k <= i; k++) vol += Math.abs(s[k] - s[k - 1]);
        const er = vol ? dirn / vol : 0;
        const sc = (er * (fs - ss) + ss) ** 2;
        const prev = isNum(out[i - 1]) ? out[i - 1] : s[i - 1];
        out[i] = prev + sc * (s[i] - prev);
      }
      return { value: out };
    },
  },
  {
    id: "median",
    name: "Median",
    group: "Volatility",
    overlay: true,
    inputs: [{ ...SOURCE_INPUT, default: "hl2" }, { key: "length", label: "Median length", type: "int", default: 3, min: 1 }, { key: "atrLength", label: "ATR length", type: "int", default: 14, min: 1 }, { key: "mult", label: "ATR multiplier", type: "float", default: 2, step: 0.1 }],
    outputs: [
      { key: "median", label: "Median", kind: "line", color: "#ff9800", lineWidth: 2 },
      { key: "ema", label: "Median EMA", kind: "line", color: "#2962ff" },
      { key: "upper", label: "Upper band", kind: "line", color: "#089981" },
      { key: "lower", label: "Lower band", kind: "line", color: "#f23645" },
    ],
    fills: [{ id: "bg", label: "Band fill", from: "median", to: "ema", upColor: "rgba(8,153,129,0.15)", downColor: "rgba(242,54,69,0.15)" }],
    calc: (bars, p) => {
      const m = median(source(bars, p.source as string), p.length as number);
      const a = atr(bars, p.atrLength as number);
      return { median: m, ema: ema(m, p.length as number), upper: m.map((v, i) => v + (p.mult as number) * a[i]), lower: m.map((v, i) => v - (p.mult as number) * a[i]) };
    },
  },
  {
    id: "linregchannel",
    name: "Linear regression channel",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "length", label: "Count", type: "int", default: 100, min: 2 }, SOURCE_INPUT, { key: "upper", label: "Upper deviation", type: "float", default: 2, step: 0.1 }, { key: "lower", label: "Lower deviation", type: "float", default: 2, step: 0.1 }, { key: "extend", label: "Extend lines right", type: "bool", default: false }, { key: "pearson", label: "Show Pearson's R", type: "bool", default: true }],
    outputs: [],
    calc: (bars, p) => {
      const n = Math.min(p.length as number, bars.length);
      if (n < 2) return {};
      const s = source(bars, p.source as string).slice(-n);
      let sx = 0,
        sy = 0,
        sxx = 0,
        sxy = 0;
      s.forEach((y, x) => ((sx += x), (sy += y), (sxx += x * x), (sxy += x * y)));
      const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx),
        icpt = (sy - slope * sx) / n;
      let dev = 0,
        syy = 0;
      s.forEach((y, x) => ((dev += (y - (icpt + slope * x)) ** 2), (syy += y * y)));
      const sd = Math.sqrt(dev / n);
      const r = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
      const t1 = bars[bars.length - n].time,
        t2 = bars[bars.length - 1].time;
      const y1 = icpt,
        y2 = icpt + slope * (n - 1);
      const ext = Boolean(p.extend);
      const segs: Segment[] = [
        { t1, p1: y1, t2, p2: y2, color: "#ff5252", width: 1, extendRight: ext, label: p.pearson ? `R ${r.toFixed(3)}` : undefined },
        { t1, p1: y1 + (p.upper as number) * sd, t2, p2: y2 + (p.upper as number) * sd, color: "#2962ff", width: 1, extendRight: ext },
        { t1, p1: y1 - (p.lower as number) * sd, t2, p2: y2 - (p.lower as number) * sd, color: "#2962ff", width: 1, extendRight: ext },
      ];
      return { segments: segs };
    },
  },
  {
    id: "autofib",
    name: "Auto fib retracement",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "deviation", label: "Deviation (%)", type: "float", default: 3, step: 0.5 }, { key: "depth", label: "Depth", type: "int", default: 10, min: 2 }, { key: "reverse", label: "Reverse", type: "bool", default: false }, { key: "extend", label: "Extend lines right", type: "bool", default: true }],
    outputs: [],
    calc: (bars, p) => {
      const z = zigzag(bars, p.deviation as number, p.depth as number);
      if (z.length < 2) return {};
      const [a, b] = z.slice(-2);
      const [from, to] = p.reverse ? [b, a] : [a, b];
      const t1 = bars[a.i].time,
        t2 = bars[bars.length - 1].time;
      return {
        segments: FIB.map((lv, k) => {
          const price = to.price + (from.price - to.price) * lv;
          return { t1, p1: price, t2, p2: price, color: FIB_COLORS[k], extendRight: Boolean(p.extend), label: `${lv} (${price.toFixed(2)})` };
        }),
      };
    },
  },
  {
    id: "autofibext",
    name: "Auto fib extension",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "deviation", label: "Deviation (%)", type: "float", default: 3, step: 0.5 }, { key: "depth", label: "Depth", type: "int", default: 10, min: 2 }, { key: "extend", label: "Extend lines right", type: "bool", default: true }],
    outputs: [],
    calc: (bars, p) => {
      const z = zigzag(bars, p.deviation as number, p.depth as number);
      if (z.length < 3) return {};
      const [a, b, c] = z.slice(-3);
      const move = b.price - a.price;
      const lvls = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];
      return {
        segments: [
          { t1: bars[a.i].time, p1: a.price, t2: bars[b.i].time, p2: b.price, color: "#787b86", style: 1 as const },
          { t1: bars[b.i].time, p1: b.price, t2: bars[c.i].time, p2: c.price, color: "#787b86", style: 1 as const },
          ...lvls.map((lv, k) => {
            const price = c.price + move * lv;
            return { t1: bars[c.i].time, p1: price, t2: bars[bars.length - 1].time, p2: price, color: FIB_COLORS[k % FIB_COLORS.length], extendRight: Boolean(p.extend), label: `${lv} (${price.toFixed(2)})` };
          }),
        ],
      };
    },
  },
  {
    id: "autopitchfork",
    name: "Auto pitchfork",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "deviation", label: "Deviation (%)", type: "float", default: 3, step: 0.5 }, { key: "depth", label: "Depth", type: "int", default: 10, min: 2 }, { key: "type", label: "Type", type: "select", options: ["Original", "Schiff", "Modified Schiff"], default: "Original" }],
    outputs: [],
    calc: (bars, p) => {
      const z = zigzag(bars, p.deviation as number, p.depth as number);
      if (z.length < 3) return {};
      const [a0, b, c] = z.slice(-3);
      const a = { ...a0 };
      if (p.type === "Schiff") (a.i = Math.round((a.i + b.i) / 2)), (a.price = (a.price + b.price) / 2);
      if (p.type === "Modified Schiff") a.price = (a.price + b.price) / 2;
      const mi = (b.i + c.i) / 2,
        mp = (b.price + c.price) / 2;
      const tA = bars[Math.max(0, Math.round(a.i))].time,
        tm = bars[Math.round(mi)].time;
      const slope = (mp - a.price) / Math.max(1, mi - a.i);
      const last = bars.length - 1,
        tLast = bars[last].time;
      const at = (i0: number, p0: number) => p0 + slope * (last - i0);
      return {
        segments: [
          { t1: tA, p1: a.price, t2: tm, p2: mp, color: "#f23645", extendRight: true },
          { t1: bars[b.i].time, p1: b.price, t2: tLast, p2: at(b.i, b.price), color: "#2962ff", extendRight: true },
          { t1: bars[c.i].time, p1: c.price, t2: tLast, p2: at(c.i, c.price), color: "#2962ff", extendRight: true },
          { t1: bars[b.i].time, p1: b.price, t2: bars[c.i].time, p2: c.price, color: "#787b86", style: 1 as const },
        ],
      };
    },
  },
  {
    id: "autokeylevels",
    name: "Auto key levels",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "left", label: "Pivot bars left", type: "int", default: 10, min: 1 }, { key: "right", label: "Pivot bars right", type: "int", default: 10, min: 1 }, { key: "count", label: "Levels", type: "int", default: 6, min: 1, max: 20 }, { key: "zone", label: "Merge within (% of price)", type: "float", default: 0.5, step: 0.1 }],
    outputs: [],
    calc: (bars, p) => {
      // Cluster swing highs and lows; the levels touched most often are the key ones.
      const L = p.left as number,
        R = p.right as number;
      const piv: number[] = [];
      for (let i = L; i < bars.length - R; i++) {
        let isH = true,
          isL = true;
        for (let k = i - L; k <= i + R; k++) {
          if (k === i) continue;
          if (bars[k].high >= bars[i].high) isH = false;
          if (bars[k].low <= bars[i].low) isL = false;
        }
        if (isH) piv.push(bars[i].high);
        if (isL) piv.push(bars[i].low);
      }
      const last = bars[bars.length - 1]?.close || 1;
      const zone = (last * (p.zone as number)) / 100;
      const clusters: { price: number; n: number }[] = [];
      for (const v of piv) {
        const c = clusters.find((x) => Math.abs(x.price - v) <= zone);
        if (c) (c.price = (c.price * c.n + v) / (c.n + 1)), c.n++;
        else clusters.push({ price: v, n: 1 });
      }
      clusters.sort((a, b) => b.n - a.n);
      const t1 = bars[0]?.time ?? 0,
        t2 = bars[bars.length - 1]?.time ?? 0;
      const boxes: Box[] = clusters.slice(0, p.count as number).map((c) => ({
        t1,
        t2,
        top: c.price + zone / 2,
        bottom: c.price - zone / 2,
        color: c.price >= last ? "rgba(242,54,69,0.15)" : "rgba(8,153,129,0.15)",
        extendRight: true,
        text: `${c.price.toFixed(2)} ×${c.n}`,
        textColor: c.price >= last ? "#f23645" : "#089981",
      }));
      return { boxes };
    },
  },
  {
    id: "autotrend",
    name: "Auto trend detector",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "deviation", label: "Deviation (%)", type: "float", default: 5, step: 0.5 }, { key: "depth", label: "Depth", type: "int", default: 10, min: 2 }],
    outputs: [],
    calc: (bars, p) => {
      // Up trend while swing highs and lows both rise, down while both fall; shade the bars.
      const z = zigzag(bars, p.deviation as number, p.depth as number);
      const bg: (string | null)[] = bars.map(() => null);
      const segments: Segment[] = [];
      for (let k = 2; k < z.length; k++) {
        const a = z[k - 2],
          c = z[k];
        const up = c.price > a.price;
        const from = z[k - 1].i,
          to = k + 1 < z.length ? z[k + 1].i : bars.length - 1;
        for (let i = from; i <= to; i++) bg[i] = up ? "rgba(8,153,129,0.06)" : "rgba(242,54,69,0.06)";
        segments.push({ t1: bars[z[k - 1].i].time, p1: z[k - 1].price, t2: bars[c.i].time, p2: c.price, color: c.high ? "#089981" : "#f23645", width: 2 });
      }
      return { bg, segments };
    },
  },
  {
    id: "gaps",
    name: "Gaps",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "minPct", label: "Minimal deviation (%)", type: "float", default: 0.5, step: 0.1 }, { key: "limit", label: "Max gaps shown", type: "int", default: 20, min: 1 }, { key: "keepFilled", label: "Keep filled gaps", type: "bool", default: false }],
    outputs: [],
    calc: (bars, p) => {
      const boxes: Box[] = [];
      for (let i = 1; i < bars.length; i++) {
        const prev = bars[i - 1],
          b = bars[i];
        const up = b.low > prev.high,
          dn = b.high < prev.low;
        if (!up && !dn) continue;
        const top = up ? b.low : prev.low,
          bottom = up ? prev.high : b.high;
        if (((top - bottom) / bottom) * 100 < (p.minPct as number)) continue;
        let end = bars.length - 1,
          filled = false;
        for (let k = i + 1; k < bars.length; k++)
          if ((up && bars[k].low <= bottom) || (dn && bars[k].high >= top)) {
            end = k;
            filled = true;
            break;
          }
        if (filled && !p.keepFilled) continue;
        boxes.push({ t1: prev.time, t2: bars[end].time, top, bottom, color: up ? "rgba(8,153,129,0.2)" : "rgba(242,54,69,0.2)", border: up ? "#089981" : "#f23645", extendRight: !filled });
      }
      return { boxes: boxes.slice(-(p.limit as number)) };
    },
  },
  {
    id: "mtpc",
    name: "Multi-time period charts",
    group: "Trend",
    overlay: true,
    inputs: [{ key: "period", label: "Period", type: "select", options: ["Auto", "Day", "Week", "Month", "Quarter", "Year"], default: "Auto" }, { key: "count", label: "Periods shown", type: "int", default: 20, min: 1 }],
    outputs: [],
    calc: (bars, p, _ta, ctx) => {
      // The higher timeframe's candles drawn behind this chart's bars.
      const sec = ctx?.tfSeconds || 86400;
      const per = p.period === "Auto" ? (sec < 3600 ? "Day" : sec < 86400 ? "Week" : sec < 7 * 86400 ? "Month" : "Year") : (p.period as string);
      const key = (t: number) => {
        const d = new Date((t + 19800) * 1000);
        if (per === "Day") return d.toISOString().slice(0, 10);
        if (per === "Week") return String(Math.floor((t / 86400 + 3) / 7));
        if (per === "Month") return d.toISOString().slice(0, 7);
        if (per === "Quarter") return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3)}`;
        return String(d.getUTCFullYear());
      };
      const groups: { t1: number; t2: number; o: number; h: number; l: number; c: number }[] = [];
      let k0 = "";
      for (const b of bars) {
        const k = key(b.time);
        const g = groups[groups.length - 1];
        if (k !== k0) groups.push({ t1: b.time, t2: b.time, o: b.open, h: b.high, l: b.low, c: b.close });
        else Object.assign(g, { t2: b.time, h: Math.max(g.h, b.high), l: Math.min(g.l, b.low), c: b.close });
        k0 = k;
      }
      const boxes: Box[] = groups.slice(-(p.count as number)).map((g) => ({
        t1: g.t1,
        t2: g.t2,
        top: Math.max(g.o, g.c),
        bottom: Math.min(g.o, g.c),
        color: g.c >= g.o ? "rgba(8,153,129,0.12)" : "rgba(242,54,69,0.12)",
        border: g.c >= g.o ? "rgba(8,153,129,0.6)" : "rgba(242,54,69,0.6)",
      }));
      const segments: Segment[] = groups.slice(-(p.count as number)).map((g) => {
        const mid = g.t1 + (g.t2 - g.t1) / 2;
        return { t1: mid, p1: g.h, t2: mid, p2: g.l, color: g.c >= g.o ? "rgba(8,153,129,0.6)" : "rgba(242,54,69,0.6)" };
      });
      return { boxes, segments };
    },
  },
  {
    id: "vap",
    name: "Visible average price",
    group: "Trend",
    overlay: true,
    usesVisibleRange: true,
    inputs: [SOURCE_INPUT],
    outputs: [{ key: "value", label: "Average", kind: "line", color: "#ff9800", lineWidth: 2 }],
    calc: (bars, p, _ta, ctx) => {
      const r = ctx?.visible;
      const s = source(bars, p.source as string);
      if (!r) return { value: s.map(() => N) };
      const from = Math.max(0, r.from),
        to = Math.min(bars.length - 1, r.to);
      let sum = 0,
        n = 0;
      for (let i = from; i <= to; i++) (sum += s[i]), n++;
      const avg = n ? sum / n : N;
      return { value: s.map((_, i) => (i >= from && i <= to ? avg : N)) };
    },
  },
  {
    id: "moon",
    name: "Moon phases",
    group: "Trend",
    overlay: true,
    inputs: [],
    outputs: [],
    calc: (bars) => {
      // New moon 6 Jan 2000 18:14 UTC; one lunation is 29.530589 days.
      const ref = Date.UTC(2000, 0, 6, 18, 14) / 1000,
        syn = 29.530589 * 86400;
      if (!bars.length) return {};
      const t0 = bars[0].time,
        t1 = bars[bars.length - 1].time;
      const markers: { time: number; position: "aboveBar" | "belowBar"; shape: "circle"; color: string; text: string }[] = [];
      for (let k = Math.floor((t0 - ref) / syn); ref + k * syn <= t1 + syn; k++)
        for (const [off, full] of [
          [0, false],
          [0.5, true],
        ] as const) {
          const t = ref + (k + off) * syn;
          if (t < t0 || t > t1) continue;
          const i = bars.findIndex((b) => b.time >= t);
          if (i >= 0) markers.push({ time: bars[i].time, position: full ? "aboveBar" : "belowBar", shape: "circle", color: full ? "#ffeb3b" : "#787b86", text: full ? "Full" : "New" });
        }
      return { markers };
    },
  },
  {
    id: "sessions",
    name: "Trading sessions",
    group: "Trend",
    overlay: true,
    inputs: [
      { key: "india", label: "India (09:15–15:30 IST)", type: "bool", default: true },
      { key: "asia", label: "Tokyo (00:00–09:00 UTC)", type: "bool", default: false },
      { key: "london", label: "London (07:00–16:00 UTC)", type: "bool", default: true },
      { key: "ny", label: "New York (13:30–20:00 UTC)", type: "bool", default: true },
    ],
    outputs: [],
    calc: (bars, p, _ta, ctx) => {
      if ((ctx?.tfSeconds || 86400) >= 86400) return { error: "Trading sessions show on intraday charts" };
      const inS = (t: number, a: number, b: number) => {
        const m = ((t % 86400) + 86400) % 86400;
        return m >= a && m < b;
      };
      const bg = bars.map((b) => {
        if (p.india && inS(b.time, 3 * 3600 + 45 * 60, 10 * 3600)) return "rgba(255,152,0,0.08)";
        if (p.ny && inS(b.time, 13.5 * 3600, 20 * 3600)) return "rgba(41,98,255,0.08)";
        if (p.london && inS(b.time, 7 * 3600, 16 * 3600)) return "rgba(8,153,129,0.08)";
        if (p.asia && inS(b.time, 0, 9 * 3600)) return "rgba(156,39,176,0.08)";
        return null;
      });
      return { bg };
    },
  },
  {
    id: "bbars",
    name: "Bollinger Bars",
    group: "Volatility",
    overlay: true,
    inputs: [len(20), { key: "mult", label: "StdDev", type: "float", default: 2, step: 0.1 }],
    outputs: [],
    calc: (bars, p) => {
      // Candles coloured by where they close against the bands: outside = strong move.
      const s = source(bars, "close"),
        b = sma(s, p.length as number),
        sd = stdev(s, p.length as number);
      const barColors = bars.map((x, i) => {
        if (!isNum(b[i])) return null;
        const up = b[i] + (p.mult as number) * sd[i],
          dn = b[i] - (p.mult as number) * sd[i];
        if (x.close > up) return "#00e676";
        if (x.close < dn) return "#ff1744";
        return x.close >= x.open ? "rgba(8,153,129,0.45)" : "rgba(242,54,69,0.45)";
      });
      return { barColors };
    },
  },
];

function maOf(type: string, s: number[], n: number, bars: Bar[]) {
  const v = source(bars, "volume");
  if (type === "EMA") return ema(s, n);
  if (type === "SMMA (RMA)") return rma(s, n);
  if (type === "WMA") return wma(s, n);
  if (type === "VWMA") return s.map((_, i) => {
    if (i < n - 1) return N;
    let a = 0,
      w = 0;
    for (let k = i - n + 1; k <= i; k++) (a += s[k] * v[k]), (w += v[k]);
    return w ? a / w : N;
  });
  return sma(s, n);
}

export { hl2 };
