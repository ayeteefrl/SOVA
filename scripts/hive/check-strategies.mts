// Runs every built-in strategy on real bars and prints trades, net profit, win rate and drawdown.
// Dynamic import: SOVA's package.json isn't "type": "module", so tsx loads lib/hive as CommonJS.
const { STRATEGY_INDICATORS } = await import("../../lib/hive/strategies/as-indicators");

import { bars as fetchBars } from "./bars.mts";
const bars = (symbol: string, tf: string) => fetchBars(symbol, tf, 2000);
for (const [sym, tf, tick] of [["NSE:RELIANCE", "1D", 0.1], ["BINANCE:BTCUSDT", "1h", 0.01]] as const) {
  const b = await bars(sym, tf);
  console.log(`\n${sym} ${tf}: ${b.length} bars`);
  for (const d of STRATEGY_INDICATORS) {
    try {
      const t = performance.now();
      const r = d.calc(b, Object.fromEntries(d.inputs.map((i) => [i.key, i.default])), null, { tf, tfSeconds: 86400, symbol: sym, tick });
      const rep = (r.strategy as { report: { stats: { all: { trades: number; netProfit: number; winRate: number; profitFactor: number }; maxDrawdownPct: number; netProfitPct: number } } }).report;
      const s = rep.stats;
      console.log(`${d.name.padEnd(38)} trades ${String(s.all.trades).padStart(4)}  net ${s.netProfitPct.toFixed(1).padStart(7)}%  win ${s.all.winRate.toFixed(0).padStart(3)}%  PF ${s.all.profitFactor.toFixed(2).padStart(5)}  maxDD ${s.maxDrawdownPct.toFixed(1)}%  ${(performance.now() - t).toFixed(0)}ms`);
    } catch (e) {
      console.log(`${d.name}: THROWS ${(e as Error).message}`);
    }
  }
}
