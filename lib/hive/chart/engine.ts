// One chart: price series, volume, indicators (own panes or overlaid), drawings and live updates.
// Framework-free; the React component feeds it config and renders the legend it reports.
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type ISeriesMarkersPluginApi,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import { api, stream, fmtPrice, type Bar, type BarsResponse, type BreadthRow } from "../data";
import {
  BY_ID,
  compute,
  periodKey,
  parseTf,
  isIntraday,
  heikinAshi,
  renko,
  lineBreak,
  rangeBars,
  kagi,
  pointFigure,
  type IndicatorResult,
  type Marker,
  type CalcContext,
} from "../engine";
import type { PlotStyle } from "../indicators/types";
import type { BacktestResult } from "../strategies/engine";
import { VolumeProfile, SessionVolumeProfile } from "./volume-profile.js";
import { IndicatorOverlay } from "./indicator-overlay";
import { withAlpha } from "../drawings/geom";
import { DrawingLayer } from "../drawings/layer";
import { TOOL_BY_ID, newDrawing } from "../drawings/registry";
import { CURSORS, isPointer, type Drawing, type Pt, type XY } from "../drawings/types";

export const CHART_TYPES: [string, string][] = [
  ["candles", "Candles"],
  ["hollow", "Hollow candles"],
  ["bars", "Bars"],
  ["heikin", "Heikin Ashi"],
  ["line", "Line"],
  ["linemarkers", "Line with markers"],
  ["step", "Step line"],
  ["area", "Area"],
  ["baseline", "Baseline"],
  ["columns", "Columns"],
  ["renko", "Renko"],
  ["linebreak", "Line break"],
  ["range", "Range"],
  ["kagi", "Kagi"],
  ["pnf", "Point & figure"],
];
const PRICE_ONLY = ["renko", "linebreak", "kagi", "pnf"];
const SIMPLE = ["candles", "hollow", "bars", "line", "linemarkers", "step", "area", "baseline", "columns"];

export type OutputStyle = { color?: string; width?: number; visible?: boolean; style?: 0 | 1 | 2; plot?: PlotStyle };
export type IndicatorInstance = {
  uid: string;
  id: string;
  params: Record<string, unknown>;
  styles?: Record<string, OutputStyle>;
  fills?: Record<string, { visible?: boolean; color?: string; upColor?: string; downColor?: string }>;
  levels?: { value: number; color: string; visible: boolean }[];
  hidden?: boolean;
  tf?: string;
};
export type ChartConfig = {
  symbol: string;
  tf: string;
  type: string;
  indicators: IndicatorInstance[];
  log?: boolean;
  percent?: boolean;
};
export type LegendRow = { uid: string; name: string; params: string; values: { color: string; text: string }[]; error?: string; pending?: boolean; hidden?: boolean };
export type LegendState = {
  symbol: string;
  name?: string;
  exchange?: string;
  tf: string;
  provider?: string;
  bar?: Bar;
  prev?: Bar;
  rows: LegendRow[];
  notes: string[];
  loading: boolean;
  error?: string;
};
export type Theme = { bg: string; text: string; grid: string; border: string; up: string; down: string; accent: string; muted: string };
export type Magnet = "off" | "weak" | "strong";

export type EngineCallbacks = {
  onLegend: (s: LegendState) => void;
  onLoaded?: (r: BarsResponse) => void;
  onDrawingsChange: (symbol: string, items: Drawing[]) => void;
  onSelectDrawing: (d: Drawing | null) => void;
  onToolDone: () => void;
  onEditDrawing: (d: Drawing) => void;
  onPrice?: (symbol: string, bar: Bar) => void;
  onStrategies?: (list: { uid: string; name: string; report: BacktestResult }[]) => void;
};

const CLEAR = "rgba(0,0,0,0)";
const LINE_STYLES = [LineStyle.Solid, LineStyle.Dashed, LineStyle.Dotted];

// A line can't skip a gap: hide it by making the point before the gap transparent.
function lineData(vals: number[], breaks: boolean[] | undefined, timeAt: (i: number) => number, n: number, colors?: (string | null)[]) {
  const out: { time: Time; value?: number; color?: string }[] = [];
  const next = new Array(vals.length);
  let nv = NaN;
  for (let i = vals.length - 1; i >= 0; i--) {
    if (Number.isFinite(vals[i])) nv = vals[i];
    next[i] = nv;
  }
  let started = false;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i],
      time = timeAt(i) as Time;
    if (!Number.isFinite(v)) {
      if (i >= n) continue;
      out.push(started && Number.isFinite(next[i]) ? { time, value: next[i], color: CLEAR } : { time });
      continue;
    }
    started = true;
    const gapAhead = i + 1 < vals.length && (!Number.isFinite(vals[i + 1]) || breaks?.[i + 1]);
    out.push(gapAhead ? { time, value: v, color: CLEAR } : colors?.[i] ? { time, value: v, color: colors[i]! } : { time, value: v });
  }
  return out;
}
function histData(vals: number[], colors: (string | null)[] | undefined, timeAt: (i: number) => number, n: number) {
  const out: { time: Time; value?: number; color?: string }[] = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (i >= n && !Number.isFinite(v)) continue;
    if (!Number.isFinite(v)) out.push({ time: timeAt(i) as Time });
    else out.push(colors?.[i] ? { time: timeAt(i) as Time, value: v, color: colors[i]! } : { time: timeAt(i) as Time, value: v });
  }
  return out;
}
// Higher-timeframe values onto chart bars without look-ahead (the newest one still forming).
function mapToChart(res: IndicatorResult, hb: Bar[], htf: string, cb: Bar[], ctf: string) {
  const hSec = parseTf(htf).seconds,
    cSec = parseTf(ctf).seconds;
  const end = (j: number) => (j + 1 < hb.length ? hb[j + 1].time : hb[j].time + hSec);
  const idx = new Array(cb.length).fill(-1);
  let j = -1;
  for (let i = 0; i < cb.length; i++) {
    const cEnd = cb[i].time + cSec;
    while (j + 1 < hb.length && end(j + 1) <= cEnd) j++;
    idx[i] = j + 1 === hb.length - 1 && cb[i].time >= hb[hb.length - 1].time ? hb.length - 1 : j;
  }
  const out: IndicatorResult = {};
  for (const [k, v] of Object.entries(res)) {
    if (k === "markers") continue;
    out[k] = Array.isArray(v) && v.length >= hb.length ? idx.map((x) => (x >= 0 ? v[x] : NaN)) : v;
  }
  return out;
}

