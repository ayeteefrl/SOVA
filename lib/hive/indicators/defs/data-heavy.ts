// Indicators that need more than the chart's own bars: intrabar volume (volume delta, cumulative
// volume delta, up/down volume), market breadth (advance/decline, cumulative volume index) and
// seasonality (daily history across years).
import type { Bar, BreadthRow } from "../../data";
import type { IndicatorDef, InputDef } from "../types";
import { N, cum, isNum, sma } from "../ta";

const LTF: InputDef = { key: "ltf", label: "Intrabar timeframe", type: "ltf", default: "Auto", options: ["Auto", "1m", "5m", "15m", "30m", "1h", "4h", "1D"] };
const UNIVERSE: InputDef = { key: "universe", label: "Universe", type: "breadth", default: "NIFTY50", options: ["NIFTY50", "NIFTY100", "NIFTY200", "NIFTY500"] };

// Up and down volume inside each chart bar: an intrabar that closes above the one before it is
// buying volume, below is selling; unchanged keeps the previous side (the tick rule).
function upDown(groups: Bar[][]) {
  let lastClose = NaN,
    lastSide = 1;
  return groups.map((g) => {
    if (!g.length) return null;
    let up = 0,
      dn = 0;
    for (const b of g) {
      const v = b.volume || 0;
      const side = isNum(lastClose) ? (b.close > lastClose ? 1 : b.close < lastClose ? -1 : lastSide) : b.close >= b.open ? 1 : -1;
      if (side > 0) up += v;
      else dn += v;
      lastSide = side;
      lastClose = b.close;
    }
    return { up, dn };
  });
}

const noIntrabar = (rows: unknown[]) => (rows.some(Boolean) ? undefined : "No intrabar data for these bars yet (lower timeframe history is shorter)");

const anchorKey = (t: number, anchor: string) => {
  const d = new Date((t + 19800) * 1000);
  if (anchor === "Session") return d.toISOString().slice(0, 10);
  if (anchor === "Week") return String(Math.floor((t / 86400 + 3) / 7));
  if (anchor === "Month") return d.toISOString().slice(0, 7);
  if (anchor === "Year") return String(d.getUTCFullYear());
  return "all";
};

