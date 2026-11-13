"use client";
// Shareholding from NSE: how promoter holding moved this quarter, and big stake changes (takeover-code filings).
import { useMemo, useState } from "react";
import { api, type HoldingRow, type ShareholdingResponse, type StakesResponse } from "@/lib/hive/data";
import { toWatchlist, useOpenChart } from "@/lib/hive/useSnapshot";
import { ErrorBox, num } from "./AppShell";
import { Seg } from "./MarketPage";
import { IST, card, useLoad, when } from "./filingsKit";

type HoldSort = "chg" | "promoter" | "chgYoY" | "symbol";
const quarterLabel = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });
const pp = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}`);
const ppClass = (v: number | null) => (v == null || v === 0 ? "text-hive-muted" : v > 0 ? "text-hive-up" : "text-hive-down");

export default function ShareholdingTab({ onlyN500 }: { onlyN500: boolean }) {
  const [view, setView] = useState<"promoter" | "stakes">("promoter");
  return (
    <>
      <Seg value={view} options={["promoter", "stakes"] as const} labels={{ promoter: "Promoter holding changes", stakes: "Big stake changes" }} onChange={setView} />
      {view === "promoter" ? <PromoterChanges onlyN500={onlyN500} /> : <Stakes onlyN500={onlyN500} />}
    </>
  );
}

function PromoterChanges({ onlyN500 }: { onlyN500: boolean }) {
  const [dir, setDir] = useState<"up" | "down" | "all">("up");
  const [min, setMin] = useState(0.5);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: HoldSort; dir: 1 | -1 }>({ key: "chg", dir: -1 });
  const [notice, setNotice] = useState("");
  const open = useOpenChart();
  const { data, error } = useLoad<ShareholdingResponse>(() => api.shareholding(), "hold");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (data?.rows ?? []).filter((r: HoldingRow) => {
      if (onlyN500 && !r.n500) return false;
      if (r.chg == null) return false;
      if (dir === "up" ? r.chg < min : dir === "down" ? r.chg > -min : Math.abs(r.chg) < min) return false;
      return !s || `${r.symbol} ${r.name}`.toLowerCase().includes(s);
    });
    const get = (r: HoldingRow) => (sort.key === "symbol" ? r.symbol : (r[sort.key] ?? -Infinity));
    return list.sort((a, b) => {
      const x = get(a), y = get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [data, onlyN500, dir, min, q, sort]);

  const pick = (d: "up" | "down" | "all") => {
    setDir(d);
    setSort({ key: "chg", dir: d === "down" ? 1 : -1 });
  };
  const Th = ({ k, children, left }: { k: HoldSort; children: string; left?: boolean }) => (
    <th className={`cursor-pointer select-none px-3 py-2 font-medium hover:text-hive-text ${left ? "text-left" : "text-right"}`} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : k === "symbol" ? 1 : -1 }))}>
      {children}
      {sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={dir} options={["up", "down", "all"] as const} labels={{ up: "Promoters buying", down: "Promoters selling", all: "Both" }} onChange={pick} />
        <select className="input" value={min} onChange={(e) => setMin(Number(e.target.value))} aria-label="Minimum change">
          <option value={0.1}>Change of 0.1 pt or more</option>
          <option value={0.5}>Change of 0.5 pt or more</option>
          <option value={1}>Change of 1 pt or more</option>
          <option value={2}>Change of 2 pts or more</option>
          <option value={5}>Change of 5 pts or more</option>
        </select>
        <div className="flex-1" />
        <input className="input w-52" placeholder="Search company" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn"
          disabled={!rows.length}
          onClick={() => {
            toWatchlist(dir === "down" ? "Promoters selling" : "Promoters buying", rows.map((r) => r.symbol));
            setNotice(`Added ${rows.length} to a new watchlist. Open it on the Charts page.`);
          }}
        >
          Add all to watchlist
        </button>
      </div>
      {notice && <div className="rounded-lg border border-hive-line bg-hive-panel px-3 py-2 text-[12px] text-hive-up">{notice}</div>}
      {error ? (
        <ErrorBox message={error} />
      ) : !data ? (
        <div className="h-64 animate-pulse rounded-lg bg-hive-panel" />
      ) : (
        <div className={card}>
          <div className="border-b border-hive-line px-3 py-2 text-[12px] text-hive-muted">
            {rows.length.toLocaleString("en-IN")} companies · quarter ended {quarterLabel(data.quarter)} vs {quarterLabel(data.prevQuarter)} · change is in percentage points of the company
          </div>
          {!rows.length ? (
            <div className="p-8 text-center text-hive-muted">No companies match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-hive-panel text-2xs uppercase tracking-wide text-hive-muted">
                  <tr>
                    <Th k="symbol" left>Stock</Th>
                    <Th k="promoter">Promoter %</Th>
                    <th className="px-3 py-2 text-right font-medium">Previous qtr %</th>
                    <Th k="chg">Change (pts)</Th>
                    <Th k="chgYoY">Vs year ago (pts)</Th>
                    <th className="px-3 py-2 text-right font-medium">Public %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hive-line">
                  {rows.slice(0, 500).map((r) => (
                    <tr key={r.symbol} className="hover:bg-hive-hover">
                      <td className="px-3 py-1.5">
                        <button className="font-semibold text-hive-accent hover:underline" onClick={() => open(r.symbol)}>{r.symbol}</button>
                        <span className="ml-2 text-hive-muted">{r.name}</span>
                      </td>
                      <td className="tabular px-3 py-1.5 text-right">{num(r.promoter)}</td>
                      <td className="tabular px-3 py-1.5 text-right text-hive-muted">{num(r.prevPromoter)}</td>
                      <td className={`tabular px-3 py-1.5 text-right font-medium ${ppClass(r.chg)}`}>{pp(r.chg)}</td>
                      <td className={`tabular px-3 py-1.5 text-right ${ppClass(r.chgYoY)}`}>{pp(r.chgYoY)}</td>
                      <td className="tabular px-3 py-1.5 text-right text-hive-muted">{num(r.public)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Stakes({ onlyN500 }: { onlyN500: boolean }) {
  const [days, setDays] = useState(30);
  const [side, setSide] = useState("all");
  const [promoterOnly, setPromoterOnly] = useState(false);
  const [q, setQ] = useState("");
  const open = useOpenChart();
  const { data, error } = useLoad<StakesResponse>(() => api.stakes(days), `stakes${days}`);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => (!onlyN500 || r.n500) && (side === "all" || r.side === side) && (!promoterOnly || r.promoter) && (!s || `${r.symbol} ${r.name} ${r.acquirer}`.toLowerCase().includes(s)));
  }, [data, onlyN500, side, promoterOnly, q]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={side} options={["all", "BUY", "SELL"] as const} labels={{ all: "Buy & sell", BUY: "Acquisitions", SELL: "Sales" }} onChange={setSide} />
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-hive-muted">
          <input type="checkbox" className="accent-[rgb(var(--hive-accent))]" checked={promoterOnly} onChange={(e) => setPromoterOnly(e.target.checked)} />
          Promoters only
        </label>
        <div className="flex-1" />
        <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <input className="input w-52" placeholder="Search company or buyer" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? (
        <ErrorBox message={error} />
      ) : !data ? (
        <div className="h-64 animate-pulse rounded-lg bg-hive-panel" />
      ) : (
        <div className={card}>
          <div className="border-b border-hive-line px-3 py-2 text-[12px] text-hive-muted">
            {rows.length.toLocaleString("en-IN")} disclosures · {data.from} to {data.to} · filed when someone crosses 5% or moves their stake by 2% or more
          </div>
          {!rows.length ? (
            <div className="p-8 text-center text-hive-muted">No disclosures match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-hive-panel text-2xs uppercase tracking-wide text-hive-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Filed</th>
                    <th className="px-3 py-2 text-left font-medium">Stock</th>
                    <th className="px-3 py-2 text-left font-medium">Buyer / seller</th>
                    <th className="px-3 py-2 text-left font-medium">Side</th>
                    <th className="px-3 py-2 text-left font-medium">How</th>
                    <th className="px-3 py-2 text-right font-medium">Shares</th>
                    <th className="px-3 py-2 text-right font-medium">Held after %</th>
                    <th className="w-14 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-hive-line">
                  {rows.slice(0, 500).map((r, i) => (
                    <tr key={`${r.symbol}-${r.t}-${r.acquirer}-${i}`} className="hover:bg-hive-hover">
                      <td className="tabular whitespace-nowrap px-3 py-1.5 text-hive-muted">{when(r.t)}</td>
                      <td className="px-3 py-1.5">
                        <button className="font-semibold text-hive-accent hover:underline" onClick={() => open(r.symbol)}>{r.symbol}</button>
                        <span className="ml-2 text-hive-muted">{r.name}</span>
                      </td>
                      <td className="max-w-[280px] px-3 py-1.5">
                        <span className="truncate" title={r.acquirer}>{r.acquirer}</span>
                        {r.promoter && <span className="ml-2 rounded bg-hive-hover px-1.5 py-0.5 text-2xs text-hive-accent">Promoter</span>}
                      </td>
                      <td className={`px-3 py-1.5 font-medium ${r.side === "BUY" ? "text-hive-up" : "text-hive-down"}`}>{r.side === "BUY" ? "Acquired" : "Sold"}</td>
                      <td className="px-3 py-1.5 text-hive-muted">{r.mode}</td>
                      <td className="tabular px-3 py-1.5 text-right">{r.shares == null ? "—" : r.shares.toLocaleString("en-IN")}</td>
                      <td className="tabular px-3 py-1.5 text-right">{num(r.pctAfter)}</td>
                      <td className="px-3 py-1.5 text-right">{r.file && <a className="text-hive-accent hover:underline" href={r.file} target="_blank" rel="noreferrer">Filing</a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