export class ChartEngine {
  chart: IChartApi;
  cfg: ChartConfig;
  bars: Bar[] = [];
  shown: (Bar & { color?: string })[] = [];
  times: number[] = [];
  provider = "";
  meta: BarsResponse["meta"] = {};
  notes: string[] = [];
  drawings: DrawingLayer;
  tool = "cursor";
  magnet: Magnet = "off";
  keepDrawing = false;
  lockAll = false;
  private main!: ISeriesApi<SeriesType>;
  private volume: ISeriesApi<SeriesType> | null = null;
  private markers!: ISeriesMarkersPluginApi<Time>;
  private mainType = "";
  private indSeries = new Map<string, ISeriesApi<SeriesType>[]>();
  private indResults: Record<string, IndicatorResult> = {};
  private vpPrims: VolumeProfile[] = [];
  private mtf: Record<string, { bars?: Bar[]; error?: string; at: number }> = {};
  private mtfLoading: Record<string, boolean> = {};
  private symData: Record<string, { data?: unknown; error?: string; at: number }> = {};
  private mainOverlays: IndicatorOverlay[] = [];
  private barColors: (string | null)[] | null = null;
  private rangeSub: (() => void) | null = null;
  private rangeTimer: ReturnType<typeof setTimeout> | undefined;
  private loadToken = {};
  private unsubLive: (() => void) | null = null;
  private lastFull = 0;
  private legendIndex: number | null = null;
  private loading = false;
  private error = "";
  private drag: { id: string; anchor: number; start: Pt; orig: Pt[] } | null = null;
  private freehand: Drawing | null = null;
  private downAt: XY | null = null;
  private lastXY: XY | null = null; // where the mouse is over the plot, or null when it's elsewhere
  private destroyed = false;
  private listeners = new AbortController();

  constructor(
    private el: HTMLElement,
    cfg: ChartConfig,
    private theme: Theme,
    private cb: EngineCallbacks,
  ) {
    this.cfg = { ...cfg, indicators: [...cfg.indicators] };
    this.chart = createChart(el, {
      autoSize: true,
      ...this.themeOptions(),
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { rightOffset: 8, timeVisible: true, secondsVisible: false, borderColor: theme.border },
      localization: { priceFormatter: (p: number) => this.fmt(p) },
    });
    this.chart.subscribeCrosshairMove((p) => this.onCrosshair(p));
    this.drawings = new DrawingLayer({
      toXY: (p) => this.toXY(p),
      toPt: (xy) => this.toPt(xy),
      fmtPrice: (v) => this.fmt(v),
      fmtTime: (t) => this.fmtTime(t),
      barsBetween: (a, b) => Math.round((this.logicalOf(b) ?? 0) - (this.logicalOf(a) ?? 0)),
      volumeBetween: (a, b) => {
        const lo = Math.min(a, b),
          hi = Math.max(a, b);
        let v = 0,
          any = false;
        for (const x of this.bars) if (x.time >= lo && x.time <= hi && x.volume) (v += x.volume), (any = true);
        return any ? v : null;
      },
      bars: () => this.shown,
      indexOf: (t) => this.logicalOf(t),
      timeAt: (l) => this.timeOfLogical(l),
      xAt: (l) => this.chart.timeScale().logicalToCoordinate(l as never),
      yAt: (p) => this.main.priceToCoordinate(p),
      priceAt: (y) => this.main.coordinateToPrice(y),
      tf: () => this.cfg.tf,
    });
    this.makeMainSeries();
    this.bindPointer();
    // Images in drawings load in the background and ask for a repaint when ready.
    this.onRedraw = () => this.drawings.update();
    window.addEventListener("terminal:redraw", this.onRedraw);
  }
  private onRedraw: () => void;

