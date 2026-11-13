// The scanner's brain: the metrics you can filter on, the pre-built scans, and how a scan is run.
// Everything runs in the browser on the snapshot from /api/snapshot, so changing a filter is instant.
import type { FinRow, HoldingRow, StockRow } from "./data";
import { hiveKey } from "./user";

// A scanner row is the price snapshot joined (on ticker) with the company's financials and promoter holding when we have them.
export type ScanRow = StockRow & { fin?: FinRow | null; hold?: HoldingRow | null; finLatest?: boolean };

export type Metric = { key: string; label: string; group: string; unit: string; get: (r: ScanRow) => number | null; hint?: string; signed?: boolean };
// Metrics that need the fundamentals / shareholding feeds rather than prices.
export const isFundamental = (m?: Metric) => m?.group === "Fundamentals" || m?.group === "Shareholding";

const pct = (a: number | null, b: number | null) => (a != null && b ? (a / b - 1) * 100 : null);

export const METRICS: Metric[] = [
  { key: "ret1D", label: "Return 1D", group: "Returns", unit: "%", get: (r) => r.ret["1D"] },
  { key: "ret1W", label: "Return 1W", group: "Returns", unit: "%", get: (r) => r.ret["1W"] },
  { key: "ret1M", label: "Return 1M", group: "Returns", unit: "%", get: (r) => r.ret["1M"] },
  { key: "ret3M", label: "Return 3M", group: "Returns", unit: "%", get: (r) => r.ret["3M"] },
  { key: "ret6M", label: "Return 6M", group: "Returns", unit: "%", get: (r) => r.ret["6M"] },
  { key: "ret1Y", label: "Return 1Y", group: "Returns", unit: "%", get: (r) => r.ret["1Y"] },
  { key: "alpha1W", label: "ΔRet N500 1W", group: "Vs Nifty 500", unit: "%", get: (r) => r.rel["1W"], hint: "Stock return minus Nifty 500 return" },
  { key: "alpha1M", label: "ΔRet N500 1M", group: "Vs Nifty 500", unit: "%", get: (r) => r.rel["1M"] },
  { key: "alpha3M", label: "ΔRet N500 3M", group: "Vs Nifty 500", unit: "%", get: (r) => r.rel["3M"] },
  { key: "alpha6M", label: "ΔRet N500 6M", group: "Vs Nifty 500", unit: "%", get: (r) => r.rel["6M"] },
  { key: "alpha1Y", label: "ΔRet N500 1Y", group: "Vs Nifty 500", unit: "%", get: (r) => r.rel["1Y"] },
  { key: "close", label: "Close", group: "Price", unit: "₹", get: (r) => r.close },
  { key: "vsSma50", label: "Close vs SMA 50D", group: "Trend", unit: "%", get: (r) => pct(r.close, r.sma50), hint: "% above (+) or below (−) the 50-day average" },
  { key: "vsSma200", label: "Close vs SMA 200D", group: "Trend", unit: "%", get: (r) => pct(r.close, r.sma200) },
  { key: "sma50v200", label: "SMA 50D vs SMA 200D", group: "Trend", unit: "%", get: (r) => pct(r.sma50, r.sma200), hint: "Above 0 means the 50-day is over the 200-day (stage 2 uptrend)" },
  { key: "golden", label: "Bars since Golden Cross", group: "Trend", unit: "bars", get: (r) => r.goldenAgo, hint: "Days since the 50-day average crossed above the 200-day (blank if it hasn't in 60 days)" },
  { key: "rsi", label: "RSI 14D", group: "Momentum", unit: "", get: (r) => r.rsi },
  { key: "gap52h", label: "52WH Gap %", group: "Range", unit: "%", get: (r) => r.gap52h, hint: "How far below the 52-week high" },
  { key: "gap26h", label: "26WH Gap %", group: "Range", unit: "%", get: (r) => r.gap26h },
  { key: "gap52l", label: "Above 52W Low %", group: "Range", unit: "%", get: (r) => r.gap52l },
  { key: "brk52", label: "52W Breakout (1 = yes)", group: "Range", unit: "", get: (r) => (r.brk52 ? 1 : 0), hint: "Closed above the highest high of the previous 52 weeks" },
  { key: "brk26", label: "26W Breakout (1 = yes)", group: "Range", unit: "", get: (r) => (r.brk26 ? 1 : 0) },
  { key: "vol", label: "Volume", group: "Volume", unit: "shares", get: (r) => r.vol },
  { key: "volx20", label: "Volume ÷ 20D avg", group: "Volume", unit: "×", get: (r) => (r.vol20 ? r.vol / r.vol20 : null) },
  { key: "vol10x50", label: "Vol SMA 10D ÷ 50D", group: "Volume", unit: "×", get: (r) => (r.vol10 && r.vol50 ? r.vol10 / r.vol50 : null), hint: "Recent volume surge" },
  { key: "valueCr", label: "Avg traded value 20D", group: "Volume", unit: "₹ Cr", get: (r) => r.valueCr },
  // Company financials (Yahoo, via /api/financials). Quarterly growth only counts for companies that have filed the newest quarter.
  { key: "sales", label: "Sales, latest quarter", group: "Fundamentals", unit: "₹ Cr", get: (r) => r.fin?.rev ?? null },
  { key: "profit", label: "Net profit, latest quarter", group: "Fundamentals", unit: "₹ Cr", get: (r) => r.fin?.ni ?? null },
  { key: "salesQoQ", label: "Sales growth QoQ", group: "Fundamentals", unit: "%", signed: true, get: (r) => (r.finLatest ? r.fin?.revQoQ ?? null : null), hint: "Latest quarter vs the one before. Only for companies that have filed the newest quarter" },
  { key: "salesYoY", label: "Sales growth YoY", group: "Fundamentals", unit: "%", signed: true, get: (r) => (r.finLatest ? r.fin?.revYoY ?? null : null), hint: "vs the same quarter last year. Missing for about half of companies (the data source holds only five quarters)" },
  { key: "profitQoQ", label: "Profit growth QoQ", group: "Fundamentals", unit: "%", signed: true, get: (r) => (r.finLatest ? r.fin?.niQoQ ?? null : null), hint: "Blank when the earlier quarter was a loss" },
  { key: "profitYoY", label: "Profit growth YoY", group: "Fundamentals", unit: "%", signed: true, get: (r) => (r.finLatest ? r.fin?.niYoY ?? null : null) },
  { key: "turnaround", label: "Turnaround (1 = yes)", group: "Fundamentals", unit: "", get: (r) => (r.finLatest && r.fin ? (r.fin.turnaround ? 1 : 0) : null), hint: "Profit this quarter after a loss last quarter or a year ago" },
  { key: "opm", label: "Operating margin", group: "Fundamentals", unit: "%", get: (r) => r.fin?.opm ?? null, hint: "Operating income as % of sales, latest quarter" },
  { key: "npm", label: "Net profit margin", group: "Fundamentals", unit: "%", get: (r) => r.fin?.npm ?? null },
  { key: "salesG1", label: "Sales growth, last FY", group: "Fundamentals", unit: "%", signed: true, get: (r) => r.fin?.revG1 ?? null },
  { key: "profitG1", label: "Profit growth, last FY", group: "Fundamentals", unit: "%", signed: true, get: (r) => r.fin?.niG1 ?? null },
  { key: "salesG3", label: "Sales growth, 3Y a year", group: "Fundamentals", unit: "%", signed: true, get: (r) => r.fin?.revG3 ?? null, hint: "Compound yearly growth over three financial years" },
  { key: "profitG3", label: "Profit growth, 3Y a year", group: "Fundamentals", unit: "%", signed: true, get: (r) => r.fin?.niG3 ?? null },
  { key: "epsG3", label: "EPS growth, 3Y a year", group: "Fundamentals", unit: "%", signed: true, get: (r) => r.fin?.epsG3 ?? null },
  { key: "roce", label: "ROCE", group: "Fundamentals", unit: "%", get: (r) => r.fin?.roce ?? null, hint: "EBIT / (total assets - current liabilities), last financial year. Blank for banks and lenders" },
  { key: "roe", label: "ROE", group: "Fundamentals", unit: "%", get: (r) => r.fin?.roe ?? null, hint: "Net profit / shareholders' equity, last financial year" },
  { key: "de", label: "Debt to equity", group: "Fundamentals", unit: "×", get: (r) => r.fin?.de ?? null, hint: "Blank for banks and lenders" },
  { key: "swing", label: "Sales swing over 100% (1 = yes)", group: "Fundamentals", unit: "", get: (r) => (r.fin ? (r.fin.jump ? 1 : 0) : null), hint: "Flags a merger, demerger or restated quarter. Use = 0 to leave them out" },
  // Promoter holding from NSE's quarterly shareholding filings.
  { key: "promoter", label: "Promoter holding", group: "Shareholding", unit: "%", get: (r) => r.hold?.promoter ?? null },
  { key: "promoterChg", label: "Promoter holding change vs last quarter", group: "Shareholding", unit: "pts", signed: true, get: (r) => r.hold?.chg ?? null, hint: "Percentage points. Above 0 means promoters bought" },
  { key: "promoterChgY", label: "Promoter holding change vs a year ago", group: "Shareholding", unit: "pts", signed: true, get: (r) => r.hold?.chgYoY ?? null },
];
export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<string, Metric>;

