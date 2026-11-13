// Strategies go on the chart like indicators (TradingView puts them in the same dialog): their
// inputs plus a Properties group, entry/exit markers on the price pane, and a report for the tester.
import type { IndicatorDef, InputDef } from "../indicators/types";
import { STRATEGIES } from "./defs";
import { DEFAULT_PROPERTIES, runStrategy, type BacktestResult, type Properties } from "./engine";

const PROPERTY_INPUTS: InputDef[] = [
  { key: "capital", label: "Initial capital", type: "float", default: DEFAULT_PROPERTIES.capital, min: 1, step: 1000, group: "Properties" },
  { key: "sizeType", label: "Order size type", type: "select", options: ["% of equity", "Fixed", "Cash"], default: DEFAULT_PROPERTIES.sizeType, group: "Properties" },
  { key: "size", label: "Order size", type: "float", default: DEFAULT_PROPERTIES.size, min: 0, step: 1, group: "Properties" },
  { key: "commissionPct", label: "Commission (%)", type: "float", default: DEFAULT_PROPERTIES.commissionPct, min: 0, step: 0.01, group: "Properties" },
  { key: "slippageTicks", label: "Slippage (ticks)", type: "int", default: DEFAULT_PROPERTIES.slippageTicks, min: 0, group: "Properties" },
  { key: "pyramiding", label: "Pyramiding (orders in one direction)", type: "int", default: DEFAULT_PROPERTIES.pyramiding, min: 1, group: "Properties" },
  { key: "direction", label: "Trade direction", type: "select", options: ["Both", "Long only", "Short only"], default: DEFAULT_PROPERTIES.direction, group: "Properties" },
  { key: "stopLossPct", label: "Stop loss % (0 = off)", type: "float", default: 0, min: 0, step: 0.5, group: "Properties" },
  { key: "takeProfitPct", label: "Take profit % (0 = off)", type: "float", default: 0, min: 0, step: 0.5, group: "Properties" },
];

export const STRATEGY_INDICATORS: IndicatorDef[] = STRATEGIES.map((s) => ({
  id: s.id,
  name: s.name,
  group: "Strategies",
  overlay: true,
  description: s.description,
  inputs: [...s.inputs.map((i) => ({ ...i, group: "Inputs" })), ...PROPERTY_INPUTS],
  outputs: [],
  calc: (bars, p, _ta, ctx) => {
    const props = Object.fromEntries(PROPERTY_INPUTS.map((i) => [i.key, p[i.key] ?? i.default])) as unknown as Properties;
    const onBar = s.setup(bars, p as Record<string, number | string | boolean>);
    const report: BacktestResult = runStrategy(bars, onBar, props, ctx?.tick || 0.01);
    // Entry and exit markers, as TradingView draws them.
    const markers = report.trades.flatMap((t) => {
      const long = t.dir === "long";
      const out = [
        { time: t.entryTime, position: long ? ("belowBar" as const) : ("aboveBar" as const), shape: long ? ("arrowUp" as const) : ("arrowDown" as const), color: long ? "#2962ff" : "#f23645", text: `${t.entryId}\n${long ? "+" : "−"}${fmtQty(t.qty)}` },
      ];
      if (!t.open)
        out.push({ time: t.exitTime, position: long ? "aboveBar" : "belowBar", shape: long ? "arrowDown" : "arrowUp", color: "#9c27b0", text: t.exitId.startsWith("Close") || t.exitId.endsWith("SL/TP") ? t.exitId : `Close ${t.entryId}` });
      return out;
    });
    return { markers, strategy: { name: s.name, report } };
  },
}));

const fmtQty = (q: number) => (q >= 1000 ? `${(q / 1000).toFixed(1)}K` : String(Math.round(q * 1e4) / 1e4));