  // ---------- setup ----------
  private themeOptions() {
    const t = this.theme;
    return {
      layout: {
        background: { color: t.bg },
        textColor: t.text,
        fontSize: 11,
        fontFamily: "Inter, system-ui, sans-serif",
        attributionLogo: true,
        panes: { separatorColor: t.border, separatorHoverColor: t.accent, enableResize: true },
      },
      grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border },
    };
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.chart.applyOptions(this.themeOptions());
    this.mainType = "";
    this.render(false);
  }

  private makeMainSeries() {
    for (const vp of this.vpPrims) this.main?.detachPrimitive(vp as never);
    this.vpPrims = [];
    if (this.main) {
      this.main.detachPrimitive(this.drawings as never);
      this.chart.removeSeries(this.main);
    }
    if (this.volume) {
      this.chart.removeSeries(this.volume);
      this.volume = null;
    }
    const { up, down, accent } = this.theme;
    const t = this.cfg.type;
    const common = { priceLineVisible: true, lastValueVisible: true };
    if (t === "bars") this.main = this.chart.addSeries(BarSeries, { ...common, upColor: up, downColor: down });
    else if (["line", "linemarkers", "step", "kagi"].includes(t))
      this.main = this.chart.addSeries(LineSeries, { ...common, color: accent, lineWidth: 2, lineType: t === "step" || t === "kagi" ? 1 : 0, pointMarkersVisible: t === "linemarkers" });
    else if (t === "area") this.main = this.chart.addSeries(AreaSeries, { ...common, lineColor: accent, topColor: "rgba(41,98,255,0.35)", bottomColor: "rgba(41,98,255,0.02)", lineWidth: 2 });
    else if (t === "baseline")
      this.main = this.chart.addSeries(BaselineSeries, {
        ...common,
        topLineColor: up,
        bottomLineColor: down,
        topFillColor1: "rgba(8,153,129,0.25)",
        topFillColor2: "rgba(8,153,129,0.02)",
        bottomFillColor1: "rgba(242,54,69,0.02)",
        bottomFillColor2: "rgba(242,54,69,0.25)",
      });
    else if (t === "columns") this.main = this.chart.addSeries(HistogramSeries, { ...common });
    else if (t === "hollow")
      this.main = this.chart.addSeries(CandlestickSeries, { ...common, upColor: CLEAR, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down, borderVisible: true });
    else this.main = this.chart.addSeries(CandlestickSeries, { ...common, upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down });
    this.main.attachPrimitive(this.drawings as never);
    this.markers = createSeriesMarkers(this.main, []);
    this.mainType = t;
    if (!PRICE_ONLY.includes(t)) {
      this.volume = this.chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      this.chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    }
  }

  // ---------- time and price mapping ----------
  // Intraday bars are shown in the browser's time zone (IST in India); daily bars by their date.
  get shift() {
    return isIntraday(this.cfg.tf) ? -new Date().getTimezoneOffset() * 60 : 0;
  }
  get step() {
    return this.times.length > 1 ? this.times[this.times.length - 1] - this.times[this.times.length - 2] : parseTf(this.cfg.tf).seconds;
  }
  logicalOf(utc: number): number | null {
    const T = this.times,
      t = utc + this.shift,
      n = T.length;
    if (!n) return null;
    if (t <= T[0]) return (t - T[0]) / this.step;
    if (t >= T[n - 1]) return n - 1 + (t - T[n - 1]) / this.step;
    let lo = 0,
      hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (T[m] <= t) lo = m;
      else hi = m;
    }
    return lo + (t - T[lo]) / (T[hi] - T[lo]);
  }
  timeOfLogical(l: number): number | null {
    const T = this.times,
      n = T.length;
    if (!n) return null;
    let t: number;
    if (l <= 0) t = T[0] + l * this.step;
    else if (l >= n - 1) t = T[n - 1] + (l - (n - 1)) * this.step;
    else {
      const i = Math.floor(l);
      t = T[i] + (l - i) * (T[i + 1] - T[i]);
    }
    return t - this.shift;
  }
  toXY(p: Pt): XY | null {
    const l = this.logicalOf(p.time);
    if (l == null) return null;
    const x = this.chart.timeScale().logicalToCoordinate(l as never);
    const y = this.main.priceToCoordinate(p.price);
    return x == null || y == null ? null : { x, y };
  }
  toPt(xy: XY): Pt | null {
    const l = this.chart.timeScale().coordinateToLogical(xy.x);
    const price = this.main.coordinateToPrice(xy.y);
    if (l == null || price == null) return null;
    const time = this.timeOfLogical(l);
    return time == null ? null : { time, price };
  }
  fmt(v: number) {
    const tick = this.meta?.tick;
    if (tick && tick > 0) {
      const d = Math.max(0, Math.min(8, Math.round(-Math.log10(tick)) + (tick.toString().includes("5") ? 1 : 0)));
      return fmtPrice(v, Math.max(2, Math.min(d, 4)));
    }
    return fmtPrice(v);
  }
  fmtTime(t: number) {
    const d = new Date(t * 1000);
    return isIntraday(this.cfg.tf)
      ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  }

  // ---------- data ----------
  async load({ keepView = false } = {}) {
    const token = (this.loadToken = {});
    this.stopLive();
    this.loading = true;
    this.error = "";
    this.emitLegend();
    try {
      const r = await api.bars(this.cfg.symbol, this.cfg.tf, 3000);
      if (token !== this.loadToken || this.destroyed) return;
      this.cfg.symbol = r.symbol;
      this.provider = r.provider;
      this.meta = r.meta || {};
      this.notes = r.notes || [];
      this.bars = r.candles;
      this.mtf = {};
      this.loading = false;
      this.render(!keepView);
      this.startLive();
      this.cb.onLoaded?.(r);
    } catch (e) {
      if (token !== this.loadToken || this.destroyed) return;
      this.bars = [];
      this.loading = false;
      this.error = (e as Error).message;
      this.render(true);
    }
  }

  private visibleBars() {
    const raw = this.bars;
    switch (this.cfg.type) {
      case "heikin":
        return heikinAshi(raw);
      case "renko":
        return renko(raw);
      case "linebreak":
        return lineBreak(raw);
      case "range":
        return rangeBars(raw);
      case "kagi":
        return kagi(raw);
      case "pnf":
        return pointFigure(raw);
      default:
        return raw;
    }
  }

  private pointFor(b: Bar & { color?: string }, i = -1) {
    const time = (b.time + this.shift) as Time;
    const bc = i >= 0 ? this.barColors?.[i] : null;
    if (bc && !["line", "linemarkers", "step", "area", "baseline", "kagi", "columns"].includes(this.mainType))
      return { time, open: b.open, high: b.high, low: b.low, close: b.close, color: bc, wickColor: bc, borderColor: bc };
    switch (this.mainType) {
      case "line":
      case "linemarkers":
      case "step":
      case "area":
      case "baseline":
        return { time, value: b.close };
      case "kagi":
        return { time, value: b.close, color: b.color };
      case "columns":
        return { time, value: b.close, color: b.close >= b.open ? this.theme.up : this.theme.down };
      default:
        return { time, open: b.open, high: b.high, low: b.low, close: b.close };
    }
  }
  private volPoint(b: Bar) {
    return { time: (b.time + this.shift) as Time, value: b.volume || 0, color: b.close >= b.open ? "rgba(8,153,129,0.45)" : "rgba(242,54,69,0.45)" };
  }

  render(resetView: boolean) {
    if (this.destroyed) return;
    const prevRange = this.chart.timeScale().getVisibleLogicalRange();
    const prevLen = this.shown.length;
    const atEnd = prevRange && this.shown.length && prevRange.to >= this.shown.length - 3;
    if (this.mainType !== this.cfg.type) this.makeMainSeries();
    this.shown = this.visibleBars();
    this.times = this.shown.map((b) => b.time + this.shift);
    const last = this.shown[this.shown.length - 1]?.close || 1;
    const tick = this.meta?.tick;
    const precision = tick ? Math.max(2, Math.min(4, Math.ceil(-Math.log10(tick)))) : last >= 100 ? 2 : last >= 1 ? 4 : last >= 0.01 ? 6 : 8;
    this.main.applyOptions({ priceFormat: { type: "price", precision, minMove: tick || 1 / 10 ** precision } });
    if (this.cfg.type === "baseline" && this.shown.length)
      this.main.applyOptions({ baseValue: { type: "price", price: this.shown[Math.max(0, this.shown.length - 150)].close } } as never);
    this.main.setData(this.shown.map((b, i) => this.pointFor(b, i)) as never);
    this.volume?.setData(this.shown.map((b) => this.volPoint(b)));
    this.chart.applyOptions({ timeScale: { timeVisible: isIntraday(this.cfg.tf), secondsVisible: parseTf(this.cfg.tf).seconds < 60 } });
    this.chart.priceScale("right").applyOptions({
      mode: this.cfg.percent ? PriceScaleMode.Percentage : this.cfg.log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
    this.renderIndicators();
    this.drawings.update();
    if (resetView && this.shown.length) this.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, this.shown.length - 160), to: this.shown.length + 8 });
    else if (!resetView && this.shown.length && atEnd && prevRange && this.shown.length !== prevLen) {
      // Following the latest bar: slide the window along by however many bars were added, keeping the same zoom and margin.
      const add = this.shown.length - prevLen;
      this.chart.timeScale().setVisibleLogicalRange({ from: prevRange.from + add, to: prevRange.to + add });
    }
    this.emitLegend();
  }

  // ---------- indicators ----------
  private calcContext(): CalcContext {
    const r = this.chart.timeScale().getVisibleLogicalRange();
    return {
      tf: this.cfg.tf,
      tfSeconds: parseTf(this.cfg.tf).seconds,
      symbol: this.cfg.symbol,
      tick: this.meta?.tick,
      visible: r ? { from: Math.max(0, Math.floor(r.from)), to: Math.min(this.shown.length - 1, Math.ceil(r.to)) } : undefined,
    };
  }

  // Inputs of type "symbol" (Relative Strength vs NIFTY, correlation): that symbol's bars on this
  // timeframe, lined up with the chart's bars (the latest one at or before each bar's time).
  // Inputs that need other data: "symbol" (Relative Strength vs NIFTY, correlation) gets that symbol's
  // bars lined up with the chart's; "ltf" (volume delta) gets this symbol's lower-timeframe bars grouped
  // under each chart bar; "breadth" (advance/decline) gets the index's advancing/declining counts per bar.
  private withSymbolInputs(ind: IndicatorInstance, bars: Bar[]): Record<string, unknown> | { pending: true } | { error: string } {
    const def = BY_ID[ind.id];
    const params: Record<string, unknown> = { ...ind.params };
    const align = <T extends { time: number }>(other: T[]) => {
      const out: (T | null)[] = [];
      let j = 0;
      for (const b of bars) {
        while (j + 1 < other.length && other[j + 1].time <= b.time) j++;
        out.push(other[j] && other[j].time <= b.time ? other[j] : null);
      }
      return out;
    };
    for (const inp of def.inputs) {
      if (inp.type === "symbol") {
        const sym = String(params[inp.key] ?? inp.default ?? "");
        if (!sym) continue;
        const h = this.external(`bars|${sym}|${this.cfg.tf}`, () => api.bars(sym, this.cfg.tf, 3000).then((r) => r.candles));
        if (!h) return { pending: true };
        if (h.error) return { error: `${sym}: ${h.error}` };
        params[`${inp.key}__bars`] = align(h.data as Bar[]);
      } else if (inp.type === "ltf") {
        const ltf = autoLtf(String(params[inp.key] ?? inp.default ?? "Auto"), this.cfg.tf);
        if (!ltf) return { error: "Pick a lower timeframe than the chart's" };
        const h = this.external(`bars|${this.cfg.symbol}|${ltf}`, () => api.bars(this.cfg.symbol, ltf, 5000).then((r) => r.candles));
        if (!h) return { pending: true };
        if (h.error) return { error: h.error };
        // Each chart bar gets the lower-timeframe bars from its open up to the next bar's open.
        const sub = h.data as Bar[];
        const groups: Bar[][] = bars.map(() => []);
        let j = 0;
        for (let i = 0; i < bars.length; i++) {
          const end = i + 1 < bars.length ? bars[i + 1].time : Infinity;
          while (j < sub.length && sub[j].time < bars[i].time) j++;
          while (j < sub.length && sub[j].time < end) groups[i].push(sub[j++]);
        }
        params[`${inp.key}__groups`] = groups;
        params[`${inp.key}__tf`] = ltf;
      } else if (inp.type === "breadth") {
        const uni = String(params[inp.key] ?? inp.default ?? "NIFTY50");
        const h = this.external(`breadth|${uni}|${this.cfg.tf}`, () => api.breadth(uni, this.cfg.tf).then((r) => r.rows));
        if (!h) return { pending: true };
        if (h.error) return { error: h.error };
        const rows = h.data as BreadthRow[];
        const byTime = new Map(rows.map((r) => [r.time, r]));
        params[`${inp.key}__rows`] = bars.map((b) => byTime.get(b.time) || null);
      }
    }
    return params;
  }

  // Extra data for indicators, loaded once per key and kept until the chart reloads.
  private external(key: string, load: () => Promise<unknown>) {
    const h = this.symData[key];
    if (h) return h;
    if (!this.mtfLoading[key]) {
      this.mtfLoading[key] = true;
      load()
        .then((data) => (this.symData[key] = { data, at: Date.now() }))
        .catch((e) => (this.symData[key] = { error: (e as Error).message, at: Date.now() }))
        .finally(() => {
          delete this.mtfLoading[key];
          this.render(false);
        });
    }
    return null;
  }

  private computeIndicator(ind: IndicatorInstance, bars: Bar[]): IndicatorResult {
    const prepared = this.withSymbolInputs(ind, bars);
    if ("pending" in prepared || "error" in prepared) return prepared as IndicatorResult;
    ind = { ...ind, params: prepared };
    const ctx = this.calcContext();
    const src = String(ind.params?.source || "");
    if (ind.tf && ind.tf !== this.cfg.tf) {
      const h = this.mtf[ind.tf];
      if (!h) {
        this.loadMtf(ind.tf);
        return { pending: true };
      }
      if (h.error) return { error: h.error };
      if (!h.bars?.length) return {};
      const res = compute(ind.id, h.bars, src.startsWith("ind:") ? { ...ind.params, source: "close" } : ind.params, { ...ctx, tf: ind.tf, tfSeconds: parseTf(ind.tf).seconds, visible: undefined });
      return mapToChart(res, h.bars, ind.tf, bars, this.cfg.tf);
    }
    if (src.startsWith("ind:")) {
      const [, uid, key] = src.split(":");
      const vals = this.indResults[uid]?.[key];
      if (!Array.isArray(vals)) return { error: "Its source indicator is missing" };
      const synth = bars.map((x, i) => {
        const v = vals[i] as number;
        return { ...x, open: v, high: v, low: v, close: v };
      });
      return compute(ind.id, synth, { ...ind.params, source: "close" }, ctx);
    }
    return compute(ind.id, bars, ind.params, ctx);
  }

  private async loadMtf(tf: string) {
    if (this.mtfLoading[tf]) return;
    this.mtfLoading[tf] = true;
    try {
      if (parseTf(tf).seconds < parseTf(this.cfg.tf).seconds) throw new Error(`Pick a timeframe at or above the chart's (${this.cfg.tf})`);
      const r = await api.bars(this.cfg.symbol, tf, 2000);
      this.mtf[tf] = { bars: r.candles, at: Date.now() };
    } catch (e) {
      this.mtf[tf] = { error: (e as Error).message, at: Date.now() };
    }
    delete this.mtfLoading[tf];
    this.render(false);
  }

  private renderIndicators() {
    for (const list of this.indSeries.values())
      for (const s of list)
        try {
          this.chart.removeSeries(s);
        } catch {
          /* already gone */
        }
    this.indSeries.clear();
    for (const vp of this.vpPrims)
      try {
        this.main.detachPrimitive(vp as never);
      } catch {
        /* gone */
      }
    this.vpPrims = [];
    for (const o of this.mainOverlays)
      try {
        this.main.detachPrimitive(o as never);
      } catch {
        /* gone */
      }
    this.mainOverlays = [];
    while (this.chart.panes().length > 1) this.chart.removePane(this.chart.panes().length - 1);
    this.indResults = {};
    const bars = this.shown,
      n = bars.length;
    const timeAt = (i: number) => (i < n ? this.times[i] : this.times[n - 1] + (i - n + 1) * this.step);
    const byUid = new Map(this.cfg.indicators.map((x) => [x.uid, x]));
    const depth = (x: IndicatorInstance, seen = new Set<string>()): number => {
      const src = String(x.params?.source || "");
      if (!src.startsWith("ind:") || seen.has(x.uid)) return 0;
      seen.add(x.uid);
      const parent = byUid.get(src.split(":")[1]);
      return parent ? 1 + depth(parent, seen) : 0;
    };
    const ordered = [...this.cfg.indicators].sort((a, b) => depth(a) - depth(b));
    let paneIdx = 0;
    const paneOf: Record<string, number> = {};
    const markers: Marker[] = [];
    let barColors: (string | null)[] | null = null;
    const host = { chart: this.chart, logicalOf: (t: number) => this.logicalOf(t), barCount: () => this.shown.length, fmt: (v: number) => this.fmt(v) };
    for (const ind of ordered) {
      const def = BY_ID[ind.id];
      if (!def) continue;
      let res: IndicatorResult;
      try {
        res = n ? this.computeIndicator(ind, bars) : {};
      } catch (e) {
        res = { error: (e as Error).message };
      }
      this.indResults[ind.uid] = res;
      if (ind.hidden || !n || res.error || res.pending) continue;
      if (res.markers && !ind.tf) markers.push(...res.markers);
      if (res.barColors) barColors = barColors ? barColors.map((c, i) => res.barColors![i] || c) : [...res.barColors];
      if (res.volumeProfile) {
        const vp = new VolumeProfile(this, res.volumeProfile);
        this.main.attachPrimitive(vp as never);
        this.vpPrims.push(vp);
      }
      if (res.sessionProfile) {
        const sp = new SessionVolumeProfile(this, res.sessionProfile) as SessionVolumeProfile & { keyOf?: unknown; tfSeconds?: number };
        sp.keyOf = periodKey;
        sp.tfSeconds = parseTf(this.cfg.tf).seconds;
        this.main.attachPrimitive(sp as never);
        this.vpPrims.push(sp);
      }
      const fills = IndicatorOverlay.resolveFills(def.fills, res, ind.fills);
      const hasOverlay = fills.length || res.bg || res.boxes?.length || res.segments?.length || res.labels?.length || res.table;
      const outs = def.outputs.filter((o) => Array.isArray(res[o.key]));
      const src = String(ind.params?.source || "");
      const parentPane = src.startsWith("ind:") ? paneOf[src.split(":")[1]] : undefined;
      if (!outs.length) {
        // Drawn entirely by the overlay (gaps, auto fib, tables...): on the price pane.
        if (hasOverlay && def.overlay) {
          const o = new IndicatorOverlay(host, res, fills, Boolean(res.bg));
          this.main.attachPrimitive(o as never);
          this.mainOverlays.push(o);
        }
        continue;
      }
      const pane = parentPane !== undefined ? parentPane : def.overlay ? 0 : ++paneIdx;
      paneOf[ind.uid] = pane;
      const list: ISeriesApi<SeriesType>[] = [];
      for (const out of outs) {
        const st = ind.styles?.[out.key] || {};
        if (st.visible === false || (st.visible === undefined && out.hiddenByDefault)) continue;
        const color = st.color || out.color;
        const plot = st.plot || out.plot || (out.dots ? "circles" : out.kind === "histogram" ? "columns" : "line");
        const opts = {
          ...(def.noAutoscale ? { autoscaleInfoProvider: () => null } : {}),
          ...(def.volumeFormat ? { priceFormat: { type: "volume" as const } } : {}),
          color,
          priceLineVisible: false,
          lastValueVisible: pane > 0,
          crosshairMarkerVisible: false,
          title: "",
        };
        const vals = res[out.key] as number[];
        const perBar = (res[`${out.key}Colors`] as string[] | undefined) || (out.kind === "histogram" ? res.colors : undefined);
        let s: ISeriesApi<SeriesType>;
        if (plot === "columns") {
          s = this.chart.addSeries(HistogramSeries, opts, pane);
          s.setData(histData(vals, perBar, timeAt, n) as never);
        } else if (plot === "area") {
          s = this.chart.addSeries(AreaSeries, { ...opts, lineColor: color, topColor: withAlpha(color, 0.3), bottomColor: withAlpha(color, 0.02), lineWidth: (st.width || out.lineWidth || 1) as 1 }, pane);
          s.setData(lineData(vals, res.breaks, timeAt, n) as never);
        } else {
          const markersOnly = plot === "circles" || plot === "cross";
          s = this.chart.addSeries(
            LineSeries,
            {
              ...opts,
              lineWidth: (st.width || out.lineWidth || 1) as 1,
              lineStyle: LINE_STYLES[st.style || 0],
              lineType: plot === "step" ? 1 : 0,
              ...(markersOnly ? { lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: plot === "cross" ? 3 : 1.5 } : {}),
            },
            pane,
          );
          s.setData(lineData(vals, res.breaks, timeAt, n, perBar) as never);
        }
        list.push(s);
      }
      if (parentPane === undefined && list[0]) {
        const levels = ind.levels || (def.levels || []).map((v) => ({ value: v, color: this.theme.muted, visible: true }));
        for (const lv of levels)
          if (lv.visible) list[0].createPriceLine({ price: lv.value, color: lv.color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
      }
      if (hasOverlay) {
        const o = new IndicatorOverlay(host, res, fills, Boolean(res.bg));
        if (pane === 0) {
          this.main.attachPrimitive(o as never);
          this.mainOverlays.push(o);
        } else if (list[0]) list[0].attachPrimitive(o as never);
      }
      this.indSeries.set(ind.uid, list);
    }
    this.chart.panes().forEach((p, i) => p.setStretchFactor(i === 0 ? 1 : 0.3));
    const all = markers.map((m) => ({ ...m, time: (m.time + this.shift) as Time }));
    all.sort((a, b) => (a.time as number) - (b.time as number));
    this.markers.setMarkers(all);
    // Indicators that colour the candles (Bollinger Bars...): repaint the price series with them.
    if (barColors || this.barColors) {
      this.barColors = barColors;
      if (["candles", "hollow", "bars", "heikin"].includes(this.cfg.type)) this.main.setData(this.shown.map((b, i) => this.pointFor(b, i)) as never);
    }
    this.watchVisibleRange();
    // Strategy reports for the tester panel.
    this.cb.onStrategies?.(
      this.cfg.indicators
        .filter((x) => !x.hidden && (this.indResults[x.uid] as { strategy?: unknown })?.strategy)
        .map((x) => ({ uid: x.uid, ...(this.indResults[x.uid] as unknown as { strategy: { name: string; report: BacktestResult } }).strategy })),
    );
  }

  // Recompute "visible range" indicators (visible average price) after scrolling settles.
  private watchVisibleRange() {
    const needs = this.cfg.indicators.some((x) => !x.hidden && BY_ID[x.id]?.usesVisibleRange);
    if (needs && !this.rangeSub) {
      this.rangeSub = () => {
        clearTimeout(this.rangeTimer);
        this.rangeTimer = setTimeout(() => this.renderIndicators(), 150);
      };
      this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.rangeSub);
    } else if (!needs && this.rangeSub) {
      this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.rangeSub);
      this.rangeSub = null;
    }
  }

  // Adding, removing, hiding or editing an indicator redraws only the indicators. The bars, the zoom and
  // where you've scrolled to are left exactly as they were.
  setIndicators(list: IndicatorInstance[]) {
    this.cfg.indicators = list.map((x) => ({ ...x }));
    if (this.destroyed) return;
    const range = this.chart.timeScale().getVisibleLogicalRange();
    this.renderIndicators();
    this.drawings.update();
    if (range) this.chart.timeScale().setVisibleLogicalRange(range);
    this.emitLegend();
  }

  paramsLabel(ind: IndicatorInstance): string {
    const def = BY_ID[ind.id];
    if (!def) return "";
    const nums = (def.inputs || [])
      .filter((x) => !["source", "bool", "color", "text"].includes(x.type) && x.group !== "Properties")
      .map((x) => {
        const v = ind.params?.[x.key] ?? x.default;
        if (x.type !== "time") return v;
        return v ? new Date((v as number) * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "pick a bar";
      })
      .join(" ");
    const src = String(ind.params?.source || "");
    let on = "";
    if (src.startsWith("ind:")) {
      const parent = this.cfg.indicators.find((x) => x.uid === src.split(":")[1]);
      const pd = parent && BY_ID[parent.id];
      on = pd ? ` on ${shortName(pd.name)}` : " on (missing)";
    } else if (src && src !== "close") on = ` ${src}`;
    return `${nums}${on}${ind.tf && ind.tf !== this.cfg.tf ? ` · ${ind.tf}` : ""}`;
  }

  // ---------- legend ----------
  private emitLegend(index: number | null = this.legendIndex) {
    const n = this.shown.length;
    const i = index ?? n - 1;
    const rows: LegendRow[] = this.cfg.indicators.map((ind) => {
      const def = BY_ID[ind.id];
      const res = this.indResults[ind.uid] || {};
      return {
        uid: ind.uid,
        name: def ? shortName(def.name) : ind.id,
        params: this.paramsLabel(ind),
        hidden: ind.hidden,
        error: res.error,
        pending: res.pending,
        values: def
          ? def.outputs
              .filter((o) => ind.styles?.[o.key]?.visible !== false)
              .map((o) => {
                const v = (res[o.key] as number[] | undefined)?.[i];
                return Number.isFinite(v) ? { color: ind.styles?.[o.key]?.color || o.color, text: def.volumeFormat ? compact(v!) : this.fmt(v!) } : null;
              })
              .filter(Boolean) as { color: string; text: string }[]
          : [],
      };
    });
    this.cb.onLegend({
      symbol: this.cfg.symbol,
      name: this.meta?.name,
      exchange: this.meta?.exchange,
      tf: this.cfg.tf,
      provider: this.provider,
      bar: this.shown[i],
      prev: this.shown[i - 1],
      rows,
      notes: this.notes,
      loading: this.loading,
      error: this.error,
    });
  }

  private onCrosshair(p: MouseEventParams) {
    const i = p.logical != null && p.point ? Math.max(0, Math.min(this.shown.length - 1, Math.round(p.logical))) : null;
    this.legendIndex = i;
    this.emitLegend(i);
  }

  // ---------- drawing interaction ----------
  setTool(id: string) {
    this.tool = id;
    this.drawings.temp = null;
    this.drawings.update();
    this.el.style.cursor = isPointer(id) ? CURSORS.find((c) => c.id === id)!.css : "crosshair";
    // The chart's own crosshair: hidden for the arrow, a dot for the dot cursor.
    this.chart.applyOptions({
      crosshair: {
        vertLine: { visible: id !== "arrow" && id !== "dot" },
        horzLine: { visible: id !== "arrow" && id !== "dot" },
      },
    });
  }

  // A drawing hotkey: place the first point right under the mouse. One-click tools (horizontal line...)
  // are finished on the spot; others start there and follow the mouse to the next click.
  // Returns false when the mouse isn't over the chart, so the caller can just pick the tool.
  placeAtCursor(id: string) {
    const def = TOOL_BY_ID[id];
    const xy = this.lastXY;
    if (!def || !xy || def.points === 0) return false;
    const raw = this.toPt(xy);
    if (!raw) return false;
    this.setTool(id);
    this.placePoint(this.snap(xy, raw));
    return true;
  }

  setDrawings(items: Drawing[]) {
    this.drawings.items = items.map((d) => ({ ...d, points: d.points.map((p) => ({ ...p })), props: { ...d.props } }));
    if (!items.some((d) => d.id === this.drawings.selectedId)) this.drawings.selectedId = null;
    this.drawings.update();
  }

  private saveDrawings() {
    this.cb.onDrawingsChange(this.cfg.symbol, this.drawings.items);
  }

  updateDrawing(d: Drawing) {
    this.drawings.items = this.drawings.items.map((x) => (x.id === d.id ? d : x));
    this.drawings.update();
    this.saveDrawings();
  }

  deleteSelected() {
    const sel = this.drawings.selected;
    if (!sel || sel.locked) return false;
    this.drawings.items = this.drawings.items.filter((d) => d.id !== sel.id);
    this.drawings.selectedId = null;
    this.drawings.update();
    this.saveDrawings();
    this.cb.onSelectDrawing(null);
    return true;
  }

  clearDrawings() {
    this.drawings.items = [];
    this.drawings.selectedId = null;
    this.drawings.temp = null;
    this.drawings.update();
    this.saveDrawings();
    this.cb.onSelectDrawing(null);
  }

  cancelPlacement() {
    if (this.drawings.temp) {
      this.drawings.temp = null;
      this.drawings.update();
      return true;
    }
    return false;
  }

  private plotArea() {
    const pane = this.chart.panes()[0];
    return { w: this.chart.timeScale().width(), h: pane ? pane.getHeight() : 0 };
  }

  private local(e: PointerEvent | MouseEvent): XY {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Snap to the nearest open/high/low/close of the bar under the mouse.
  private snap(xy: XY, pt: Pt): Pt {
    if (this.magnet === "off" || !this.shown.length) return pt;
    const l = this.chart.timeScale().coordinateToLogical(xy.x);
    if (l == null) return pt;
    const i = Math.round(l);
    const b = this.shown[i];
    if (!b) return pt;
    let best = pt.price,
      bestD = Infinity;
    for (const v of [b.open, b.high, b.low, b.close]) {
      const y = this.main.priceToCoordinate(v);
      if (y == null) continue;
      const dist = Math.abs(y - xy.y);
      if (dist < bestD) (bestD = dist), (best = v);
    }
    if (this.magnet === "weak" && bestD > 30) return pt;
    return { time: this.timeOfLogical(i) ?? pt.time, price: best };
  }

  private setScroll(on: boolean) {
    this.chart.applyOptions({ handleScroll: on, handleScale: on });
  }

  private bindPointer() {
    const el = this.el;
    const signal = this.listeners.signal;
    const listen = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, capture = false) =>
      el.addEventListener(type, fn, { capture, signal });
    const inPlot = (xy: XY) => {
      const a = this.plotArea();
      return xy.x >= 0 && xy.x <= a.w && xy.y >= 0 && xy.y <= a.h;
    };
    listen(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        const xy = this.local(e);
        this.downAt = xy;
        if (!inPlot(xy)) return;
        const def = TOOL_BY_ID[this.tool];
        // Freehand tools (brush, highlighter) and the demonstration pointer draw while the button is down.
        if (def?.points === 0 || this.tool === "demonstration") {
          const pt = this.toPt(xy);
          if (!pt) return;
          this.setScroll(false);
          this.freehand = newDrawing(def ? def.id : "highlighter", [pt], this.tool === "demonstration" ? { color: "rgba(255,82,82,0.6)", width: 4 } : {});
          this.drawings.temp = this.freehand;
          el.setPointerCapture(e.pointerId);
          e.stopPropagation();
          return;
        }
        if (!isPointer(this.tool)) {
          this.setScroll(false);
          return;
        }
        const sel = this.drawings.selected;
        let anchor = sel && !sel.locked && !this.lockAll ? this.drawings.anchorAt(sel, xy.x, xy.y) : -1;
        const hit = anchor >= 0 ? sel : this.drawings.hitTest(xy.x, xy.y);
        // Grabbing the end of a line that isn't selected yet still stretches it, instead of moving the whole line.
        if (hit && anchor < 0 && !hit.locked && !this.lockAll) anchor = this.drawings.anchorAt(hit, xy.x, xy.y, 10);
        if (hit && this.tool === "eraser") {
          if (!hit.locked && !this.lockAll) {
            this.drawings.items = this.drawings.items.filter((d) => d.id !== hit.id);
            this.drawings.update();
            this.saveDrawings();
          }
          e.stopPropagation();
          return;
        }
        if (hit) {
          this.drawings.selectedId = hit.id;
          this.cb.onSelectDrawing(hit);
          this.drawings.update();
          if (!hit.locked && !this.lockAll) {
            const start = this.toPt(xy);
            if (start) {
              this.drag = { id: hit.id, anchor, start, orig: hit.points.map((p) => ({ ...p })) };
              this.setScroll(false);
              el.setPointerCapture(e.pointerId);
            }
          }
          e.stopPropagation();
        } else if (this.drawings.selectedId) {
          this.drawings.selectedId = null;
          this.cb.onSelectDrawing(null);
          this.drawings.update();
        }
      },
      true,
    );

    // The chart pans on mousedown/touchstart; keep those from it while a drawing is being dragged.
    for (const type of ["mousedown", "touchstart"] as const)
      listen(
        type,
        (e) => {
          if (this.drag || this.freehand) e.stopPropagation();
        },
        true,
      );

    listen("pointerleave", () => (this.lastXY = null));
    listen("pointermove", (e) => {
      const xy = this.local(e);
      this.lastXY = inPlot(xy) ? xy : null;
      if (this.freehand) {
        const last = this.toXY(this.freehand.points[this.freehand.points.length - 1]);
        const pt = this.toPt(xy);
        if (pt && (!last || Math.hypot(last.x - xy.x, last.y - xy.y) > 3)) {
          this.freehand.points.push(pt);
          this.drawings.update();
        }
        return;
      }
      if (this.drag) {
        const d = this.drawings.items.find((x) => x.id === this.drag!.id);
        const now = this.toPt(xy);
        if (!d || !now) return;
        const def = TOOL_BY_ID[d.tool];
        if (this.drag.anchor >= 0) {
          const pts = this.drag.orig.map((p) => ({ ...p }));
          pts[this.drag.anchor] = this.snap(xy, now);
          d.points = def?.constrain ? def.constrain(pts, this.drag.anchor) : pts;
        } else {
          const dt = now.time - this.drag.start.time,
            dp = now.price - this.drag.start.price;
          d.points = this.drag.orig.map((p) => ({ time: p.time + dt, price: p.price + dp }));
        }
        this.drawings.update();
        return;
      }
      const temp = this.drawings.temp;
      if (temp && inPlot(xy)) {
        const pt = this.toPt(xy);
        if (pt) {
          temp.points[temp.points.length - 1] = this.snap(xy, pt);
          this.drawings.update();
        }
        return;
      }
      if (isPointer(this.tool) && inPlot(xy)) {
        const hover = this.drawings.hitTest(xy.x, xy.y);
        const sel = this.drawings.selected;
        const onAnchor = (sel && this.drawings.anchorAt(sel, xy.x, xy.y) >= 0) || (hover && !hover.locked && this.drawings.anchorAt(hover, xy.x, xy.y, 10) >= 0);
        const base = CURSORS.find((c) => c.id === this.tool)?.css || "";
        el.style.cursor = this.tool === "eraser" ? (hover ? "pointer" : base) : onAnchor ? "move" : hover ? "pointer" : base;
        if ((hover?.id || null) !== this.drawings.hoverId) {
          this.drawings.hoverId = hover?.id || null;
          this.drawings.update();
        }
      }
    });

    listen("pointerup", (e) => {
      const xy = this.local(e);
      if (this.freehand) {
        const item = this.freehand;
        this.freehand = null;
        this.setScroll(true);
        if (this.tool === "demonstration") {
          // A demonstration stroke fades away instead of being kept.
          setTimeout(() => {
            if (this.drawings.temp === item) this.drawings.temp = null;
            this.drawings.update();
          }, 1200);
          return;
        }
        this.drawings.temp = null;
        if (item.points.length > 1) this.finish(item);
        else this.drawings.update();
        return;
      }
      if (this.drag) {
        const moved = this.downAt && Math.hypot(xy.x - this.downAt.x, xy.y - this.downAt.y) > 2;
        this.drag = null;
        this.setScroll(true);
        if (moved) this.saveDrawings();
        return;
      }
      if (isPointer(this.tool)) return;
      this.setScroll(true);
      if (!inPlot(xy)) return;
      const raw = this.toPt(xy);
      if (!raw) return;
      this.placePoint(this.snap(xy, raw));
    });

    listen("dblclick", (e) => {
      // Multi-click tools (path, polyline) finish on double-click.
      if (this.drawings.temp && TOOL_BY_ID[this.drawings.temp.tool]?.points === -1) {
        this.commitPlacement();
        return;
      }
      const xy = this.local(e);
      const hit = this.drawings.hitTest(xy.x, xy.y);
      if (hit) this.cb.onEditDrawing(hit);
    });
  }

  // Finish a path or polyline that's being drawn (double-click or Enter).
  commitPlacement() {
    const t = this.drawings.temp;
    if (!t) return false;
    // Drop the floating point that follows the mouse, and duplicates from the double-click.
    const pts = t.points.slice(0, -1).filter((p, i, a) => i === 0 || p.time !== a[i - 1].time || p.price !== a[i - 1].price);
    if (pts.length < 2) {
      this.drawings.temp = null;
      this.drawings.update();
      return true;
    }
    this.finish({ ...t, points: pts });
    return true;
  }

  private placePoint(pt: Pt) {
    const def = TOOL_BY_ID[this.tool];
    if (!def) return;
    const d = this.drawings;
    if (!d.temp) {
      if (def.init) return this.finish(newDrawing(def.id, def.init(pt, this.step)));
      d.temp = newDrawing(def.id, def.points > 1 || def.points === -1 ? [pt, { ...pt }] : [pt]);
      if (def.points === 1) return this.finish(d.temp);
    } else {
      d.temp.points[d.temp.points.length - 1] = pt;
      if (def.points === -1 || d.temp.points.length < def.points) d.temp.points.push({ ...pt });
      else return this.finish(d.temp);
    }
    d.update();
  }

  private finish(item: Drawing) {
    const d = this.drawings;
    d.temp = null;
    d.items.push(item);
    d.selectedId = item.id;
    d.update();
    this.saveDrawings();
    this.cb.onSelectDrawing(item);
    if (TOOL_BY_ID[item.tool]?.editsText) this.cb.onEditDrawing(item);
    if (!this.keepDrawing) this.cb.onToolDone();
  }

  // ---------- live ----------
  private startLive() {
    this.stopLive();
    if (!this.bars.length) return;
    this.unsubLive = stream.subscribeBars(this.cfg.symbol, this.cfg.tf, (b) => this.merge(b));
  }
  private stopLive() {
    this.unsubLive?.();
    this.unsubLive = null;
  }

  private merge(b: Bar) {
    if (!this.bars.length || this.destroyed) return;
    const last = this.bars[this.bars.length - 1];
    if (b.time === last.time) this.bars[this.bars.length - 1] = { ...last, ...b };
    else if (b.time > last.time) this.bars.push(b);
    else return;
    const cur = this.bars[this.bars.length - 1];
    this.cb.onPrice?.(this.cfg.symbol, cur);
    const simple = SIMPLE.includes(this.cfg.type);
    if (simple) {
      this.shown = this.bars;
      const t = cur.time + this.shift;
      if (this.times[this.times.length - 1] !== t) this.times.push(t);
      this.main.update(this.pointFor(cur, this.bars.length - 1) as never);
      this.volume?.update(this.volPoint(cur));
    }
    const now = Date.now();
    if (!simple || now - this.lastFull > 1000) {
      this.lastFull = now;
      if (simple) {
        this.renderIndicators();
        this.emitLegend();
      } else this.render(false);
    } else if (this.legendIndex == null) this.emitLegend();
  }

  // ---------- view ----------
  setRange(preset: string) {
    const n = this.shown.length;
    if (!n) return;
    const lastT = this.shown[n - 1].time;
    const days: Record<string, number> = { "1D": 1, "5D": 5, "1M": 30, "3M": 91, "6M": 182, "1Y": 365, "5Y": 1826 };
    let from: number;
    if (preset === "All") from = 0;
    else if (preset === "YTD") from = Date.UTC(new Date(lastT * 1000).getUTCFullYear(), 0, 1) / 1000;
    else from = lastT - (days[preset] || 30) * 86400;
    const i = Math.max(0, this.shown.findIndex((b) => b.time >= from));
    this.chart.timeScale().setVisibleLogicalRange({ from: i, to: n + 4 });
  }

  resetView() {
    const n = this.shown.length;
    this.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 160), to: n + 8 });
    this.chart.priceScale("right").applyOptions({ autoScale: true });
  }

  screenshot() {
    return this.chart.takeScreenshot();
  }

  // Price under a y pixel (relative to the chart's top), for the right-click menu.
  priceAtY(y: number): number | null {
    const p = this.main?.coordinateToPrice(y);
    return p == null ? null : Number(p);
  }

  destroy() {
    if (this.destroyed) return;
    window.removeEventListener("terminal:redraw", this.onRedraw);
    this.listeners.abort();
    this.destroyed = true;
    this.stopLive();
    this.chart.remove();
  }
}