export const OPS = [">=", "<=", ">", "<", "="] as const;
export type Op = (typeof OPS)[number];
export type Condition = { metric: string; op: Op; value: number };
export type Scan = { id: string; name: string; group: string; blurb: string; conds: Condition[] };

const c = (metric: string, op: Op, value: number): Condition => ({ metric, op, value });

export const PREBUILT: Scan[] = [
  { id: "long-breakout", name: "Long Term Breakout", group: "Breakouts", blurb: "Closed above the highest high of the previous 52 weeks, on at least average volume.", conds: [c("brk52", "=", 1), c("volx20", ">=", 1), c("valueCr", ">=", 2)] },
  { id: "short-breakout", name: "Short Term Breakout", group: "Breakouts", blurb: "Closed above the highest high of the previous 26 weeks, still within 15% of the 52-week high.", conds: [c("brk26", "=", 1), c("gap52h", "<=", 15), c("valueCr", ">=", 2)] },
  { id: "near-high", name: "Near 52 Week High", group: "Breakouts", blurb: "Within 3% of the 52-week high with an uptrend intact.", conds: [c("gap52h", "<=", 3), c("vsSma50", ">", 0), c("valueCr", ">=", 5)] },
  { id: "smart-4", name: "4% Smart Money Entering", group: "Volume", blurb: "Up 4% or more in a session, price over ₹50, volume of at least 1 lakh shares.", conds: [c("ret1D", ">=", 4), c("close", ">=", 50), c("vol", ">=", 100000)] },
  { id: "movers", name: "Movers & Shakers", group: "Volume", blurb: "Daily price movers: up 3% or more on real traded value.", conds: [c("ret1D", ">=", 3), c("valueCr", ">=", 5)] },
  { id: "early-volume", name: "Early Volume Signs", group: "Volume", blurb: "Volume picking up (10-day over 50-day average), a positive week, and beating the market.", conds: [c("vol10x50", ">=", 1.5), c("ret1W", ">=", 3), c("alpha1W", ">", 0), c("valueCr", ">=", 2)] },
  { id: "volume-rocket", name: "Volume Rocketing", group: "Volume", blurb: "Volume at least double its 50-day average, with a strong month behind it.", conds: [c("vol10x50", ">=", 2), c("ret1M", ">=", 10), c("valueCr", ">=", 2)] },
  { id: "early-stage2", name: "Early Stage 2", group: "Trend", blurb: "50-day average crossed above the 200-day in the last 30 bars and price is holding over the 50-day.", conds: [c("golden", "<=", 30), c("vsSma50", ">", 0)] },
  { id: "stage2-leaders", name: "Stage 2 Leaders", group: "Trend", blurb: "Price > 50D > 200D, within 15% of the 52-week high, RSI over 55 and beating the Nifty 500 over 3 months.", conds: [c("vsSma50", ">", 0), c("sma50v200", ">", 0), c("gap52h", "<=", 15), c("rsi", ">", 55), c("alpha3M", ">", 0)] },
  { id: "momentum-surge", name: "Momentum Surge", group: "Trend", blurb: "RSI above 65, 5% over the 50-day average, and a month ahead of the Nifty 500.", conds: [c("rsi", ">=", 65), c("vsSma50", ">=", 5), c("alpha1M", ">=", 5)] },
  { id: "consolidators", name: "The Consolidators", group: "Trend", blurb: "Flat to slightly negative for six months while still in the long-term uptrend.", conds: [c("ret6M", ">=", -10), c("ret6M", "<=", 5), c("vsSma200", ">", 0)] },
  { id: "outperf-3m", name: "Index Outperformance 3 Months", group: "Relative performance", blurb: "Beating the Nifty 500 by 20 points or more over 3 months.", conds: [c("alpha3M", ">=", 20)] },
  { id: "outperf-1y", name: "Index Outperformance 1 Year", group: "Relative performance", blurb: "Beating the Nifty 500 by 60 points or more over 1 year.", conds: [c("alpha1Y", ">=", 60)] },
  { id: "alpha-leaders", name: "Alpha Leaders", group: "Relative performance", blurb: "Beating the Nifty 500 by 20 points over 6 months, with RSI over 60.", conds: [c("alpha6M", ">=", 20), c("rsi", ">=", 60)] },
  { id: "oversold-bounce", name: "Oversold Bounce", group: "Reversals", blurb: "RSI at or under 35 after a 1%+ up day.", conds: [c("rsi", "<=", 35), c("ret1D", ">=", 1), c("valueCr", ">=", 2)] },
  { id: "bombed-out", name: "Bombed Out", group: "Reversals", blurb: "40% or more below the 52-week high on real traded value.", conds: [c("gap52h", ">=", 40), c("valueCr", ">=", 5)] },
  // Fundamentals (need /api/financials) and prices plus fundamentals together.
  { id: "early-growth", name: "Early Growth", group: "Fundamentals", blurb: "Sales and profit both growing quarter on quarter, profit up 20% or more, with a ROCE of 15% or better.", conds: [c("salesQoQ", ">=", 5), c("profitQoQ", ">=", 20), c("roce", ">=", 15)] },
  { id: "profit-jump", name: "Profit Jump", group: "Fundamentals", blurb: "Profit up 25% or more on the last quarter, and a real profit (over ₹1 crore). Mergers and restated quarters left out.", conds: [c("profitQoQ", ">=", 25), c("profit", ">", 1), c("swing", "=", 0)] },
  { id: "turnarounds", name: "Turnarounds", group: "Fundamentals", blurb: "A profit this quarter after a loss in the quarter before or a year ago.", conds: [c("turnaround", "=", 1), c("profit", ">", 1)] },
  { id: "compounders", name: "Quality Compounders", group: "Fundamentals", blurb: "ROCE 20% or more, debt to equity 0.5 or less, profit compounding at 15% or more over three years.", conds: [c("roce", ">=", 20), c("de", "<=", 0.5), c("profitG3", ">=", 15)] },
  { id: "debt-free", name: "Debt-free, High ROCE", group: "Fundamentals", blurb: "Debt to equity 0.1 or less and ROCE 20% or more.", conds: [c("de", "<=", 0.1), c("roce", ">=", 20)] },
  { id: "fast-growers", name: "3-Year Fast Growers", group: "Fundamentals", blurb: "Sales and profit each growing 20% a year or more over three years.", conds: [c("salesG3", ">=", 20), c("profitG3", ">=", 20)] },
  { id: "promoters-buying", name: "Promoters Buying", group: "Fundamentals", blurb: "Promoter holding up 0.5 points or more on the last quarter.", conds: [c("promoterChg", ">=", 0.5)] },
  { id: "stage2-quality", name: "Stage 2 + Quality", group: "Technical + fundamentals", blurb: "Price over the 50-day over the 200-day, within 15% of the 52-week high, with a ROCE over 20%.", conds: [c("vsSma50", ">", 0), c("sma50v200", ">", 0), c("gap52h", "<=", 15), c("roce", ">=", 20)] },
  { id: "breakout-earnings", name: "Breakout + Earnings Growth", group: "Technical + fundamentals", blurb: "A 26-week breakout from a company whose profit grew 10% or more on the last quarter.", conds: [c("brk26", "=", 1), c("profitQoQ", ">=", 10), c("valueCr", ">=", 2)] },
  { id: "growth-leaders", name: "Growth Leaders", group: "Technical + fundamentals", blurb: "Beating the Nifty 500 by 10 points over 3 months, profit growing 20% a year over three years, and ROCE over 15%.", conds: [c("alpha3M", ">=", 10), c("profitG3", ">=", 20), c("roce", ">=", 15)] },
];

