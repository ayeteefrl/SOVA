// The indicators on "advik main", rebuilt to match TradingView's settings and look.
import type { Bar } from "../../data";
import type { IndicatorDef, Label } from "../types";
import { MA_TYPES, N, SOURCE_INPUT, crossover, crossunder, ema, isNum, ma, pivotHigh, pivotLow, rsi, shift, sma, source, stdev } from "../ta";

const shiftForward = (s: number[], k: number) => {
  // Move values k bars to the right (k < 0: left), extending past the last bar.
  if (k >= 0) return [...new Array(k).fill(N), ...s];
  return [...s.slice(-k), ...new Array(-k).fill(N)];
};

export const YOUR_INDICATORS: IndicatorDef[] = [
  // ---------- Moving average crossover (TradingView built-in) ----------
  {
    id: "macross",
    name: "Moving average crossover",
    group: "Moving averages",
    overlay: true,
    inputs: [
      { key: "short", label: "Short MA length", type: "int", default: 9, min: 1 },
      { key: "long", label: "Long MA length", type: "int", default: 21, min: 1 },
      { key: "type", label: "MA type", type: "select", options: ["SMA", "EMA", "SMMA (RMA)", "WMA", "VWMA"], default: "SMA" },
      SOURCE_INPUT,
    ],
    outputs: [
      { key: "short", label: "Short MA", kind: "line", color: "#ff6d00" },
      { key: "long", label: "Long MA", kind: "line", color: "#43a047" },
      { key: "cross", label: "Crossover", kind: "line", color: "#2962ff", plot: "cross", lineWidth: 4 },
    ],
    calc: (bars, p) => {
      const s = source(bars, p.source as string),
        v = source(bars, "volume");
      const short = ma(p.type as string, s, p.short as number, v),
        long = ma(p.type as string, s, p.long as number, v);
      const up = crossover(short, long),
        dn = crossunder(short, long);
      return { short, long, cross: short.map((x, i) => (up[i] || dn[i] ? x : N)) };
    },
  },

  // ---------- Ichimoku cloud ----------
  {
    id: "ichimoku",
    name: "Ichimoku cloud",
    group: "Trend",
    overlay: true,
    inputs: [
      { key: "conversion", label: "Conversion line length", type: "int", default: 9, min: 1 },
      { key: "base", label: "Base line length", type: "int", default: 26, min: 1 },
      { key: "spanB", label: "Leading span B length", type: "int", default: 52, min: 1 },
      { key: "displacement", label: "Lagging span", type: "int", default: 26, min: 1 },
    ],
    outputs: [
      { key: "conversion", label: "Conversion line", kind: "line", color: "#2962ff" },
      { key: "base", label: "Base line", kind: "line", color: "#b71c1c" },
      { key: "lagging", label: "Lagging span", kind: "line", color: "#43a047" },
      { key: "spanA", label: "Leading span A", kind: "line", color: "#a5d6a7" },
      { key: "spanB", label: "Leading span B", kind: "line", color: "#ef9a9a" },
    ],
    fills: [{ id: "cloud", label: "Kumo cloud", from: "spanA", to: "spanB", upColor: "rgba(67,160,71,0.1)", downColor: "rgba(244,67,54,0.1)" }],
    calc: (bars, p) => {
      const hi = source(bars, "high"),
        lo = source(bars, "low");
      const mid = (n: number) => {
        const out = new Array(bars.length).fill(N);
        for (let i = n - 1; i < bars.length; i++) {
          let h = -Infinity,
            l = Infinity;
          for (let k = i - n + 1; k <= i; k++) (h = Math.max(h, hi[k])), (l = Math.min(l, lo[k]));
          out[i] = (h + l) / 2;
        }
        return out;
      };
      const conversion = mid(p.conversion as number),
        base = mid(p.base as number);
      const a = conversion.map((v, i) => (v + base[i]) / 2),
        b = mid(p.spanB as number);
      const off = (p.displacement as number) - 1;
      const pad = (s: number[]) => [...s, ...new Array(off).fill(N)];
      return {
        conversion: pad(conversion),
        base: pad(base),
        lagging: pad(shiftForward(source(bars, "close"), -off)),
        spanA: shiftForward(a, off),
        spanB: shiftForward(b, off),
        extendBars: off,
      };
    },
  },

  // ---------- EMA 20/50/100/200 (community script on your chart) ----------
  {
    id: "ema4",
    name: "EMA 20/50/100/200",
    group: "Moving averages",
    overlay: true,
    inputs: [
      { key: "l1", label: "EMA 1", type: "int", default: 20, min: 1 },
      { key: "l2", label: "EMA 2", type: "int", default: 50, min: 1 },
      { key: "l3", label: "EMA 3", type: "int", default: 100, min: 1 },
      { key: "l4", label: "EMA 4", type: "int", default: 200, min: 1 },
      SOURCE_INPUT,
    ],
    outputs: [
      { key: "e1", label: "EMA 20", kind: "line", color: "rgba(255,0,0,0.65)" },
      { key: "e2", label: "EMA 50", kind: "line", color: "rgba(255,127,0,0.65)" },
      { key: "e3", label: "EMA 100", kind: "line", color: "rgba(0,188,212,0.65)" },
      { key: "e4", label: "EMA 200", kind: "line", color: "rgba(41,98,255,0.65)" },
    ],
    calc: (bars, p) => {
      const s = source(bars, p.source as string);
      return { e1: ema(s, p.l1 as number), e2: ema(s, p.l2 as number), e3: ema(s, p.l3 as number), e4: ema(s, p.l4 as number) };
    },
  },

  // ---------- Relative strength index (TradingView's current version) ----------
  {
    id: "rsi",
    name: "Relative strength index",
    group: "Momentum",
    overlay: false,
    inputs: [
      { key: "length", label: "RSI length", type: "int", default: 14, min: 1, group: "RSI settings" },
      { ...SOURCE_INPUT, group: "RSI settings" },
      { key: "divergence", label: "Calculate divergence", type: "bool", default: false, group: "RSI settings" },
      { key: "maType", label: "Type", type: "select", options: ["None", "SMA", "SMA + Bollinger Bands", "EMA", "SMMA (RMA)", "WMA", "VWMA"], default: "SMA", group: "Smoothing" },
      { key: "maLength", label: "Length", type: "int", default: 14, min: 1, group: "Smoothing" },
      { key: "bbMult", label: "BB StdDev", type: "float", default: 2, step: 0.5, group: "Smoothing" },
    ],
    outputs: [
      { key: "value", label: "RSI", kind: "line", color: "#7e57c2" },
      { key: "ma", label: "RSI-based MA", kind: "line", color: "#f7c600" },
      { key: "upper", label: "Upper Bollinger Band", kind: "line", color: "#089981" },
      { key: "lower", label: "Lower Bollinger Band", kind: "line", color: "#089981" },
    ],
    levels: [70, 50, 30],
    fills: [
      { id: "bg", label: "RSI background", from: "level:70", to: "level:30", color: "rgba(126,87,194,0.1)" },
      { id: "ob", label: "Overbought gradient", from: "value", to: "level:70", clip: "above", gradient: { top: 100, bottom: 70, topColor: "rgba(76,175,80,1)", bottomColor: "rgba(76,175,80,0)" } },
      { id: "os", label: "Oversold gradient", from: "value", to: "level:30", clip: "below", gradient: { top: 30, bottom: 0, topColor: "rgba(242,54,69,0)", bottomColor: "rgba(242,54,69,1)" } },
      { id: "bb", label: "Bollinger Bands background", from: "upper", to: "lower", color: "rgba(8,153,129,0.1)" },
    ],
    calc: (bars, p) => {
      const s = source(bars, p.source as string);
      const value = rsi(s, p.length as number);
      const t = p.maType as string;
      const none = value.map(() => N);
      const smooth = t === "None" ? none : ma(t === "SMA + Bollinger Bands" ? "SMA" : t, value, p.maLength as number, source(bars, "volume"));
      let upper = none,
        lower = none;
      if (t === "SMA + Bollinger Bands") {
        const sd = stdev(value, p.maLength as number);
        upper = smooth.map((m, i) => m + (p.bbMult as number) * sd[i]);
        lower = smooth.map((m, i) => m - (p.bbMult as number) * sd[i]);
      }
      const labels: Label[] = p.divergence ? rsiDivergence(bars, value) : [];
      return { value, ma: smooth, upper, lower, labels };
    },
  },

  // ---------- Relative Strength vs an index (community script on your chart) ----------
  {
    id: "relstrength",
    name: "Relative strength vs index",
    group: "Momentum",
    overlay: false,
    description: "How this symbol has done against another (NIFTY by default) over the period: (price / price N bars ago) ÷ (index / index N bars ago) − 1. Above zero means it's outperforming.",
    inputs: [
      SOURCE_INPUT,
      { key: "symbol", label: "Comparative symbol", type: "symbol", default: "NSE:NIFTY" },
      { key: "period", label: "Period", type: "int", default: 123, min: 1 },
      { key: "zeroLine", label: "Show zero line", type: "bool", default: true },
      { key: "refLabel", label: "Show reference label", type: "bool", default: true },
      { key: "crossColor", label: "Colour RS on zero crossings", type: "bool", default: true },
      { key: "trendColor", label: "Trend colour background", type: "bool", default: true },
      { key: "trendPeriod", label: "Trend MA period", type: "int", default: 50, min: 1 },
      { key: "posColor", label: "+ve", type: "color", default: "rgba(76,175,80,0.15)" },
      { key: "negColor", label: "−ve", type: "color", default: "rgba(242,54,69,0.15)" },
    ],
    outputs: [
      { key: "rs", label: "RS", kind: "line", color: "#2962ff", lineWidth: 2 },
      { key: "trend", label: "RS trend MA", kind: "line", color: "#787b86", hiddenByDefault: true },
      { key: "zero", label: "Zero line", kind: "line", color: "#787b86" },
    ],
    calc: (bars, p) => {
      const cmp = p.symbol__bars as (Bar | null)[] | undefined;
      if (!cmp) return { pending: true };
      const n = p.period as number;
      const base = source(bars, p.source as string);
      const other = cmp.map((b) => (b ? b.close : N));
      const rs = base.map((v, i) => (i >= n && isNum(other[i]) && isNum(other[i - n]) && base[i - n] && other[i - n] ? v / base[i - n] / (other[i] / other[i - n]) - 1 : N));
      const trend = sma(rs, p.trendPeriod as number);
      const rsColors = p.crossColor ? rs.map((v) => (v >= 0 ? "#089981" : "#f23645")) : undefined;
      const bg = p.trendColor ? rs.map((v, i) => (!isNum(v) || !isNum(trend[i]) ? null : v >= trend[i] ? (p.posColor as string) : (p.negColor as string))) : undefined;
      const last = rs.length - 1;
      const labels: Label[] = p.refLabel && isNum(rs[last]) ? [{ time: bars[last].time, price: rs[last], text: String(p.symbol).split(":").pop()!, color: "#2962ff", position: rs[last] >= 0 ? "above" : "below" }] : [];
      return { rs, rsColors, trend, zero: p.zeroLine ? rs.map(() => 0) : rs.map(() => N), bg, labels };
    },
  },

  // ---------- TL Volume RL (community script on your chart), rebuilt ----------
  {
    id: "tlvolume",
    name: "TL Volume RL",
    tv: "rebuilt: relative volume, traded value table",
    group: "Volume",
    overlay: false,
    volumeFormat: true,
    description: "Volume coloured by relative volume (vs its average), with a table of average traded value, relative volume, up/down volume ratio and today's run rate.",
    inputs: [
      { key: "highColor", label: "High relative volume colour", type: "color", default: "#00e676" },
      { key: "lowColor", label: "Low relative volume colour", type: "color", default: "#ff9800" },
      { key: "upColor", label: "Up colour", type: "color", default: "#2962ff" },
      { key: "downColor", label: "Down colour", type: "color", default: "#e040fb" },
      { key: "dailyLookback", label: "Daily lookback", type: "int", default: 50, min: 2 },
      { key: "weeklyLookback", label: "Weekly lookback", type: "int", default: 10, min: 2 },
      { key: "highRv", label: "High RV at (× average)", type: "float", default: 1.5, step: 0.1 },
      { key: "lowRv", label: "Low RV under (× average)", type: "float", default: 0.5, step: 0.1 },
      { key: "dollarLength", label: "Avg traded value length", type: "int", default: 20, min: 1 },
      { key: "udLength", label: "Up/down volume length", type: "int", default: 50, min: 1 },
      { key: "table", label: "Show table", type: "bool", default: true },
      { key: "tablePos", label: "Table position", type: "select", options: ["Top Right", "Top Left", "Bottom Right", "Bottom Left"], default: "Top Right" },
    ],
    outputs: [
      { key: "volume", label: "Volume", kind: "histogram", color: "#2962ff" },
      { key: "avg", label: "Average volume", kind: "line", color: "#e040fb" },
    ],
    calc: (bars, p, _ta, ctx) => {
      const v = source(bars, "volume");
      const weekly = (ctx?.tfSeconds || 86400) >= 7 * 86400;
      const look = (weekly ? p.weeklyLookback : p.dailyLookback) as number;
      const avg = sma(v, look);
      const colors = bars.map((b, i) => {
        const rv = avg[i] ? v[i] / avg[i] : 1;
        if (rv >= (p.highRv as number)) return p.highColor as string;
        if (rv <= (p.lowRv as number)) return p.lowColor as string;
        return (b.close >= b.open ? p.upColor : p.downColor) as string;
      });
      const res: Record<string, unknown> = { volume: v, avg, colors };
      if (p.table && bars.length) {
        const i = bars.length - 1;
        const dv = sma(bars.map((b) => b.close * (b.volume || 0)), p.dollarLength as number)[i];
        let up = 0,
          dn = 0;
        for (let k = Math.max(1, i - (p.udLength as number) + 1); k <= i; k++) (bars[k].close >= bars[k - 1].close ? (up += v[k]) : (dn += v[k]));
        const rv = avg[i] ? v[i] / avg[i] : N;
        // Run rate: today's volume projected to the full 6h15m session (intraday charts only).
        const intraday = (ctx?.tfSeconds || 86400) < 86400;
        const pos = (p.tablePos as string).toLowerCase().replace(" ", "_") as "top_right";
        const rows: (string | { text: string; color?: string })[][] = [
          ["Avg value", fmtMoney(dv)],
          ["Rel. volume", { text: isNum(rv) ? `${rv.toFixed(2)}×` : "—", color: rv >= (p.highRv as number) ? (p.highColor as string) : rv <= (p.lowRv as number) ? (p.lowColor as string) : undefined }],
          ["Up/down vol", dn ? `${(up / dn).toFixed(2)}` : "—"],
        ];
        if (intraday) rows.push(["Run rate", runRate(bars)]);
        res.table = { position: pos, rows };
      }
      return res;
    },
  },
];

