"use client";
// TradingView's strategy tester: overview with the equity curve, performance summary
// (all / long / short) and the list of trades.
import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries, LineSeries, HistogramSeries, type IChartApi, type Time } from "lightweight-charts";
import type { BacktestResult, SideStats, Trade } from "@/lib/hive/strategies/engine";
import { readTheme } from "@/lib/hive/theme";
import { Icon } from "../ui";

export type StrategyReport = { uid: string; name: string; report: BacktestResult };

const money = (v: number, sign = false) => {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "—";
  const s = Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return `${v < 0 ? "−" : sign && v > 0 ? "+" : ""}${s}`;
};
const pct = (v: number, sign = true) => (Number.isFinite(v) ? `${v < 0 ? "−" : sign && v > 0 ? "+" : ""}${Math.abs(v).toFixed(2)}%` : "—");
const tone = (v: number) => (v > 0 ? "text-hive-up" : v < 0 ? "text-hive-down" : "");
// Daily and longer bars sit at 00:00 UTC of their date, so they show the date alone.
const when = (t: number) =>
  t % 86400 === 0
    ? new Date(t * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    : new Date(t * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export default function StrategyTester({ reports, onClose, onSettings }: { reports: StrategyReport[]; onClose: () => void; onSettings: (uid: string) => void }) {
  const [sel, setSel] = useState(reports[0]?.uid);
  const [tab, setTab] = useState<"overview" | "performance" | "trades">("overview");
  const cur = reports.find((r) => r.uid === sel) || reports[0];
  useEffect(() => {
    if (!reports.some((r) => r.uid === sel)) setSel(reports[0]?.uid);
  }, [reports, sel]);
  if (!cur) return null;
  const { stats, props } = cur.report;

  return (
    <div className="flex h-[300px] shrink-0 flex-col border-t border-hive-line bg-hive-panel">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-hive-line px-3">
        <span className="font-semibold">Strategy tester</span>
        {reports.length > 1 ? (
          <select className="input h-7" value={cur.uid} onChange={(e) => setSel(e.target.value)}>
            {reports.map((r) => (
              <option key={r.uid} value={r.uid}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-hive-muted">{cur.name}</span>
        )}
        <button className="icon-btn h-7 w-7" title="Strategy settings" onClick={() => onSettings(cur.uid)}>
          <Icon name="gear" size={15} />
        </button>
        <div className="ml-2 flex">
          {(["overview", "performance", "trades"] as const).map((t) => (
            <button key={t} className={`tab h-10 ${tab === t ? "tab-on" : ""}`} onClick={() => setTab(t)}>
              {t === "overview" ? "Overview" : t === "performance" ? "Performance summary" : "List of trades"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-2xs text-hive-muted">
          Capital {money(props.capital)} · {props.sizeType === "% of equity" ? `${props.size}% of equity` : `${props.size} ${props.sizeType === "Fixed" ? "units" : "cash"}`} · commission {props.commissionPct}%
        </span>
        <button className="icon-btn h-7 w-7" title="Close tester" onClick={onClose}>
          <Icon name="x" size={15} />
        </button>
      </div>
      {cur.report.ruinedAt != null && (
        <div className="shrink-0 bg-hive-down/15 px-3 py-1 text-[12px] text-hive-down">
          The account ran out of money on {when(cur.report.ruinedAt)} and stopped trading. Lower the order size in the strategy&apos;s Properties.
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "overview" && (
          <div className="flex h-full">
            <div className="grid w-[340px] shrink-0 grid-cols-2 content-start gap-x-4 gap-y-3 p-4">
              <Metric label="Net profit" value={money(stats.all.netProfit, true)} sub={pct(stats.netProfitPct)} tone={tone(stats.all.netProfit)} />
              <Metric label="Total closed trades" value={String(stats.all.trades)} />
              <Metric label="Percent profitable" value={pct(stats.all.winRate, false)} sub={`${stats.all.wins} / ${stats.all.trades}`} />
              <Metric label="Profit factor" value={Number.isFinite(stats.all.profitFactor) ? stats.all.profitFactor.toFixed(3) : "∞"} tone={tone(stats.all.profitFactor - 1)} />
              <Metric label="Max drawdown" value={money(stats.maxDrawdown)} sub={pct(stats.maxDrawdownPct)} tone="text-hive-down" />
              <Metric label="Avg trade" value={money(stats.all.avgTrade, true)} tone={tone(stats.all.avgTrade)} />
              <Metric label="Buy & hold return" value={pct(stats.buyHoldPct)} tone={tone(stats.buyHoldPct)} />
              <Metric label="Sharpe ratio" value={stats.sharpe == null ? "—" : stats.sharpe.toFixed(3)} />
            </div>
            <EquityChart report={cur.report} />
          </div>
        )}
        {tab === "performance" && <Performance report={cur.report} />}
        {tab === "trades" && <TradeList trades={cur.report.trades} />}
      </div>
    </div>
  );
}

function Metric({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div>
      <div className="text-2xs text-hive-muted">{label}</div>
      <div className={`tabular text-[15px] font-semibold ${tone}`}>{value}</div>
      {sub && <div className={`tabular text-2xs ${tone || "text-hive-muted"}`}>{sub}</div>}
    </div>
  );
}

function EquityChart({ report }: { report: BacktestResult }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  useEffect(() => {
    const t = readTheme();
    const c = createChart(host.current!, {
      autoSize: true,
      layout: { background: { color: t.bg }, textColor: t.text, fontSize: 10, attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: t.grid } },
      rightPriceScale: { borderColor: t.border },
      timeScale: { borderColor: t.border },
      handleScroll: false,
      handleScale: false,
    });
    chart.current = c;
    return () => c.remove();
  }, []);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    for (const s of [...c.panes().flatMap((p) => p.getSeries())]) c.removeSeries(s);
    const dedupe = <T extends { time: number }>(rows: T[]) => rows.filter((r, i) => i === rows.length - 1 || rows[i + 1].time !== r.time);
    const eq = c.addSeries(AreaSeries, { lineColor: "#2962ff", topColor: "rgba(41,98,255,0.3)", bottomColor: "rgba(41,98,255,0.02)", lineWidth: 2, priceLineVisible: false, title: "Equity" });
    eq.setData(dedupe(report.equity).map((e) => ({ time: e.time as Time, value: e.value })));
    const bh = c.addSeries(LineSeries, { color: "rgba(120,123,134,0.8)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "Buy & hold" });
    bh.setData(dedupe(report.buyHold).map((e) => ({ time: e.time as Time, value: e.value })));
    const dd = c.addSeries(HistogramSeries, { color: "rgba(242,54,69,0.35)", priceScaleId: "dd", priceLineVisible: false, lastValueVisible: false });
    c.priceScale("dd").applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
    dd.setData(dedupe(report.equity).map((e) => ({ time: e.time as Time, value: e.drawdown })));
    c.timeScale().fitContent();
  }, [report]);
  return <div ref={host} className="h-full min-w-0 flex-1" />;
}

function Performance({ report }: { report: BacktestResult }) {
  const { stats } = report;
  const rows: [string, (s: SideStats) => string, ((s: SideStats) => number)?][] = [
    ["Net profit", (s) => money(s.netProfit, true), (s) => s.netProfit],
    ["Gross profit", (s) => money(s.grossProfit), () => 1],
    ["Gross loss", (s) => money(-s.grossLoss), () => -1],
    ["Profit factor", (s) => (Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(3) : "∞")],
    ["Commission paid", (s) => money(s.commission)],
    ["Total closed trades", (s) => String(s.trades)],
    ["Number winning trades", (s) => String(s.wins)],
    ["Number losing trades", (s) => String(s.losses)],
    ["Percent profitable", (s) => pct(s.winRate, false)],
    ["Avg trade", (s) => money(s.avgTrade, true), (s) => s.avgTrade],
    ["Avg winning trade", (s) => money(s.avgWin), () => 1],
    ["Avg losing trade", (s) => money(-s.avgLoss), () => -1],
    ["Ratio avg win / avg loss", (s) => s.ratioAvgWinLoss.toFixed(3)],
    ["Largest winning trade", (s) => money(s.largestWin), () => 1],
    ["Largest losing trade", (s) => money(s.largestLoss), () => -1],
    ["Avg # bars in trades", (s) => s.avgBars.toFixed(0)],
  ];
  return (
    <table className="tabular w-full text-[12px]">
      <thead className="sticky top-0 bg-hive-panel text-hive-muted">
        <tr>
          <th className="px-4 py-2 text-left font-normal">Title</th>
          <th className="px-4 py-2 text-right font-normal">All</th>
          <th className="px-4 py-2 text-right font-normal">Long</th>
          <th className="px-4 py-2 text-right font-normal">Short</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([title, f, t]) => (
          <tr key={title} className="border-t border-hive-line">
            <td className="px-4 py-1.5">{title}</td>
            {[stats.all, stats.long, stats.short].map((s, i) => (
              <td key={i} className={`px-4 py-1.5 text-right ${t ? tone(t(s)) : ""}`}>
                {f(s)}
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t border-hive-line">
          <td className="px-4 py-1.5">Max drawdown</td>
          <td className="px-4 py-1.5 text-right text-hive-down" colSpan={3}>
            {money(stats.maxDrawdown)} ({pct(stats.maxDrawdownPct)})
          </td>
        </tr>
        <tr className="border-t border-hive-line">
          <td className="px-4 py-1.5">Sharpe / Sortino ratio (monthly)</td>
          <td className="px-4 py-1.5 text-right" colSpan={3}>
            {stats.sharpe == null ? "—" : stats.sharpe.toFixed(3)} / {stats.sortino == null ? "—" : stats.sortino.toFixed(3)}
          </td>
        </tr>
        <tr className="border-t border-hive-line">
          <td className="px-4 py-1.5">Open P&amp;L</td>
          <td className={`px-4 py-1.5 text-right ${tone(stats.openPL)}`} colSpan={3}>
            {money(stats.openPL, true)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function TradeList({ trades }: { trades: Trade[] }) {
  const download = () => {
    const head = "Trade #,Type,Signal,Date/Time,Price,Contracts,Profit,Profit %,Cum. profit,Run-up,Drawdown\n";
    const rows = trades.flatMap((t) => [
      `${t.n},Exit ${t.dir},${t.exitId},${new Date(t.exitTime * 1000).toISOString()},${t.exitPrice},${t.qty},${t.profit.toFixed(2)},${t.profitPct.toFixed(2)},${t.cumProfit.toFixed(2)},${t.runUp.toFixed(2)},${t.drawdown.toFixed(2)}`,
      `${t.n},Entry ${t.dir},${t.entryId},${new Date(t.entryTime * 1000).toISOString()},${t.entryPrice},${t.qty},,,,,`,
    ]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([head + rows.join("\n")], { type: "text/csv" }));
    a.download = "trades.csv";
    a.click();
  };
  return (
    <table className="tabular w-full text-[12px]">
      <thead className="sticky top-0 z-10 bg-hive-panel text-hive-muted">
        <tr>
          {["Trade #", "Type", "Signal", "Date/Time", "Price", "Contracts", "Profit", "Cum. profit", "Run-up", "Drawdown"].map((h) => (
            <th key={h} className="px-3 py-2 text-left font-normal">
              {h}
            </th>
          ))}
          <th className="px-3 py-2 text-right font-normal">
            <button className="text-hive-accent hover:underline" onClick={download}>
              Export CSV
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {[...trades].reverse().map((t) => (
          <tr key={t.n} className="border-t border-hive-line align-top">
            <td className="px-3 py-1.5">{t.n}</td>
            <td className="px-3 py-1.5">
              <div className={t.dir === "long" ? "text-hive-accent" : "text-hive-down"}>{t.open ? "Open" : "Exit"} {t.dir}</div>
              <div className="text-hive-muted">Entry {t.dir}</div>
            </td>
            <td className="px-3 py-1.5">
              <div>{t.exitId}</div>
              <div className="text-hive-muted">{t.entryId}</div>
            </td>
            <td className="px-3 py-1.5">
              <div>{when(t.exitTime)}</div>
              <div className="text-hive-muted">{when(t.entryTime)}</div>
            </td>
            <td className="px-3 py-1.5">
              <div>{money(t.exitPrice)}</div>
              <div className="text-hive-muted">{money(t.entryPrice)}</div>
            </td>
            <td className="px-3 py-1.5">{t.qty.toLocaleString("en-IN")}</td>
            <td className={`px-3 py-1.5 ${tone(t.profit)}`}>
              <div>{money(t.profit, true)}</div>
              <div>{pct(t.profitPct)}</div>
            </td>
            <td className={`px-3 py-1.5 ${tone(t.cumProfit)}`}>{money(t.cumProfit, true)}</td>
            <td className="px-3 py-1.5 text-hive-up">{money(t.runUp)}</td>
            <td className="px-3 py-1.5 text-hive-down">{money(t.drawdown)}</td>
            <td />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