// What StockScans has that ChartHive still can't scan on, and why.
export const NEEDS_FEED = ["Heavy Capex: no free capex data", "Margin Mavericks: needs several quarters of margins", "Insider buying: NSE's insider-trade feed has stopped updating", "FII / DII holding changes: NSE's feed only splits promoter and public"];

export function check(v: number | null, op: Op, x: number) {
  if (v == null || !Number.isFinite(v)) return false;
  return op === ">=" ? v >= x : op === "<=" ? v <= x : op === ">" ? v > x : op === "<" ? v < x : v === x;
}
export const matches = (r: ScanRow, conds: Condition[]) => conds.every((k) => check(METRIC[k.metric]?.get(r) ?? null, k.op, k.value));
export const runScan = (rows: ScanRow[], conds: Condition[]) => rows.filter((r) => matches(r, conds));

export const UNIVERSES = [
  ["NIFTY50", "Nifty 50", 1],
  ["NIFTY100", "Nifty 100", 2],
  ["NIFTY200", "Nifty 200", 3],
  ["NIFTY500", "Nifty 500", 4],
] as const;
export const inUniverse = (r: StockRow, u: string) => r.tier <= (UNIVERSES.find((x) => x[0] === u)?.[2] ?? 4);

export const describe = (k: Condition) => {
  const m = METRIC[k.metric];
  return `${m?.label ?? k.metric} ${k.op} ${k.value}${m?.unit === "%" ? "%" : ""}`;
};