// "Auto" lower timeframe for intrabar indicators, like TradingView's: 1m up to hourly charts, 5m for
// 2h-4h, 15m for daily, 1h for weekly, 1D for monthly.
function autoLtf(choice: string, chartTf: string) {
  const sec = parseTf(chartTf).seconds;
  const ltf = choice === "Auto" ? (sec <= 3600 ? "1m" : sec < 86400 ? "5m" : sec < 7 * 86400 ? "15m" : sec < 30 * 86400 ? "1h" : "1D") : choice;
  return parseTf(ltf).seconds < sec || (sec <= 60 && ltf === "1m") ? ltf : null;
}

// "Moving average convergence divergence (MACD)" -> "MACD"; names without an abbreviation stay whole.
export function shortName(name: string) {
  const abbr = /\(([^)]+)\)$/.exec(name)?.[1].split(" / ")[0];
  return abbr && /^[A-Z0-9%/ -]{2,12}$/.test(abbr) ? abbr : name;
}
function compact(v: number) {
  const a = Math.abs(v);
  return a >= 1e9 ? (v / 1e9).toFixed(2) + "B" : a >= 1e6 ? (v / 1e6).toFixed(2) + "M" : a >= 1e3 ? (v / 1e3).toFixed(2) + "K" : v.toFixed(2);
}