function fmtMoney(v: number) {
  if (!isNum(v)) return "—";
  // Indian convention for rupee values: crore (1e7) and lakh (1e5).
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  return v.toFixed(0);
}

function runRate(bars: Bar[]) {
  const last = bars[bars.length - 1];
  const day = Math.floor((last.time + 19800) / 86400);
  let vol = 0,
    first = last.time;
  for (let i = bars.length - 1; i >= 0 && Math.floor((bars[i].time + 19800) / 86400) === day; i--) (vol += bars[i].volume || 0), (first = bars[i].time);
  const elapsed = Math.max(60, last.time - first + 60);
  const session = 6.25 * 3600;
  return `${((vol * session) / elapsed / 1e5).toFixed(2)} L proj.`;
}

// TradingView's RSI divergence: pivots 5 bars each side, the previous pivot 5 to 60 bars back.
function rsiDivergence(bars: Bar[], r: number[]): Label[] {
  const L = 5,
    R = 5,
    lo = 5,
    hi = 60;
  const pl = pivotLow(r, L, R),
    ph = pivotHigh(r, L, R);
  const out: Label[] = [];
  let lastLow = -1,
    lastHigh = -1;
  for (let i = 0; i < r.length; i++) {
    if (isNum(pl[i])) {
      const c = i - R;
      if (lastLow >= 0 && c - lastLow >= lo && c - lastLow <= hi && r[c] > r[lastLow] && bars[c].low < bars[lastLow].low)
        out.push({ time: bars[c].time, price: r[c], text: "Bull", color: "#089981", position: "below" });
      lastLow = c;
    }
    if (isNum(ph[i])) {
      const c = i - R;
      if (lastHigh >= 0 && c - lastHigh >= lo && c - lastHigh <= hi && r[c] < r[lastHigh] && bars[c].high > bars[lastHigh].high)
        out.push({ time: bars[c].time, price: r[c], text: "Bear", color: "#f23645", position: "above" });
      lastHigh = c;
    }
  }
  return out;
}

export { MA_TYPES, shift };
