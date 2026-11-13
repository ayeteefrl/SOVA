// The indicator format: Quant Terminal's (inputs, outputs, calc) plus what TradingView's
// standard library draws: plot styles, fills, backgrounds, bar colours, boxes, lines, labels, tables.
import type { Bar } from "../data";

export type InputType = "int" | "float" | "select" | "source" | "time" | "bool" | "color" | "symbol" | "text" | "ltf" | "breadth";

export type InputDef = {
  key: string;
  label: string;
  type: InputType;
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  group?: string; // heading in the settings dialog
};

// line: plain; step: step line; circles/cross: markers only; area: filled to the scale's bottom;
// columns/histogram: bars from zero (histogram uses the `colors` result for per-bar colours).
export type PlotStyle = "line" | "step" | "circles" | "cross" | "area" | "columns";

export type OutputDef = {
  key: string;
  label: string;
  kind: "line" | "histogram";
  color: string;
  lineWidth?: number;
  dots?: boolean;
  plot?: PlotStyle;
  hiddenByDefault?: boolean;
};

// Fill between two outputs, an output and a level, or two levels.
// from/to: an output key, or "level:70". With upColor/downColor the colour follows which side is on top.
export type FillDef = {
  id: string;
  label: string;
  from: string;
  to: string;
  color?: string;
  upColor?: string;
  downColor?: string;
  // Only where `from` is above (or below) `to`, e.g. RSI above 70.
  clip?: "above" | "below";
  // Vertical gradient between two prices (TradingView's RSI overbought/oversold fills).
  gradient?: { top: number; bottom: number; topColor: string; bottomColor: string };
  hiddenByDefault?: boolean;
};

export type Box = { t1: number; t2: number; top: number; bottom: number; color: string; border?: string; text?: string; textColor?: string; extendRight?: boolean };
export type Segment = { t1: number; p1: number; t2: number; p2: number; color: string; width?: number; style?: 0 | 1 | 2; extendRight?: boolean; extendLeft?: boolean; label?: string };
export type Label = { time: number; price: number; text: string; color: string; textColor?: string; position?: "above" | "below" | "center"; size?: number };
export type Table = { position: "top_right" | "top_left" | "bottom_right" | "bottom_left" | "middle_right"; rows: (string | { text: string; color?: string; bg?: string })[][]; size?: number };

export type IndicatorResult = Record<string, unknown> & {
  markers?: { time: number; position: "aboveBar" | "belowBar" | "inBar"; shape: "arrowUp" | "arrowDown" | "circle" | "square"; color: string; text?: string }[];
  colors?: string[]; // histogram colours per bar
  breaks?: boolean[];
  bg?: (string | null)[]; // background colour per bar
  barColors?: (string | null)[]; // candle colour per bar
  boxes?: Box[];
  segments?: Segment[];
  labels?: Label[];
  table?: Table;
  extendBars?: number;
  volumeProfile?: Record<string, unknown>;
  sessionProfile?: Record<string, unknown>;
  error?: string;
  pending?: boolean;
};

export type CalcContext = {
  tf: string; // chart timeframe
  tfSeconds: number;
  symbol: string;
  visible?: { from: number; to: number }; // visible bar indexes, for "visible range" indicators
  tick?: number; // the symbol's minimum price move
};

export type IndicatorDef = {
  id: string;
  name: string;
  group: string;
  overlay?: boolean;
  inputs: InputDef[];
  outputs: OutputDef[];
  levels?: number[];
  fills?: FillDef[];
  noAutoscale?: boolean;
  volumeFormat?: boolean;
  percentFormat?: boolean;
  // Recompute when the visible range changes (visible average price, auto fib...).
  usesVisibleRange?: boolean;
  description?: string;
  tv?: string; // TradingView's name for it, when ours differs
  calc: (bars: Bar[], p: Record<string, unknown>, ta: unknown, ctx?: CalcContext) => IndicatorResult;
};
