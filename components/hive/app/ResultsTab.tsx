"use client";
// Company results and fundamentals: latest quarter's sales / profit with growth, plus annual growth, ROCE and debt.
import { useEffect, useMemo, useState } from "react";
import { api, type FinRow, type FinSnapshot } from "@/lib/hive/data";
import { toWatchlist, useOpenChart } from "@/lib/hive/useSnapshot";
import { ErrorBox, Loading, num } from "./AppShell";
import { IST, card } from "./filingsKit";

type Ready = Extract<FinSnapshot, { loading: false }>;
type Num = number | null;
type Key = keyof FinRow;
type Rule = (r: FinRow) => boolean;

const gt = (v: Num, min: number) => v != null && v >= min;
const lt = (v: Num, max: number) => v != null && v <= max;

// Ready-made screens, in the spirit of the technical ones on the Scanner page.
// `latest: true` screens only count companies that have reported the newest quarter, so a stale quarter never shows as news.
const PRESETS: { id: string; label: string; hint: string; test: Rule; sort?: Key; latest?: boolean }[] = [
  { id: "all", label: "All companies", hint: "Everything in the Nifty 500", test: () => true, sort: "ni" },
  { id: "profit", label: "Profit jump", hint: "Quarterly profit up 25% or more on the last quarter, and profitable", test: (r) => gt(r.niQoQ, 25) && gt(r.ni, 0.1), sort: "niQoQ", latest: true },
  { id: "both", label: "Sales & profit rising", hint: "Sales and profit both up on the last quarter and on a year ago (when a year-ago quarter is available)", test: (r) => gt(r.revQoQ, 0.1) && gt(r.niQoQ, 0.1) && (r.revYoY == null || r.revYoY > 0) && (r.niYoY == null || r.niYoY > 0), sort: "niQoQ", latest: true },
  { id: "turn", label: "Turnarounds", hint: "Made a profit this quarter after a loss in the quarter before or a year ago", test: (r) => r.turnaround, sort: "ni", latest: true },
  { id: "compound", label: "Quality compounders", hint: "ROCE 20% or more, debt to equity 0.5 or less, profit growing 15% a year over three years", test: (r) => gt(r.roce, 20) && lt(r.de, 0.5) && gt(r.niG3, 15), sort: "niG3" },
  { id: "growth3", label: "3-year fast growers", hint: "Sales and profit each growing 20% a year or more over three years", test: (r) => gt(r.revG3, 20) && gt(r.niG3, 20), sort: "niG3" },
  { id: "debtfree", label: "Debt-free, high ROCE", hint: "Debt to equity 0.1 or less and ROCE 20% or more", test: (r) => lt(r.de, 0.1) && gt(r.roce, 20), sort: "roce" },
  { id: "roe", label: "High ROE", hint: "Return on equity 20% or more", test: (r) => gt(r.roe, 20), sort: "roe" },
  { id: "fall", label: "Earnings falling", hint: "Quarterly profit down 25% or more on the last quarter", test: (r) => r.niQoQ != null && r.niQoQ <= -25, sort: "niQoQ", latest: true },
];

type Col = { key: Key; label: string; kind: "pct" | "ratio" | "money" | "plain"; hint?: string }; // pct = growth (signed, coloured), ratio = a level like margin or ROCE
const COLS: Col[] = [
  { key: "rev", label: "Sales ₹ cr", kind: "money", hint: "Latest quarter" },
  { key: "revQoQ", label: "QoQ", kind: "pct", hint: "Sales growth vs the previous quarter" },
  { key: "revYoY", label: "YoY", kind: "pct", hint: "Sales growth vs the same quarter last year (blank when that quarter isn't available)" },
  { key: "ni", label: "Profit ₹ cr", kind: "money", hint: "Net profit, latest quarter" },
  { key: "niQoQ", label: "QoQ", kind: "pct", hint: "Profit growth vs the previous quarter (blank when the base was a loss)" },
  { key: "niYoY", label: "YoY", kind: "pct", hint: "Profit growth vs the same quarter last year" },
  { key: "npm", label: "Net margin", kind: "ratio", hint: "Net profit as % of sales" },
  { key: "revG3", label: "Sales 3Y", kind: "pct", hint: "Yearly compound growth over 3 years (annual figures)" },
  { key: "niG3", label: "Profit 3Y", kind: "pct", hint: "Yearly compound growth over 3 years (annual figures)" },
  { key: "roce", label: "ROCE", kind: "ratio", hint: "EBIT / (total assets - current liabilities), last financial year. Not shown for banks and lenders" },
  { key: "roe", label: "ROE", kind: "ratio", hint: "Net profit / shareholders' equity, last financial year" },
  { key: "de", label: "Debt/Eq", kind: "plain", hint: "Total debt / shareholders' equity. Not shown for banks and lenders" },
];

const dateLabel = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { timeZone: IST, month: "short", year: "numeric" });

function Pct({ v }: { v: Num }) {
  if (v == null) return <span className="text-hive-muted">—</span>;
  return <span className={v > 0 ? "text-hive-up" : v < 0 ? "text-hive-down" : "text-hive-muted"}>{`${v > 0 ? "+" : ""}${v.toFixed(1)}%`}</span>;
}

