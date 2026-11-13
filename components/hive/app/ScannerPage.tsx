"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { StockRow } from "@/lib/hive/data";
import { METRICS, METRIC, NEEDS_FEED, OPS, PREBUILT, UNIVERSES, describe, fmtMetric, inUniverse, isFundamental, joinRows, loadSaved, matches, runScan, saveSaved, toCsv, type Condition, type ScanRow, type Scan } from "@/lib/hive/scanner";
import { newUid } from "@/lib/hive/store";
import { useFundamentals, type Fundamentals } from "@/lib/hive/useFundamentals";
import { toWatchlist, useOpenChart, useSnapshot } from "@/lib/hive/useSnapshot";
import { Icon } from "../ui";
import Toast, { toast } from "../terminal/Toast";
import AppShell, { ErrorBox, Loading, Pct, num } from "./AppShell";

type Tab = "scans" | "match";
type SortKey = "name" | "close" | "1D" | "1W" | "1M" | "3M" | "1Y" | "alpha3M" | "rsi" | "gap52h" | "matched" | `m:${string}`;

// A scan that filters on financials or holdings can't give an answer until those have loaded.
const needsFunds = (conds: Condition[], f: Fundamentals) =>
  conds.some((k) => {
    const g = METRIC[k.metric]?.group;
    return (g === "Fundamentals" && !f.fin) || (g === "Shareholding" && !f.hold);
  });

const BLANK: Scan = { id: "", name: "My scan", group: "Saved", blurb: "", conds: [{ metric: "ret1M", op: ">=", value: 10 }] };

export default function ScannerPage() {
  const state = useSnapshot();
  return (
    <AppShell>
      <Toast />
      {state.status === "loading" && <Loading done={state.done} total={state.total} what="the Nifty 500" />}
      {state.status === "error" && <ErrorBox message={state.message} />}
      {state.status === "ready" && <Scanner rows={state.snap.stocks} at={state.snap.at} bench={state.snap.bench?.["1D"] ?? null} />}
    </AppShell>
  );
}

