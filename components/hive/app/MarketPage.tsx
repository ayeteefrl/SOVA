"use client";
import { useEffect, useMemo, useState } from "react";
import { api, type IndexRow, type Periods, type StockRow } from "@/lib/hive/data";
import { UNIVERSES, inUniverse } from "@/lib/hive/scanner";
import { setState } from "@/lib/hive/store";
import { useOpenChart, useSnapshot } from "@/lib/hive/useSnapshot";
import AppShell, { ErrorBox, Loading, Pct, num } from "./AppShell";
import { useRouter } from "next/navigation";

type P = keyof Periods;
const PERIODS: P[] = ["1D", "1W", "1M", "3M", "6M", "1Y"];
type Mode = "gain" | "lose" | "high" | "low";

export default function MarketPage() {
  const snap = useSnapshot();
  const [idx, setIdx] = useState<IndexRow[] | null>(null);
  const [idxErr, setIdxErr] = useState("");
  useEffect(() => {
    api.indices().then((r) => setIdx(r.rows)).catch((e) => setIdxErr(e.message));
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5 p-5">
        <div>
          <h1 className="text-[19px] font-semibold">Market dashboard</h1>
          <p className="text-hive-muted">Where the market is strong and weak: indices, industries, breadth and the day&apos;s leaders.</p>
        </div>
        {idxErr ? <ErrorBox message={idxErr} /> : !idx ? <div className="h-32 animate-pulse rounded-lg bg-hive-panel" /> : <IndexStrip rows={idx} />}
        {snap.status === "loading" && <div className="h-80"><Loading done={snap.done} total={snap.total} what="the Nifty 500" /></div>}
        {snap.status === "error" && <ErrorBox message={snap.message} />}
        {snap.status === "ready" && <Breadth rows={snap.snap.stocks} />}
        <div className="grid gap-5 xl:grid-cols-2">
          {idx && <IndexTable rows={idx} />}
          {snap.status === "ready" && <Leaders rows={snap.snap.stocks} />}
        </div>
        {snap.status === "ready" && <Industries rows={snap.snap.stocks} />}
      </div>
    </AppShell>
  );
}

const card = "rounded-lg border border-hive-line bg-hive-panel";

function IndexStrip({ rows }: { rows: IndexRow[] }) {
  const router = useRouter();
  const main = ["NSE:NIFTY", "BSE:SENSEX", "NSE:BANKNIFTY", "NSE:NIFTY500", "NSE:NIFTYMIDCAP100", "NSE:NIFTYSMALLCAP500"].map((s) => rows.find((r) => r.symbol === s)).filter(Boolean) as IndexRow[];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {main.map((r) => (
        <button key={r.symbol} className={`${card} p-3 text-left transition-colors hover:bg-hive-hover`} onClick={() => { setState({ symbol: r.symbol }); router.push("/charts"); }}>
          <div className="text-2xs uppercase tracking-wide text-hive-muted">{r.name}</div>
          <div className="tabular mt-1 text-[18px] font-semibold">{num(r.price)}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[12px]"><Pct v={r.ret["1D"]} /><span className="text-2xs text-hive-muted">1W <Pct v={r.ret["1W"]} /></span></div>
        </button>
      ))}
    </div>
  );
}