export default function ResultsTab() {
  const [state, setState] = useState<{ status: "loading"; done: number; total: number } | { status: "error"; message: string } | { status: "ready"; data: Ready }>({ status: "loading", done: 0, total: 0 });
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await api.financials();
        if (!alive) return;
        if (s.loading) {
          if (s.error) return setState({ status: "error", message: s.error });
          setState({ status: "loading", done: s.done, total: s.total });
          timer = setTimeout(tick, 1500);
        } else setState({ status: "ready", data: s });
      } catch (e) {
        if (alive) setState({ status: "error", message: e instanceof Error ? e.message : "Couldn't reach the data server" });
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  if (state.status === "error") return <ErrorBox message={state.message} />;
  if (state.status === "loading")
    return (
      <div className="h-72">
        <Loading done={state.done} total={state.total} what="company results" />
      </div>
    );
  return <Table data={state.data} />;
}

function Table({ data }: { data: Ready }) {
  const [preset, setPreset] = useState("all");
  const [industry, setIndustry] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "ni", dir: -1 });
  const [notice, setNotice] = useState("");
  const open = useOpenChart();

  const industries = useMemo(() => [...new Set(data.stocks.map((s) => s.industry).filter(Boolean))].sort(), [data]);
  const latest = useMemo(() => data.stocks.reduce((m, s) => Math.max(m, s.qDate), 0), [data]);
  const passes = (p: (typeof PRESETS)[number], r: FinRow) => p.test(r) && (!p.latest || r.qDate === latest);
  const active = PRESETS.find((p) => p.id === preset)!;
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = data.stocks.filter((r) => passes(active, r) && (!industry || r.industry === industry) && (!s || `${r.s} ${r.name}`.toLowerCase().includes(s)));
    return list.sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (sort.key === "s") return String(x).localeCompare(String(y)) * sort.dir;
      const nx = typeof x === "number" ? x : -Infinity, ny = typeof y === "number" ? y : -Infinity;
      return (nx - ny) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, active, industry, q, sort, latest]);

  const choose = (id: string) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id)!;
    setSort({ key: p.sort ?? "ni", dir: id === "fall" ? 1 : -1 });
  };
  const sortBy = (key: Key) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "s" ? 1 : -1 }));
  const inLatest = data.stocks.filter((s) => s.qDate === latest).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.id} className={`btn px-2.5 ${preset === p.id ? "btn-on" : ""}`} title={p.hint} onClick={() => choose(p.id)}>
            {p.label}
            <span className="ml-1.5 text-2xs text-hive-muted">{data.stocks.filter((r) => passes(p, r)).length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-hive-muted">{active.hint}</span>
        <div className="flex-1" />
        <select className="input max-w-[200px]" value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry">
          <option value="">All industries</option>
          {industries.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <input className="input w-48" placeholder="Search company" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn"
          disabled={!rows.length}
          onClick={() => {
            toWatchlist(active.label, rows.map((r) => r.s));
            setNotice(`Added ${rows.length} to a new watchlist "${active.label}". Open it on the Charts page.`);
          }}
        >
          Add all to watchlist
        </button>
      </div>
      {notice && <div className="rounded-lg border border-hive-line bg-hive-panel px-3 py-2 text-[12px] text-hive-up">{notice}</div>}
      <div className={card}>
        <div className="border-b border-hive-line px-3 py-2 text-[12px] text-hive-muted">
          {rows.length.toLocaleString("en-IN")} companies · {inLatest} of {data.count} have reported the quarter ended {dateLabel(latest)} · annual columns use the last financial year
        </div>
        {!rows.length ? (
          <div className="p-8 text-center text-hive-muted">No companies match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-hive-panel text-2xs uppercase tracking-wide text-hive-muted">
                <tr>
                  <th className="cursor-pointer select-none px-3 py-2 text-left font-medium hover:text-hive-text" onClick={() => sortBy("s")}>
                    Stock{sort.key === "s" ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Quarter</th>
                  {COLS.map((c, i) => (
                    <th key={c.key} title={c.hint} className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 text-right font-medium hover:text-hive-text ${i === 3 || i === 7 ? "border-l border-hive-line" : ""}`} onClick={() => sortBy(c.key)}>
                      {c.label}
                      {sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hive-line">
                {rows.slice(0, 500).map((r) => (
                  <tr key={r.s} className="hover:bg-hive-hover">
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <button className="font-semibold text-hive-accent hover:underline" onClick={() => open(r.s)}>{r.s}</button>
                      {r.jump && (
                        <span className="ml-1 cursor-help text-amber-500" title="A swing of over 100% in sales usually means a merger, demerger or restated quarter, not organic growth">⚠</span>
                      )}
                      <span className="ml-2 text-hive-muted">{r.name}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-hive-muted">{dateLabel(r.qDate)}</td>
                    {COLS.map((c, i) => (
                      <td key={c.key} className={`tabular whitespace-nowrap px-3 py-1.5 text-right ${i === 3 || i === 7 ? "border-l border-hive-line" : ""}`}>
                        {c.kind === "pct" ? <Pct v={r[c.key] as Num} /> : c.kind === "ratio" ? (r[c.key] == null ? <span className="text-hive-muted">—</span> : `${num(r[c.key] as Num, 1)}%`) : c.kind === "money" ? num(r[c.key] as Num, 1) : num(r[c.key] as Num, 2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-2xs text-hive-muted">
        Figures come from Yahoo&apos;s company financials (consolidated where available), not straight from the filings, so a number can differ slightly from the filed headline: revenue is the main sales line and profit is what belongs to shareholders (Britannia shows 5,541.6 where the filing&apos;s total revenue from operations is 5,597.8).
        Year-on-year needs the same quarter a year ago, which Yahoo only carries for about half of companies. ROCE and debt aren&apos;t shown for banks and lenders. Not investment advice.
      </p>
    </>
  );
}