// Join prices with financials and holdings. A company counts as "latest" when it has filed the newest quarter anyone has.
export function joinRows(rows: StockRow[], fin: FinRow[] | null, hold: HoldingRow[] | null): ScanRow[] {
  if (!fin && !hold) return rows;
  const f = new Map((fin ?? []).map((x) => [x.s, x]));
  const h = new Map((hold ?? []).map((x) => [x.symbol, x]));
  const latest = (fin ?? []).reduce((m, x) => Math.max(m, x.qDate), 0);
  return rows.map((r) => {
    const x = f.get(r.s) ?? null;
    return { ...r, fin: x, hold: h.get(r.s) ?? null, finLatest: x ? x.qDate === latest : false };
  });
}

// How a metric's value reads in a results column.
export function fmtMetric(m: Metric, v: number | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  const n = Math.abs(v) >= 1000 ? v.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : v.toFixed(m.unit === "×" ? 2 : 1);
  const sign = m.signed && v > 0 ? "+" : "";
  return m.unit === "%" ? `${sign}${n}%` : m.unit === "pts" ? `${sign}${n} pts` : n;
}

// ---------- saved custom scans (this browser) ----------
const KEY = "chart-hive.scans.v1";
export function loadSaved(): Scan[] {
  try {
    return JSON.parse(localStorage.getItem(hiveKey(KEY)) || "[]");
  } catch {
    return [];
  }
}
export function saveSaved(list: Scan[]) {
  try {
    localStorage.setItem(hiveKey(KEY), JSON.stringify(list));
  } catch {
    /* storage blocked */
  }
}

export function toCsv(rows: ScanRow[], extra: Metric[] = []) {
  const head = ["Symbol", "Company", "Industry", "Close", "Ret 1D %", "Ret 1W %", "Ret 1M %", "Ret 3M %", "Ret 6M %", "Ret 1Y %", "RSI 14", "52WH gap %", "Avg value 20D Cr", ...extra.map((m) => `${m.label}${m.unit ? ` (${m.unit})` : ""}`)];
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [head.join(","), ...rows.map((r) => [r.s, r.name, r.industry, r.close, r.ret["1D"], r.ret["1W"], r.ret["1M"], r.ret["3M"], r.ret["6M"], r.ret["1Y"], r.rsi, r.gap52h, r.valueCr, ...extra.map((m) => m.get(r))].map(q).join(","))].join("\n");
}