export const DATA_HEAVY_INDICATORS: IndicatorDef[] = [
  {
    id: "voldelta",
    name: "Volume delta",
    group: "Volume",
    overlay: false,
    volumeFormat: true,
    description: "Buying minus selling volume in each bar, from lower-timeframe bars (classified by the tick rule).",
    inputs: [LTF],
    outputs: [{ key: "delta", label: "Volume delta", kind: "histogram", color: "#089981" }],
    levels: [0],
    calc: (bars, p) => {
      const ud = upDown((p.ltf__groups as Bar[][]) || []);
      const err = noIntrabar(ud);
      if (err) return { error: err };
      const delta = ud.map((x) => (x ? x.up - x.dn : N));
      return { delta, colors: delta.map((v) => (v >= 0 ? "rgba(8,153,129,0.8)" : "rgba(242,54,69,0.8)")) };
    },
  },
  {
    id: "cvd",
    name: "Cumulative volume delta",
    group: "Volume",
    overlay: false,
    volumeFormat: true,
    description: "Running total of volume delta, restarting each session, week, month or year.",
    inputs: [{ key: "anchor", label: "Anchor period", type: "select", options: ["Session", "Week", "Month", "Year", "Never"], default: "Session" }, LTF],
    outputs: [{ key: "cvd", label: "CVD", kind: "line", color: "#2962ff", plot: "area" }],
    levels: [0],
    calc: (bars, p) => {
      const ud = upDown((p.ltf__groups as Bar[][]) || []);
      const err = noIntrabar(ud);
      if (err) return { error: err };
      let run = 0,
        key = "";
      const cvd = ud.map((x, i) => {
        const k = anchorKey(bars[i].time, p.anchor as string);
        if (k !== key) (run = 0), (key = k);
        if (!x) return N;
        run += x.up - x.dn;
        return run;
      });
      const cvdColors = cvd.map((v) => (v >= 0 ? "#089981" : "#f23645"));
      return { cvd, cvdColors };
    },
  },
  {
    id: "updownvol",
    name: "Up/down volume",
    group: "Volume",
    overlay: false,
    volumeFormat: true,
    description: "Buying volume above zero, selling volume below, and their difference.",
    inputs: [LTF],
    outputs: [
      { key: "up", label: "Up volume", kind: "histogram", color: "rgba(8,153,129,0.7)" },
      { key: "down", label: "Down volume", kind: "histogram", color: "rgba(242,54,69,0.7)" },
      { key: "delta", label: "Delta", kind: "line", color: "#2962ff" },
    ],
    levels: [0],
    calc: (_bars, p) => {
      const ud = upDown((p.ltf__groups as Bar[][]) || []);
      const err = noIntrabar(ud);
      if (err) return { error: err };
      return { up: ud.map((x) => (x ? x.up : N)), down: ud.map((x) => (x ? -x.dn : N)), delta: ud.map((x) => (x ? x.up - x.dn : N)) };
    },
  },
  {
    id: "adline",
    name: "Advance-decline line",
    group: "Breadth",
    overlay: false,
    description: "Running total of advancing minus declining stocks in the index (NSE constituents).",
    inputs: [UNIVERSE],
    outputs: [{ key: "value", label: "A/D line", kind: "line", color: "#2962ff" }],
    calc: (_bars, p) => {
      const rows = (p.universe__rows as (BreadthRow | null)[]) || [];
      if (!rows.some(Boolean)) return { error: "No breadth data on this timeframe" };
      let run = 0;
      return { value: rows.map((r) => (r ? (run += r.adv - r.dec) : N)) };
    },
  },
  {
    id: "adratio",
    name: "Advance-decline ratio",
    group: "Breadth",
    overlay: false,
    description: "Advancing stocks divided by declining stocks in the index.",
    inputs: [UNIVERSE, { key: "smooth", label: "Smoothing (SMA, 0 = off)", type: "int", default: 0, min: 0 }],
    outputs: [{ key: "value", label: "A/D ratio", kind: "line", color: "#2962ff" }],
    levels: [1],
    calc: (_bars, p) => {
      const rows = (p.universe__rows as (BreadthRow | null)[]) || [];
      if (!rows.some(Boolean)) return { error: "No breadth data on this timeframe" };
      const value = rows.map((r) => (r && r.dec ? r.adv / r.dec : r ? r.adv : N));
      return { value: (p.smooth as number) > 0 ? sma(value, p.smooth as number) : value };
    },
  },
  {
    id: "adratiobars",
    name: "Advance-decline ratio (bars)",
    group: "Breadth",
    overlay: false,
    description: "This symbol's up bars divided by its down bars over the last N bars.",
    inputs: [{ key: "length", label: "Length", type: "int", default: 9, min: 1 }],
    outputs: [{ key: "value", label: "A/D ratio (bars)", kind: "line", color: "#2962ff" }],
    levels: [1],
    calc: (bars, p) => {
      const n = p.length as number;
      const value = bars.map((_, i) => {
        if (i < n) return N;
        let up = 0,
          dn = 0;
        for (let k = i - n + 1; k <= i; k++) bars[k].close > bars[k - 1].close ? up++ : bars[k].close < bars[k - 1].close && dn++;
        return dn ? up / dn : up;
      });
      return { value };
    },
  },
  {
    id: "cvi",
    name: "Cumulative volume index",
    group: "Breadth",
    overlay: false,
    volumeFormat: true,
    description: "Running total of volume in advancing stocks minus volume in declining stocks (NSE constituents).",
    inputs: [UNIVERSE],
    outputs: [{ key: "value", label: "CVI", kind: "line", color: "#2962ff" }],
    calc: (_bars, p) => {
      const rows = (p.universe__rows as (BreadthRow | null)[]) || [];
      if (!rows.some(Boolean)) return { error: "No breadth data on this timeframe" };
      return { value: cum(rows.map((r) => (r ? r.advVol - r.decVol : 0))).map((v, i) => (rows[i] ? v : N)) };
    },
  },
  {
    id: "seasonality",
    name: "Seasonality",
    group: "Trend",
    overlay: false,
    percentFormat: true,
    description: "How this symbol moved through each of the last few years (from 1 January), drawn over the current year, with the average.",
    inputs: [{ key: "years", label: "Years for the average", type: "int", default: 10, min: 2, max: 30 }],
    outputs: [
      { key: "y0", label: "This year", kind: "line", color: "#2962ff", lineWidth: 2 },
      { key: "y1", label: "Last year", kind: "line", color: "#ff9800" },
      { key: "y2", label: "2 years ago", kind: "line", color: "#9c27b0" },
      { key: "y3", label: "3 years ago", kind: "line", color: "#00bcd4" },
      { key: "avg", label: "Average", kind: "line", color: "#787b86", lineWidth: 2 },
    ],
    levels: [0],
    calc: (bars, _p, _ta, ctx) => {
      if ((ctx?.tfSeconds || 86400) !== 86400) return { error: "Seasonality draws on the daily chart" };
      if (!bars.length) return {};
      const p = _p as { years: number };
      // % change from the last close of the previous year, by day of year, for each year.
      const byYear = new Map<number, { doy: number; pct: number }[]>();
      let prevClose = NaN,
        prevYear = -1;
      const doyOf = (t: number) => {
        const d = new Date(t * 1000);
        return Math.floor((t * 1000 - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400e3);
      };
      let base = NaN;
      for (const b of bars) {
        const y = new Date(b.time * 1000).getUTCFullYear();
        if (y !== prevYear) {
          base = isNum(prevClose) ? prevClose : b.open;
          prevYear = y;
          byYear.set(y, []);
        }
        byYear.get(y)!.push({ doy: doyOf(b.time), pct: ((b.close - base) / base) * 100 });
        prevClose = b.close;
      }
      const lastT = bars[bars.length - 1].time;
      const cy = new Date(lastT * 1000).getUTCFullYear();
      const at = (y: number, doy: number) => {
        const rows = byYear.get(y);
        if (!rows?.length || doy < rows[0].doy) return rows?.length && doy >= 0 ? 0 : N;
        let v = N;
        for (const r of rows) if (r.doy <= doy) v = r.pct;
        return v;
      };
      // The current year's bars, then calendar days to 31 December drawn past the last bar.
      const step = ctx?.tfSeconds || 86400;
      const futureDays = Math.max(0, Math.floor((Date.UTC(cy, 11, 31) / 1000 - lastT) / step));
      const times = [...bars.map((b) => b.time), ...Array.from({ length: futureDays }, (_, k) => lastT + (k + 1) * step)];
      const yearsBack = Array.from({ length: p.years }, (_, k) => cy - 1 - k).filter((y) => byYear.has(y));
      const series = (fn: (doy: number) => number) => times.map((t) => (new Date(t * 1000).getUTCFullYear() === cy ? fn(doyOf(t)) : N));
      const isPast = (t: number) => t <= lastT;
      return {
        y0: times.map((t) => (isPast(t) && new Date(t * 1000).getUTCFullYear() === cy ? at(cy, doyOf(t)) : N)),
        y1: series((d) => at(cy - 1, d)),
        y2: series((d) => at(cy - 2, d)),
        y3: series((d) => at(cy - 3, d)),
        avg: series((d) => {
          const vals = yearsBack.map((y) => at(y, d)).filter(isNum);
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : N;
        }),
        extendBars: futureDays,
      };
    },
  },
];