function Scanner({ rows: priceRows, at, bench }: { rows: StockRow[]; at: number; bench: number | null }) {
  const open = useOpenChart();
  const funds = useFundamentals();
  const rows = useMemo(() => joinRows(priceRows, funds.fin, funds.hold), [priceRows, funds.fin, funds.hold]);
  const [tab, setTab] = useState<Tab>("scans");
  const [universe, setUniverse] = useState("NIFTY500");
  const [industry, setIndustry] = useState("");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<Scan[]>([]);
  const [activeId, setActiveId] = useState(PREBUILT[0].id);
  const [draft, setDraft] = useState<Scan | null>(null); // the custom scan being built
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "1D", dir: -1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => setSaved(loadSaved()), []);

  const pool = useMemo(() => rows.filter((r) => inUniverse(r, universe) && (!industry || r.industry === industry)), [rows, universe, industry]);
  const industries = useMemo(() => [...new Set(rows.map((r) => r.industry))].filter(Boolean).sort(), [rows]);
  const all = useMemo(() => [...PREBUILT, ...saved], [saved]);
  const scan = draft ?? all.find((s) => s.id === activeId) ?? PREBUILT[0];

  // How many stocks each pre-built scan finds right now, and which scans each stock appears in.
  const counts = useMemo(() => Object.fromEntries(all.map((s) => [s.id, needsFunds(s.conds, funds) ? null : runScan(pool, s.conds).length])), [all, pool, funds]);
  const waiting = tab === "scans" && needsFunds(scan.conds, funds);
  // Fundamentals the open scan filters on get their own columns, so you can see why each stock made the list.
  const extra = useMemo(() => (tab === "scans" ? [...new Set(scan.conds.map((k) => k.metric))].map((k) => METRIC[k]).filter(isFundamental) : []), [tab, scan]);
  const matchedBy = useMemo(() => {
    const m = new Map<string, Scan[]>();
    for (const r of pool) {
      const hit = all.filter((s) => matches(r, s.conds));
      if (hit.length) m.set(r.s, hit);
    }
    return m;
  }, [all, pool]);

  const results = useMemo(() => {
    let list = tab === "match" ? pool.filter((r) => matchedBy.has(r.s)) : runScan(pool, scan.conds);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => r.s.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    const val = (r: ScanRow): number | string | null => {
      if (sort.key.startsWith("m:")) return METRIC[sort.key.slice(2)]?.get(r) ?? null;
      switch (sort.key) {
        case "name": return r.s;
        case "close": return r.close;
        case "alpha3M": return r.rel["3M"];
        case "rsi": return r.rsi;
        case "gap52h": return r.gap52h;
        case "matched": return matchedBy.get(r.s)?.length ?? 0;
        default: return r.ret[sort.key as keyof StockRow["ret"]];
      }
    };
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
    });
  }, [tab, pool, matchedBy, scan, query, sort]);

  const head = (key: SortKey, label: string, left = false, hint?: string) => (
    <th title={hint} className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium hover:text-hive-text ${left ? "text-left" : "text-right"}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}>
      {label}
      {sort.key === key && <span className="ml-1 text-hive-accent">{sort.dir === 1 ? "▲" : "▼"}</span>}
    </th>
  );

  const targets = picked.size ? results.filter((r) => picked.has(r.s)) : results;
  const toggle = (s: string) => setPicked((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const saveToWatchlist = () => {
    if (!targets.length) return toast("Nothing to add");
    const name = tab === "match" ? "Scan match" : scan.name;
    toWatchlist(name, targets.map((r) => r.s));
    toast(`${targets.length} stocks added to a new watchlist "${name}"`);
  };
  const download = () => {
    const blob = new Blob([toCsv(targets, extra)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(tab === "match" ? "scan-match" : scan.name).replace(/\W+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const commitDraft = () => {
    if (!draft) return;
    const name = draft.name.trim() || "My scan";
    const next: Scan = { ...draft, name, id: draft.id || `u${newUid()}`, group: "Saved" };
    const list = saved.some((s) => s.id === next.id) ? saved.map((s) => (s.id === next.id ? next : s)) : [...saved, next];
    setSaved(list);
    saveSaved(list);
    setActiveId(next.id);
    setDraft(null);
    toast(`Saved "${name}"`);
  };
  const removeSaved = (id: string) => {
    const list = saved.filter((s) => s.id !== id);
    setSaved(list);
    saveSaved(list);
    if (activeId === id) setActiveId(PREBUILT[0].id);
  };

  const groups = [...new Set(PREBUILT.map((s) => s.group))];
  const asOf = new Date(at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-full min-h-0">
      {/* Left: scan list */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-hive-line bg-hive-panel">
        <div className="flex gap-1 border-b border-hive-line p-2">
          <button className={`btn flex-1 justify-center ${tab === "scans" ? "btn-on" : ""}`} onClick={() => setTab("scans")}>Scans</button>
          <button className={`btn flex-1 justify-center ${tab === "match" ? "btn-on" : ""}`} onClick={() => setTab("match")} title="Stocks that show up in the most scans">Scan Match</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto pb-4">
          <div className="p-2">
            <button className="btn w-full justify-center border border-dashed border-hive-line text-hive-accent" onClick={() => { setTab("scans"); setDraft({ ...BLANK, conds: [...BLANK.conds] }); }}>
              <Icon name="plus" size={16} /> Create new scan
            </button>
          </div>
          {saved.length > 0 && (
            <Group title="Saved">
              {saved.map((s) => (
                <ScanItem key={s.id} s={s} count={counts[s.id]} active={!draft && tab === "scans" && activeId === s.id} onClick={() => { setTab("scans"); setDraft(null); setActiveId(s.id); }} onRemove={() => removeSaved(s.id)} onEdit={() => { setTab("scans"); setDraft({ ...s, conds: s.conds.map((c) => ({ ...c })) }); }} />
              ))}
            </Group>
          )}
          {groups.map((g) => (
            <Group key={g} title={g}>
              {PREBUILT.filter((s) => s.group === g).map((s) => (
                <ScanItem key={s.id} s={s} count={counts[s.id]} active={!draft && tab === "scans" && activeId === s.id} onClick={() => { setTab("scans"); setDraft(null); setActiveId(s.id); }} />
              ))}
            </Group>
          ))}
          <div className="mx-3 mt-4 rounded border border-hive-line p-3 text-2xs text-hive-muted">
            <div className="mb-1 font-semibold text-hive-text">Not here yet</div>
            A few StockScans scans still have no free data behind them:
            <ul className="mt-1 list-disc pl-4">{NEEDS_FEED.map((f) => <li key={f}>{f}</li>)}</ul>
            <div className="mt-2">Bulk and block deals are on the Filings page.</div>
          </div>
        </div>
      </aside>

      {/* Right: filters + results */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-hive-line px-4 py-3">
          {draft ? (
            <Builder draft={draft} onChange={setDraft} onSave={commitDraft} onCancel={() => setDraft(null)} preview={waiting ? null : runScan(pool, draft.conds).length} funds={funds} />
          ) : (
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h1 className="text-[17px] font-semibold">{tab === "match" ? "Scan Match" : scan.name}</h1>
                <span className="text-hive-muted">{waiting ? "waiting for company data" : `${results.length} stocks`}</span>
              </div>
              <p className="mt-0.5 max-w-3xl text-hive-muted">{tab === "match" ? `Stocks that show up in the most of the ${all.length} scans right now. Strength tends to cluster.` : scan.blurb || scan.conds.map(describe).join(" · ")}</p>
              {tab === "scans" && <div className="mt-1.5 flex flex-wrap gap-1.5">{scan.conds.map((k, i) => <span key={i} className="rounded bg-hive-hover px-1.5 py-0.5 text-2xs text-hive-muted">{describe(k)}</span>)}</div>}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hive-line px-4 py-2">
          <select className="input" value={universe} onChange={(e) => setUniverse(e.target.value)}>
            {UNIVERSES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select className="input max-w-[200px]" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">All industries</option>
            {industries.map((i) => <option key={i}>{i}</option>)}
          </select>
          <div className="relative">
            <Icon name="search" size={14} className="pointer-events-none absolute left-2 top-2.5 text-hive-muted" />
            <input className="input w-48 pl-7" placeholder="Filter results" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex-1" />
          <span className="text-2xs text-hive-muted">Nifty 500 today {bench != null ? `${bench >= 0 ? "+" : ""}${bench.toFixed(2)}%` : ""} · as of {asOf}</span>
          <button className="btn border border-hive-line" onClick={download} disabled={!results.length}>Download CSV</button>
          <button className="btn border border-hive-line" onClick={saveToWatchlist} disabled={!results.length}>
            <Icon name="list" size={15} /> {picked.size ? `Add ${picked.size} to watchlist` : "Add all to watchlist"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {waiting ? (
            <div className="grid h-full place-items-center p-8 text-center text-hive-muted">
              {funds.error ? `Couldn't load company data: ${funds.error}` : `Loading company financials${funds.progress?.total ? ` (${funds.progress.done}/${funds.progress.total})` : "…"}. This scan filters on them. The first load takes about a minute, after that it's instant.`}
            </div>
          ) : results.length === 0 ? (
            <div className="grid h-full place-items-center text-hive-muted">No stocks match right now. Try another scan or a wider universe.</div>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-hive-panel text-2xs uppercase tracking-wide text-hive-muted">
                <tr>
                  <th className="w-8 px-3 py-2"><input type="checkbox" className="accent-[rgb(var(--hive-accent))]" checked={picked.size > 0 && picked.size === results.length} onChange={(e) => setPicked(e.target.checked ? new Set(results.map((r) => r.s)) : new Set())} aria-label="Select all" /></th>
                  {head("name", "Company", true)}
                  {head("close", "Price")}
                  {head("1D", "1D")}
                  {head("1W", "1W")}
                  {head("1M", "1M")}
                  {head("3M", "3M")}
                  {head("1Y", "1Y")}
                  {head("alpha3M", "ΔN500 3M")}
                  {head("rsi", "RSI")}
                  {head("gap52h", "52WH gap")}
                  {head("matched", "Scans")}
                  {extra.map((m) => <React.Fragment key={m.key}>{head(`m:${m.key}`, m.label, false, m.hint)}</React.Fragment>)}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.s} className="group cursor-pointer hover:bg-hive-hover" onClick={() => open(r.s)}>
                    <td className="border-b border-hive-line px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="accent-[rgb(var(--hive-accent))]" checked={picked.has(r.s)} onChange={() => toggle(r.s)} aria-label={`Select ${r.s}`} />
                    </td>
                    <td className="border-b border-hive-line px-3 py-1.5">
                      <div className="font-semibold">{r.s}</div>
                      <div className="max-w-[260px] truncate text-2xs text-hive-muted">{r.name} · {r.industry}</div>
                    </td>
                    <td className="tabular border-b border-hive-line px-3 py-1.5 text-right">₹{num(r.close)}</td>
                    <Cell v={r.ret["1D"]} /><Cell v={r.ret["1W"]} /><Cell v={r.ret["1M"]} /><Cell v={r.ret["3M"]} /><Cell v={r.ret["1Y"]} /><Cell v={r.rel["3M"]} />
                    <td className={`tabular border-b border-hive-line px-3 py-1.5 text-right ${r.rsi != null && r.rsi >= 70 ? "text-hive-up" : r.rsi != null && r.rsi <= 30 ? "text-hive-down" : ""}`}>{num(r.rsi, 1)}</td>
                    <td className="tabular border-b border-hive-line px-3 py-1.5 text-right text-hive-muted">{r.gap52h <= 0.005 ? "at high" : `${r.gap52h.toFixed(1)}%`}</td>
                    <td className="border-b border-hive-line px-3 py-1.5 text-right" title={(matchedBy.get(r.s) ?? []).map((s) => s.name).join(", ")}>
                      <span className="rounded bg-hive-accent/15 px-1.5 py-0.5 text-2xs font-semibold text-hive-accent">{matchedBy.get(r.s)?.length ?? 0}</span>
                    </td>
                    {extra.map((m) => {
                      const v = m.get(r);
                      return (
                        <td key={m.key} className={`tabular whitespace-nowrap border-b border-hive-line px-3 py-1.5 text-right ${m.signed && v != null ? (v > 0 ? "text-hive-up" : v < 0 ? "text-hive-down" : "") : ""}`}>
                          {m.label.includes("(1 = yes)") ? (v == null ? "—" : v ? "Yes" : "No") : fmtMetric(m, v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

const Cell = ({ v }: { v: number | null }) => (
  <td className="border-b border-hive-line px-3 py-1.5 text-right"><Pct v={v} /></td>
);

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <div className="px-4 pb-1 pt-2 text-2xs uppercase tracking-wide text-hive-muted">{title}</div>
      {children}
    </div>
  );
}

function ScanItem({ s, count, active, onClick, onRemove, onEdit }: { s: Scan; count: number | null; active: boolean; onClick: () => void; onRemove?: () => void; onEdit?: () => void }) {
  return (
    <div className={`group mx-2 flex items-center rounded ${active ? "bg-hive-hover text-hive-accent" : "hover:bg-hive-hover"}`}>
      <button className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1.5 text-left" onClick={onClick} title={s.blurb}>
        <span className="truncate">{s.name}</span>
        <span className={`tabular rounded px-1.5 text-2xs ${count ? "bg-hive-accent/15 text-hive-accent" : "text-hive-muted"}`}>{count ?? "…"}</span>
      </button>
      {onEdit && <button className="icon-btn hidden h-6 w-6 group-hover:inline-flex" onClick={onEdit} title="Edit"><Icon name="pencil" size={13} /></button>}
      {onRemove && <button className="icon-btn hidden h-6 w-6 group-hover:inline-flex" onClick={onRemove} title="Delete"><Icon name="trash" size={13} /></button>}
    </div>
  );
}

function Builder({ draft, onChange, onSave, onCancel, preview, funds }: { draft: Scan; onChange: (s: Scan) => void; onSave: () => void; onCancel: () => void; preview: number | null; funds: Fundamentals }) {
  const set = (i: number, patch: Partial<Condition>) => onChange({ ...draft, conds: draft.conds.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const groups = [...new Set(METRICS.map((m) => m.group))];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <input className="input w-64 font-semibold" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} aria-label="Scan name" />
        <span className="text-hive-muted">{preview == null ? "waiting for company data" : `${preview} stocks match`}</span>
        <div className="flex-1" />
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn bg-hive-accent text-white hover:bg-hive-accent/90" onClick={onSave} disabled={!draft.conds.length}>Save scan</button>
      </div>
      <div className="space-y-1.5">
        {draft.conds.map((k, i) => (
          <div key={i} className="flex items-center gap-2">
            <select className="input w-56" value={k.metric} onChange={(e) => set(i, { metric: e.target.value })} title={METRIC[k.metric]?.hint}>
              {groups.map((g) => (
                <optgroup key={g} label={g}>{METRICS.filter((m) => m.group === g).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</optgroup>
              ))}
            </select>
            <select className="input w-16" value={k.op} onChange={(e) => set(i, { op: e.target.value as Condition["op"] })}>{OPS.map((o) => <option key={o}>{o}</option>)}</select>
            <input className="input w-28" type="number" step="any" value={Number.isFinite(k.value) ? k.value : ""} onChange={(e) => set(i, { value: e.target.value === "" ? NaN : Number(e.target.value) })} />
            <span className="w-12 text-2xs text-hive-muted">{METRIC[k.metric]?.unit}</span>
            <button className="icon-btn" onClick={() => onChange({ ...draft, conds: draft.conds.filter((_, j) => j !== i) })} title="Remove filter"><Icon name="x" size={15} /></button>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <button className="btn text-hive-accent" onClick={() => onChange({ ...draft, conds: [...draft.conds, { metric: "rsi", op: ">=", value: 60 }] })}>
          <Icon name="plus" size={15} /> Add filter
        </button>
        <span className="text-2xs text-hive-muted">
          Mix price filters with Fundamentals and Shareholding ones.
          {!funds.fin && !funds.error && " Company financials are still loading."}
        </span>
      </div>
    </div>
  );
}
