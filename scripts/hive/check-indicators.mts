// Runs every indicator on real bars and reports errors, empty outputs and NaN-only outputs.
// Dynamic import: SOVA's package.json isn't "type": "module", so tsx loads lib/hive as CommonJS.
const { INDICATORS, compute } = await import("../../lib/hive/indicators/registry");

import { bars as fetchBars } from "./bars.mts";
const bars = (symbol: string, tf: string) => fetchBars(symbol, tf, 1500);

const sets = { "NSE:NIFTY 1D": await bars("NSE:NIFTY", "1D"), "BINANCE:BTCUSDT 15m": await bars("BINANCE:BTCUSDT", "15m") };
let bad = 0;
for (const [name, b] of Object.entries(sets)) {
  const nifty = sets["NSE:NIFTY 1D"];
  for (const d of INDICATORS) {
    const params: Record<string, unknown> = {};
    for (const i of d.inputs) if (i.type === "symbol") params[`${i.key}__bars`] = b.map((x: { time: number }) => nifty.find((y: { time: number }) => y.time === x.time) || null);
    try {
      const t = performance.now();
      const r = compute(d.id, b, params, { tf: name.split(" ")[1], tfSeconds: name.endsWith("1D") ? 86400 : 900, symbol: name, visible: { from: b.length - 150, to: b.length - 1 } });
      const ms = performance.now() - t;
      const outs = d.outputs.map((o) => [o.key, r[o.key]] as const);
      const empty = outs.filter(([, v]) => !Array.isArray(v) || !(v as number[]).some(Number.isFinite)).map(([k]) => k);
      const extras = ["bg", "barColors", "boxes", "segments", "labels", "table", "markers", "volumeProfile", "sessionProfile"].filter((k) => r[k] && (!Array.isArray(r[k]) || (r[k] as unknown[]).length));
      if (r.error || (empty.length === outs.length && outs.length && !extras.length) || ms > 400) {
        bad++;
        console.log(`${name} | ${d.id} | ${r.error ? "error: " + r.error : empty.length ? "no values: " + empty.join(",") : ""} ${ms > 400 ? `slow ${ms.toFixed(0)}ms` : ""}`);
      } else if (empty.length && !d.outputs.every((o) => o.hiddenByDefault)) console.log(`${name} | ${d.id} | partly empty: ${empty.join(",")}`);
    } catch (e) {
      bad++;
      console.log(`${name} | ${d.id} | THROWS ${(e as Error).message}`);
    }
  }
}
console.log(`${INDICATORS.length} indicators, ${bad} problems`);
