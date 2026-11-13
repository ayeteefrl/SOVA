// Typed doors into the indicator registry and the series engine (plain JS shared with the data server).
import * as ind from "./indicators.js";
import * as ser from "./series.js";
import type { Bar } from "../data";

export type { InputDef, OutputDef, IndicatorDef, IndicatorResult, FillDef, CalcContext } from "../indicators/types";
export { INDICATORS, BY_ID, COMING, compute, defaults } from "../indicators/registry";
export type Marker = { time: number; position: "aboveBar" | "belowBar" | "inBar"; shape: "arrowUp" | "arrowDown" | "circle" | "square"; color: string; text?: string };

export const periodKey = ind.periodKey as unknown as (t: number, period: string) => string;

export const parseTf = ser.parseTf as unknown as (tf: string) => { n: number; unit: string; seconds: number };
export const isIntraday = ser.isIntraday as unknown as (tf: string) => boolean;
type Transform = (bars: Bar[]) => (Bar & { color?: string })[];
export const heikinAshi = ser.heikinAshi as unknown as Transform;
export const renko = ser.renko as unknown as Transform;
export const lineBreak = ser.lineBreak as unknown as Transform;
export const rangeBars = ser.rangeBars as unknown as Transform;
export const kagi = ser.kagi as unknown as Transform;
export const pointFigure = ser.pointFigure as unknown as Transform;
