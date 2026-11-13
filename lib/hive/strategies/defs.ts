// TradingView's 22 built-in strategies, following their published Pine source: same inputs,
// same order types (market or stop entries) and the same entry names on the chart.
import * as qt from "../engine/indicators.js";
import type { Bar } from "../data";
import type { InputDef } from "../indicators/types";
import type { StrategyApi } from "./engine";
import { OSCILLATOR_INDICATORS } from "../indicators/defs/oscillators";
import { atr, crossover, crossunder, ema, highest, isNum, lowest, pivotHigh, pivotLow, rsi, sma, source, stdev, tr } from "../indicators/ta";

const qc = qt.compute as unknown as (id: string, bars: Bar[], p?: Record<string, unknown>) => Record<string, number[]>;

export type StrategyDef = {
  id: string;
  name: string;
  description: string;
  inputs: InputDef[];
  // Precompute series once, then return the per-bar logic.
  setup: (bars: Bar[], p: Record<string, number | string | boolean>) => (s: StrategyApi) => void;
};

const int = (key: string, label: string, def: number, min = 1): InputDef => ({ key, label, type: "int", default: def, min });
const float = (key: string, label: string, def: number, step = 0.1): InputDef => ({ key, label, type: "float", default: def, step });

export const STRATEGIES: StrategyDef[] = [
  {
    id: "st_barupdn",
    name: "Bar up/down strategy",
    description: "Long after an up bar that opened above the previous close; short after a down bar that opened below it.",
    inputs: [],
    setup: (bars) => (s) => {
      const b = bars[s.i],
        p = bars[s.i - 1];
      if (!p) return;
      if (b.close > b.open && b.open > p.close) s.entry("BarUp", "long");
      if (b.close < b.open && b.open < p.close) s.entry("BarDn", "short");
    },
  },
  {
    id: "st_bb",
    name: "Bollinger Bands strategy",
    description: "Buy stop at the lower band after price crosses back above it; sell stop at the upper band after price crosses back below it.",
    inputs: [int("length", "Length", 20), float("mult", "StdDev", 2)],
    setup: (bars, p) => {
      const c = source(bars, "close"),
        basis = sma(c, p.length as number),
        dev = stdev(c, p.length as number);
      const upper = basis.map((v, i) => v + (p.mult as number) * dev[i]),
        lower = basis.map((v, i) => v - (p.mult as number) * dev[i]);
      const up = crossover(c, lower),
        dn = crossunder(c, upper);
      return (s) => {
        if (!isNum(basis[s.i])) return;
        if (up[s.i]) s.entry("BBandLE", "long", { stop: lower[s.i] });
        else s.cancel("BBandLE");
        if (dn[s.i]) s.entry("BBandSE", "short", { stop: upper[s.i] });
        else s.cancel("BBandSE");
      };
    },
  },
  {
    id: "st_bbdir",
    name: "Bollinger Bands strategy directed",
    description: "The Bollinger Bands strategy, trading only the direction you pick.",
    inputs: [int("length", "Length", 20), float("mult", "StdDev", 2), { key: "dir", label: "Strategy direction", type: "select", options: ["All", "Long only", "Short only"], default: "All" }],
    setup: (bars, p) => {
      const inner = STRATEGIES[1].setup(bars, p);
      return (s) => {
        const entry = s.entry;
        s.entry = (id, d, o) => {
          if (p.dir === "Long only" && d === "short") return s.close(undefined, "Short not allowed");
          if (p.dir === "Short only" && d === "long") return s.close(undefined, "Long not allowed");
          entry(id, d, o);
        };
        inner(s);
      };
    },
  },
  {
    id: "st_channelbo",
    name: "Channel breakout strategy",
    description: "Buy stop above the highest high and sell stop below the lowest low of the last N bars.",
    inputs: [int("length", "Length", 5)],
    setup: (bars, p) => {
      const up = highest(source(bars, "high"), p.length as number),
        dn = lowest(source(bars, "low"), p.length as number);
      return (s) => {
        if (!isNum(up[s.i])) return;
        s.entry("ChBrkLE", "long", { stop: up[s.i] + s.mintick });
        s.entry("ChBrkSE", "short", { stop: dn[s.i] - s.mintick });
      };
    },
  },
  {
    id: "st_consupdn",
    name: "Consecutive up/down strategy",
    description: "Long after N up closes in a row, short after N down closes in a row.",
    inputs: [int("up", "Consecutive bars up", 3), int("down", "Consecutive bars down", 3)],
    setup: (bars, p) => {
      let ups = 0,
        dns = 0;
      return (s) => {
        const b = bars[s.i],
          prev = bars[s.i - 1];
        if (!prev) return;
        ups = b.close > prev.close ? ups + 1 : 0;
        dns = b.close < prev.close ? dns + 1 : 0;
        if (ups >= (p.up as number)) s.entry("ConsUpLE", "long");
        if (dns >= (p.down as number)) s.entry("ConsDnSE", "short");
      };
    },
  },
  {
    id: "st_greedy",
    name: "Greedy strategy",
    description: "Trades in the direction of each opening gap, with a take profit and a stop in ticks.",
    inputs: [int("tp", "Take profit (ticks)", 10), int("sl", "Stop loss (ticks)", 10)],
    setup: (bars, p) => (s) => {
      const b = bars[s.i],
        prev = bars[s.i - 1];
      if (!prev) return;
      const t = s.mintick;
      if (b.open > prev.high) {
        s.entry("GapUp", "long");
        s.exit("GapUp exit", "GapUp", { limit: b.close + (p.tp as number) * t, stop: b.close - (p.sl as number) * t });
      }
      if (b.open < prev.low) {
        s.entry("GapDn", "short");
        s.exit("GapDn exit", "GapDn", { limit: b.close - (p.tp as number) * t, stop: b.close + (p.sl as number) * t });
      }
    },
  },
  {
    id: "st_insidebar",
    name: "Inside bar strategy",
    description: "On an inside bar, long if it closed up, short if it closed down.",
    inputs: [],
    setup: (bars) => (s) => {
      const b = bars[s.i],
        prev = bars[s.i - 1];
      if (!prev || !(b.high < prev.high && b.low > prev.low)) return;
      if (b.close > b.open) s.entry("InsBarLE", "long");
      if (b.close < b.open) s.entry("InsBarSE", "short");
    },
  },
  {
    id: "st_kc",
    name: "Keltner channels strategy",
    description: "After a close crosses outside the Keltner channel, a stop entry just beyond that bar in the same direction.",
    inputs: [int("length", "Length", 20), float("mult", "Multiplier", 2), { key: "useEma", label: "Use exponential MA", type: "bool", default: true }, int("atrLength", "ATR length", 10)],
    setup: (bars, p) => {
      const c = source(bars, "close");
      const basis = p.useEma ? ema(c, p.length as number) : sma(c, p.length as number);
      const rng = atr(bars, p.atrLength as number);
      const upper = basis.map((v, i) => v + (p.mult as number) * rng[i]),
        lower = basis.map((v, i) => v - (p.mult as number) * rng[i]);
      const up = crossover(c, upper),
        dn = crossunder(c, lower);
      return (s) => {
        const b = bars[s.i];
        if (up[s.i]) s.entry("KltChLE", "long", { stop: b.high + s.mintick });
        else s.cancel("KltChLE");
        if (dn[s.i]) s.entry("KltChSE", "short", { stop: b.low - s.mintick });
        else s.cancel("KltChSE");
      };
    },
  },
  {
    id: "st_macd",
    name: "MACD strategy",
    description: "Long when the MACD crosses above its signal line, short when it crosses below.",
    inputs: [int("fast", "Fast length", 12), int("slow", "Slow length", 26), int("signal", "MACD length", 9)],
    setup: (bars, p) => {
      const m = qc("macd", bars, { fast: p.fast, slow: p.slow, signal: p.signal });
      const delta = m.macd.map((v, i) => v - m.signal[i]);
      const zero = delta.map(() => 0);
      const up = crossover(delta, zero),
        dn = crossunder(delta, zero);
      return (s) => {
        if (up[s.i]) s.entry("MacdLE", "long");
        if (dn[s.i]) s.entry("MacdSE", "short");
      };
    },
  },
  {
    id: "st_momentum",
    name: "Momentum strategy",
    description: "When momentum and its change are both positive, a buy stop above the bar; both negative, a sell stop below it.",
    inputs: [int("length", "Length", 12)],
    setup: (bars, p) => {
      const n = p.length as number;
      const c = source(bars, "close");
      const mom0 = c.map((v, i) => (i >= n ? v - c[i - n] : NaN));
      const mom1 = mom0.map((v, i) => (i >= 1 ? v - mom0[i - 1] : NaN));
      return (s) => {
        const b = bars[s.i];
        if (mom0[s.i] > 0 && mom1[s.i] > 0) s.entry("MomLE", "long", { stop: b.high + s.mintick });
        else s.cancel("MomLE");
        if (mom0[s.i] < 0 && mom1[s.i] < 0) s.entry("MomSE", "short", { stop: b.low - s.mintick });
        else s.cancel("MomSE");
      };
    },
  },
  {
    id: "st_ma2line",
    name: "Two moving averages crossover",
    description: "Long when the fast SMA crosses above the slow one, short when it crosses below.",
    inputs: [int("fast", "Fast length", 9), int("slow", "Slow length", 18)],
    setup: (bars, p) => {
      const c = source(bars, "close");
      const f = sma(c, p.fast as number),
        sl = sma(c, p.slow as number);
      const up = crossover(f, sl),
        dn = crossunder(f, sl);
      return (s) => {
        if (up[s.i]) s.entry("MA2CrossLE", "long");
        if (dn[s.i]) s.entry("MA2CrossSE", "short");
      };
    },
  },
  {
    id: "st_macross",
    name: "Moving average cross strategy",
    description: "After N closes above (below) the SMA, a buy (sell) stop just beyond the bar.",
    inputs: [int("length", "Length", 9), int("confirm", "Confirm bars", 1)],
    setup: (bars, p) => {
      const c = source(bars, "close"),
        m = sma(c, p.length as number);
      let above = 0,
        below = 0;
      return (s) => {
        const b = bars[s.i];
        above = c[s.i] > m[s.i] ? above + 1 : 0;
        below = c[s.i] < m[s.i] ? below + 1 : 0;
        if (above === (p.confirm as number)) s.entry("MACrossLE", "long", { stop: b.high + s.mintick });
        else s.cancel("MACrossLE");
        if (below === (p.confirm as number)) s.entry("MACrossSE", "short", { stop: b.low - s.mintick });
        else s.cancel("MACrossSE");
      };
    },
  },
  {
    id: "st_outsidebar",
    name: "Outside bar strategy",
    description: "On an outside bar, long if it closed up, short if it closed down.",
    inputs: [],
    setup: (bars) => (s) => {
      const b = bars[s.i],
        prev = bars[s.i - 1];
      if (!prev || !(b.high > prev.high && b.low < prev.low)) return;
      if (b.close > b.open) s.entry("OutBarLE", "long");
      if (b.close < b.open) s.entry("OutBarSE", "short");
    },
  },
  {
    id: "st_psar",
    name: "Parabolic SAR strategy",
    description: "Always in the market: stop orders at the next SAR level reverse the position.",
    inputs: [float("start", "Start", 0.02, 0.01), float("inc", "Increment", 0.02, 0.01), float("max", "Max value", 0.2, 0.05)],
    setup: (bars, p) => {
      const sar = qc("psar", bars, { start: p.start, inc: p.inc, max: p.max }).value;
      return (s) => {
        const v = sar[s.i];
        if (!isNum(v)) return;
        // SAR below price is the long trailing stop: place a sell stop there, and vice versa.
        if (v < bars[s.i].close) {
          s.entry("ParSE", "short", { stop: v });
          s.cancel("ParLE");
        } else {
          s.entry("ParLE", "long", { stop: v });
          s.cancel("ParSE");
        }
      };
    },
  },
  {
    id: "st_pivotext",
    name: "Pivot extension strategy",
    description: "Short at a confirmed pivot high, long at a confirmed pivot low.",
    inputs: [int("left", "Pivot lookback left", 4), int("right", "Pivot lookback right", 2)],
    setup: (bars, p) => {
      const ph = pivotHigh(source(bars, "high"), p.left as number, p.right as number),
        pl = pivotLow(source(bars, "low"), p.left as number, p.right as number);
      return (s) => {
        if (isNum(pl[s.i])) s.entry("PivExtLE", "long");
        if (isNum(ph[s.i])) s.entry("PivExtSE", "short");
      };
    },
  },
  {
    id: "st_pivotrev",
    name: "Pivot reversal strategy",
    description: "Buy stop above the last pivot high and sell stop below the last pivot low.",
    inputs: [int("left", "Pivot lookback left", 4), int("right", "Pivot lookback right", 2)],
    setup: (bars, p) => {
      const ph = pivotHigh(source(bars, "high"), p.left as number, p.right as number),
        pl = pivotLow(source(bars, "low"), p.left as number, p.right as number);
      let hprice = 0,
        lprice = 0;
      return (s) => {
        if (isNum(ph[s.i])) hprice = ph[s.i];
        if (isNum(pl[s.i])) lprice = pl[s.i];
        if (hprice > 0 && bars[s.i].high <= hprice) s.entry("PivRevLE", "long", { stop: hprice + s.mintick });
        if (lprice > 0 && bars[s.i].low >= lprice) s.entry("PivRevSE", "short", { stop: lprice - s.mintick });
      };
    },
  },
  {
    id: "st_pricechannel",
    name: "Price channel strategy",
    description: "Buy stop at the highest high and sell stop at the lowest low of the last N bars.",
    inputs: [int("length", "Length", 20)],
    setup: (bars, p) => {
      const hh = highest(source(bars, "high"), p.length as number),
        ll = lowest(source(bars, "low"), p.length as number);
      return (s) => {
        if (!isNum(hh[s.i])) return;
        s.entry("PChLE", "long", { stop: hh[s.i] });
        s.entry("PChSE", "short", { stop: ll[s.i] });
      };
    },
  },
  {
    id: "st_rsi",
    name: "RSI strategy",
    description: "Long when RSI crosses up through the oversold level, short when it crosses down through overbought.",
    inputs: [int("length", "Length", 14), int("os", "Oversold", 30, 0), int("ob", "Overbought", 70, 0)],
    setup: (bars, p) => {
      const r = rsi(source(bars, "close"), p.length as number);
      const up = crossover(r, r.map(() => p.os as number)),
        dn = crossunder(r, r.map(() => p.ob as number));
      return (s) => {
        if (up[s.i]) s.entry("RsiLE", "long");
        if (dn[s.i]) s.entry("RsiSE", "short");
      };
    },
  },
  {
    id: "st_stochslow",
    name: "Stochastic slow strategy",
    description: "Long when %K crosses above %D below oversold; short when it crosses below above overbought.",
    inputs: [int("length", "Length", 14), int("smoothK", "Smooth K", 3), int("smoothD", "Smooth D", 3), int("os", "Oversold", 20, 0), int("ob", "Overbought", 80, 0)],
    setup: (bars, p) => {
      const n = p.length as number;
      const hh = highest(source(bars, "high"), n),
        ll = lowest(source(bars, "low"), n);
      const raw = bars.map((b, i) => (hh[i] - ll[i] ? (100 * (b.close - ll[i])) / (hh[i] - ll[i]) : NaN));
      const k = sma(raw, p.smoothK as number),
        d = sma(k, p.smoothD as number);
      const up = crossover(k, d),
        dn = crossunder(k, d);
      return (s) => {
        if (up[s.i] && k[s.i] < (p.os as number)) s.entry("StochLE", "long");
        if (dn[s.i] && k[s.i] > (p.ob as number)) s.entry("StochSE", "short");
      };
    },
  },
  {
    id: "st_supertrend",
    name: "Supertrend strategy",
    description: "Long when Supertrend turns up, short when it turns down.",
    inputs: [int("atrLength", "ATR length", 10), float("factor", "Factor", 3)],
    setup: (bars, p) => {
      const r = qc("supertrend", bars, { atrLength: p.atrLength, factor: p.factor });
      return (s) => {
        const i = s.i;
        if (isNum(r.up[i]) && !isNum(r.up[i - 1])) s.entry("My Long Entry Id", "long");
        if (isNum(r.down[i]) && !isNum(r.down[i - 1])) s.entry("My Short Entry Id", "short");
      };
    },
  },
  {
    id: "st_ratings",
    name: "Technical ratings strategy",
    description: "Long when the technical rating turns Strong buy, short when it turns Strong sell.",
    inputs: [float("threshold", "Strong signal above", 0.5, 0.05)],
    setup: (bars, p) => {
      const def = OSCILLATOR_INDICATORS.find((d) => d.id === "ratings")!;
      const rating = def.calc(bars, { basis: "MAs and oscillators" }, null).rating as number[];
      const th = p.threshold as number;
      return (s) => {
        const r = rating[s.i],
          prev = rating[s.i - 1];
        if (r > th && !(prev > th)) s.entry("TR LE", "long");
        if (r < -th && !(prev < -th)) s.entry("TR SE", "short");
      };
    },
  },
  {
    id: "st_vecs",
    name: "Volatility expansion-close strategy",
    description: "Stop orders an ATR multiple above and below each close: a big move away from the close enters with it.",
    inputs: [int("length", "Length", 5), float("atrs", "Number of ATRs", 0.75, 0.05)],
    setup: (bars, p) => {
      const range = sma(tr(bars), p.length as number).map((v) => v * (p.atrs as number));
      return (s) => {
        if (!isNum(range[s.i])) return;
        const c = bars[s.i].close;
        s.entry("VltClsLE", "long", { stop: c + range[s.i] });
        s.entry("VltClsSE", "short", { stop: c - range[s.i] });
      };
    },
  },
];
