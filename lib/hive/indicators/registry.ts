// Every indicator: Quant Terminal's, plus the TradingView standard ones added here (which replace
// a Quant Terminal one with the same id). Names follow TradingView so search finds them.
import * as qt from "../engine/indicators.js";
import type { Bar } from "../data";
import type { CalcContext, IndicatorDef, IndicatorResult } from "./types";
import { YOUR_INDICATORS } from "./defs/yours";
import { OVERLAY_INDICATORS } from "./defs/overlays";
import { OSCILLATOR_INDICATORS } from "./defs/oscillators";
import { STRATEGY_INDICATORS } from "../strategies/as-indicators";
import { DATA_HEAVY_INDICATORS } from "./defs/data-heavy";

const QT = qt.INDICATORS as unknown as IndicatorDef[];

// TradingView's names for Quant Terminal's indicators.
const TV_NAMES: Record<string, string> = {
  sma: "Moving average simple",
  ema: "Moving average exponential",
  wma: "Moving average weighted",
  vwma: "Volume weighted moving average",
  hma: "Hull moving average",
  dema: "Double EMA",
  tema: "Triple EMA",
  smma: "Smoothed moving average",
  alma: "Arnaud Legoux moving average",
  lsma: "Least squares moving average",
  mcginley: "McGinley dynamic",
  ribbon: "Moving average ribbon",
  guppy: "Guppy multiple moving average",
  vwap: "Volume weighted average price (VWAP)",
  avwap: "Anchored VWAP",
  twap: "Time weighted average price",
  bbpb: "Bollinger Bands %b",
  bbw: "Bollinger BandWidth",
  bbtrend: "BBTrend",
  atr: "Average true range",
  stdev: "Standard deviation",
  hv: "Historical volatility",
  rvi: "Relative volatility index",
  crsi: "Connors RSI",
  stoch: "Stochastic",
  stochrsi: "Stochastic RSI",
  macd: "Moving average convergence divergence (MACD)",
  cci: "Commodity channel index",
  willr: "Williams percent range",
  fisher: "Fisher transform",
  roc: "Rate of change",
  mom: "Momentum",
  mfi: "Money flow index",
  cmo: "Chande momentum oscillator",
  rci: "Rank correlation index",
  trix: "TRIX",
  ao: "Awesome oscillator",
  uo: "Ultimate oscillator",
  tsi: "True strength index",
  smiergodic: "SMI ergodic indicator/oscillator",
  ppo: "Price oscillator",
  coppock: "Coppock curve",
  kst: "Know sure thing",
  dpo: "Detrended price oscillator",
  elder: "Elder ray (bull/bear power)",
  bop: "Balance of power",
  rvgi: "Relative vigor index",
  dmi: "Directional movement index",
  adx: "Average directional index",
  aroon: "Aroon",
  vortex: "Vortex indicator",
  chop: "Choppiness index",
  chopzone: "Chop zone",
  trendstrength: "Trend strength index",
  mass: "Mass index",
  psar: "Parabolic SAR",
  vstop: "Volatility stop",
  cks: "Chande Kroll stop",
  alligator: "Williams alligator",
  pivots: "Pivot points standard",
  pdhl: "Previous day high/low",
  pivotshl: "Pivot points high low",
  zigzag: "Zig zag",
  volume: "Volume",
  obv: "On balance volume",
  cmf: "Chaikin money flow",
  ad: "Accumulation/distribution",
  chaikinosc: "Chaikin oscillator",
  pvt: "Price volume trend",
  eom: "Ease of movement",
  efi: "Elder's force index",
  kvo: "Klinger oscillator",
  volosc: "Volume oscillator",
  netvol: "Net volume",
  patterns: "Candlestick patterns",
  fractals: "Williams fractals",
};

const ADDED = [...YOUR_INDICATORS, ...OVERLAY_INDICATORS, ...OSCILLATOR_INDICATORS, ...DATA_HEAVY_INDICATORS, ...STRATEGY_INDICATORS];
const addedIds = new Set(ADDED.map((d) => d.id));

export const INDICATORS: IndicatorDef[] = [...QT.filter((d) => !addedIds.has(d.id)).map((d) => ({ ...d, name: TV_NAMES[d.id] || d.name })), ...ADDED];
export const BY_ID: Record<string, IndicatorDef> = Object.fromEntries(INDICATORS.map((d) => [d.id, d]));

// TradingView standard indicators not here yet, and why (shown in the picker).
export const COMING: { name: string; why: string }[] = [
  { name: "Price target", why: "needs analyst estimates, which no free source offers" },
  { name: "Rob Booker — Ziv ghost pivots", why: "formula not published" },
];

export function defaults(id: string): Record<string, unknown> {
  const def = BY_ID[id];
  return Object.fromEntries((def?.inputs || []).map((i) => [i.key, i.default]));
}

export function compute(id: string, bars: Bar[], params: Record<string, unknown> = {}, ctx?: CalcContext): IndicatorResult {
  const def = BY_ID[id];
  if (!def) throw new Error(`Unknown indicator: ${id}`);
  const res = def.calc(bars, { ...defaults(id), ...params }, (qt as unknown as { ta: unknown }).ta, ctx);
  // Indices (NIFTY, SENSEX) have no traded volume, so volume indicators have nothing to show.
  const outs = def.outputs.filter((o) => !o.hiddenByDefault);
  if (!res.error && bars.length && outs.length && !bars.some((b) => b.volume) && outs.every((o) => !(res[o.key] as number[] | undefined)?.some(Number.isFinite)))
    return { ...res, error: "No volume data for this symbol (indices have none)" };
  return res;
}