// Advance / decline, trend and 52-week breadth across the Nifty 500.
function Breadth({ rows }: { rows: StockRow[] }) {
  const s = useMemo(() => {
    const n = rows.length;
    const adv = rows.filter((r) => (r.ret["1D"] ?? 0) > 0).length;
    const dec = rows.filter((r) => (r.ret["1D"] ?? 0) < 0).length;
    const pctOf = (f: (r: StockRow) => boolean) => (rows.filter(f).length / n) * 100;
    return {
      n, adv, dec,
      above50: pctOf((r) => r.sma50 != null && r.close > r.sma50),
      above200: pctOf((r) => r.sma200 != null && r.close > r.sma200),
      highs: rows.filter((r) => r.gap52h <= 1).length,
      lows: rows.filter((r) => r.gap52l <= 1).length,
      breakouts: rows.filter((r) => r.brk52).length,
    };
  }, [rows]);
  const total = s.adv + s.dec || 1;
  return (
    <div className={`${card} p-4`}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">Market breadth <span className="font-normal text-hive-muted">· Nifty 500</span></h2>
        <span className="text-2xs text-hive-muted">{s.n} stocks</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded bg-hive-hover">
        <div className="bg-hive-up" style={{ width: `${(s.adv / total) * 100}%` }} />
        <div className="bg-hive-down" style={{ width: `${(s.dec / total) * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px]"><span className="text-hive-up">{s.adv} advancing</span><span className="text-hive-down">{s.dec} declining</span></div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Above 50-day avg" value={`${s.above50.toFixed(0)}%`} bar={s.above50} />
        <Stat label="Above 200-day avg" value={`${s.above200.toFixed(0)}%`} bar={s.above200} />
        <Stat label="Near 52-week high" value={String(s.highs)} sub="within 1%" />
        <Stat label="Near 52-week low" value={String(s.lows)} sub="within 1%" />
        <Stat label="52-week breakouts" value={String(s.breakouts)} sub="closed over prior high" />
      </div>
    </div>
  );
}

function Stat({ label, value, bar, sub }: { label: string; value: string; bar?: number; sub?: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wide text-hive-muted">{label}</div>
      <div className="tabular text-[20px] font-semibold">{value}</div>
      {bar != null ? <div className="mt-1 h-1.5 overflow-hidden rounded bg-hive-hover"><div className={`h-full ${bar >= 50 ? "bg-hive-up" : "bg-hive-down"}`} style={{ width: `${bar}%` }} /></div> : <div className="text-2xs text-hive-muted">{sub}</div>}
    </div>
  );
}

function IndexTable({ rows }: { rows: IndexRow[] }) {
  const router = useRouter();
  const [period, setPeriod] = useState<P>("1M");
  const groups = [...new Set(rows.map((r) => r.group))];
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.ret[period] ?? 0)));
  return (
    <div className={card}>
      <div className="flex items-center justify-between border-b border-hive-line px-4 py-2.5">
        <h2 className="font-semibold">Indices &amp; sectors</h2>
        <Seg value={period} options={PERIODS} onChange={(p) => setPeriod(p as P)} />
      </div>
      <div className="max-h-[640px] overflow-auto">
        {groups.map((g) => (
          <div key={g}>
            <div className="sticky top-0 bg-hive-panel px-4 py-1.5 text-2xs uppercase tracking-wide text-hive-muted">{g}</div>
            {rows.filter((r) => r.group === g).sort((a, b) => (b.ret[period] ?? -999) - (a.ret[period] ?? -999)).map((r) => {
              const v = r.ret[period] ?? 0;
              return (
                <button key={r.symbol} className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_64px] items-center gap-3 px-4 py-1.5 text-left hover:bg-hive-hover" onClick={() => { setState({ symbol: r.symbol }); router.push("/charts"); }}>
                  <span className="truncate">{r.name}</span>
                  <span className="relative h-4">
                    <span className="absolute left-1/2 top-0 h-full w-px bg-hive-line" />
                    <span className={`absolute top-0.5 h-3 rounded-sm ${v >= 0 ? "bg-hive-up/70" : "bg-hive-down/70"}`} style={{ width: `${(Math.abs(v) / maxAbs) * 50}%`, [v >= 0 ? "left" : "right"]: "50%" }} />
                  </span>
                  <Pct v={r.ret[period]} className="text-right" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Leaders({ rows }: { rows: StockRow[] }) {
  const open = useOpenChart();
  const [universe, setUniverse] = useState("NIFTY50");
  const [period, setPeriod] = useState<P>("1W");
  const [mode, setMode] = useState<Mode>("gain");
  const list = useMemo(() => {
    const pool = rows.filter((r) => inUniverse(r, universe));
    const ret = (r: StockRow) => r.ret[period];
    if (mode === "high") return pool.filter((r) => r.gap52h <= 5).sort((a, b) => a.gap52h - b.gap52h);
    if (mode === "low") return pool.filter((r) => r.gap52l <= 10).sort((a, b) => a.gap52l - b.gap52l);
    return pool.filter((r) => ret(r) != null).sort((a, b) => (mode === "gain" ? 1 : -1) * ((ret(b) as number) - (ret(a) as number)));
  }, [rows, universe, period, mode]);
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-2 border-b border-hive-line px-4 py-2.5">
        <h2 className="mr-auto font-semibold">Stocks</h2>
        <select className="input h-7" value={universe} onChange={(e) => setUniverse(e.target.value)}>{UNIVERSES.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <Seg value={mode} options={["gain", "lose", "high", "low"]} labels={{ gain: "Gainers", lose: "Losers", high: "52W High", low: "52W Low" }} onChange={(m) => setMode(m as Mode)} />
        {(mode === "gain" || mode === "lose") && <Seg value={period} options={PERIODS} onChange={(p) => setPeriod(p as P)} />}
      </div>
      <div className="max-h-[640px] overflow-auto">
        {list.length === 0 && <div className="p-6 text-center text-hive-muted">Nothing in this view today.</div>}
        {list.slice(0, 25).map((r, i) => (
          <button key={r.s} className="grid w-full grid-cols-[24px_minmax(0,1fr)_90px_74px] items-center gap-2 px-4 py-1.5 text-left hover:bg-hive-hover" onClick={() => open(r.s)}>
            <span className="tabular text-2xs text-hive-muted">{i + 1}</span>
            <span className="min-w-0"><span className="font-semibold">{r.s}</span> <span className="text-2xs text-hive-muted">{r.name}</span></span>
            <span className="tabular text-right">₹{num(r.close)}</span>
            {mode === "high" ? <span className="tabular text-right text-2xs text-hive-muted">{r.gap52h <= 0.005 ? "at high" : `${r.gap52h.toFixed(1)}% below`}</span> : mode === "low" ? <span className="tabular text-right text-2xs text-hive-muted">{r.gap52l.toFixed(1)}% above</span> : <Pct v={r.ret[period]} className="text-right" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// Which industries are leading: average returns, and how many of their stocks are in an uptrend.
function Industries({ rows }: { rows: StockRow[] }) {
  const [period, setPeriod] = useState<P>("3M");
  const data = useMemo(() => {
    const by = new Map<string, StockRow[]>();
    for (const r of rows) if (r.industry) (by.get(r.industry) ?? by.set(r.industry, []).get(r.industry)!).push(r);
    const mean = (a: (number | null)[]) => { const v = a.filter((x): x is number => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
    return [...by.entries()].map(([name, list]) => ({
      name, n: list.length,
      ret: Object.fromEntries(PERIODS.map((p) => [p, mean(list.map((r) => r.ret[p]))])) as Record<P, number | null>,
      up200: (list.filter((r) => r.sma200 != null && r.close > r.sma200).length / list.length) * 100,
      high: list.filter((r) => r.gap52h <= 5).length,
      top: [...list].sort((a, b) => (b.ret[period] ?? -999) - (a.ret[period] ?? -999)).slice(0, 3).map((r) => r.s),
    })).sort((a, b) => (b.ret[period] ?? -999) - (a.ret[period] ?? -999));
  }, [rows, period]);
  return (
    <div className={card}>
      <div className="flex items-center justify-between border-b border-hive-line px-4 py-2.5">
        <h2 className="font-semibold">Industry strength <span className="font-normal text-hive-muted">· average return of Nifty 500 stocks</span></h2>
        <Seg value={period} options={PERIODS} onChange={(p) => setPeriod(p as P)} />
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[760px] text-[12.5px]">
          <thead className="text-2xs uppercase tracking-wide text-hive-muted">
            <tr><th className="px-4 py-2 text-left font-medium">Industry</th><th className="px-3 text-right font-medium">Stocks</th>{PERIODS.map((p) => <th key={p} className={`px-3 text-right font-medium ${p === period ? "text-hive-accent" : ""}`}>{p}</th>)}<th className="px-3 text-right font-medium">Above 200D</th><th className="px-3 text-right font-medium">Near high</th><th className="px-4 text-left font-medium">Leaders</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.name} className="border-t border-hive-line hover:bg-hive-hover">
                <td className="px-4 py-1.5">{d.name}</td>
                <td className="tabular px-3 text-right text-hive-muted">{d.n}</td>
                {PERIODS.map((p) => <td key={p} className="px-3 text-right"><Pct v={d.ret[p]} /></td>)}
                <td className="tabular px-3 text-right">{d.up200.toFixed(0)}%</td>
                <td className="tabular px-3 text-right text-hive-muted">{d.high}</td>
                <td className="px-4 text-2xs text-hive-muted">{d.top.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, labels, onChange }: { value: T; options: readonly T[]; labels?: Record<string, string>; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded border border-hive-line p-0.5">
      {options.map((o) => (
        <button key={o} className={`rounded px-2 py-0.5 text-[12px] ${o === value ? "bg-hive-hover text-hive-accent" : "text-hive-muted hover:text-hive-text"}`} onClick={() => onChange(o)}>{labels?.[o] ?? o}</button>
      ))}
    </div>
  );
}
