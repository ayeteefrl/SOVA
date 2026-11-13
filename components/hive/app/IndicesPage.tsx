"use client";
// Custom Index: a basket of stocks tracked as one equal-weighted index. Ready-made themes plus your own.
import { useEffect, useMemo, useState } from "react";
import type { Periods, StockRow } from "@/lib/hive/data";
import { newUid } from "@/lib/hive/store";
import { hiveKey } from "@/lib/hive/user";
import { toWatchlist, useOpenChart, useSnapshot } from "@/lib/hive/useSnapshot";
import { Icon } from "../ui";
import Toast, { toast } from "../terminal/Toast";
import AppShell, { ErrorBox, Loading, Pct, num } from "./AppShell";

type Basket = { id: string; name: string; symbols: string[]; custom?: boolean };
type P = keyof Periods;
const PERIODS: P[] = ["1D", "1W", "1M", "3M", "6M", "1Y"];

// Themes in the spirit of StockScans' pre-built indices. Symbols that aren't in the Nifty 500 are skipped.
const THEMES: Basket[] = [
  { id: "t-pvt", name: "Private Large Banks", symbols: ["HDFCBANK", "ICICIBANK", "AXISBANK", "KOTAKBANK", "INDUSINDBK"] },
  { id: "t-psu", name: "PSU Banks", symbols: ["SBIN", "BANKBARODA", "PNB", "CANBK", "UNIONBANK", "INDIANB", "BANKINDIA"] },
  { id: "t-defence", name: "Defence", symbols: ["HAL", "BEL", "BDL", "MAZDOCK", "COCHINSHIP", "BHARATFORG", "DATAPATTNS", "SOLARINDS"] },
  { id: "t-hosp", name: "Hospitals", symbols: ["APOLLOHOSP", "MAXHEALTH", "FORTIS", "NH", "KIMS", "RAINBOW", "MEDANTA"] },
  { id: "t-it", name: "IT Services", symbols: ["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM", "PERSISTENT", "COFORGE", "MPHASIS"] },
  { id: "t-ems", name: "Electronics & EMS", symbols: ["DIXON", "KAYNES", "AMBER", "SYRMA", "CYIENTDLM", "AVALON"] },
  { id: "t-rail", name: "Railways", symbols: ["IRCTC", "RVNL", "IRFC", "RAILTEL", "TITAGARH", "JWL", "IRCON"] },
  { id: "t-cement", name: "Cements", symbols: ["ULTRACEMCO", "AMBUJACEM", "SHREECEM", "ACC", "DALBHARAT", "JKCEMENT", "RAMCOCEM"] },
  { id: "t-auto", name: "Autos", symbols: ["MARUTI", "M&M", "TATAMOTORS", "BAJAJ-AUTO", "EICHERMOT", "HEROMOTOCO", "TVSMOTOR"] },
  { id: "t-amc", name: "AMCs & Capital Markets", symbols: ["HDFCAMC", "NAM-INDIA", "CDSL", "BSE", "ANGELONE", "360ONE", "NUVAMA"] },
];

const KEY = "chart-hive.baskets.v1";
const load = (): Basket[] => {
  try {
    return JSON.parse(localStorage.getItem(hiveKey(KEY)) || "[]");
  } catch {
    return [];
  }
};

export default function IndicesPage() {
  const state = useSnapshot();
  return (
    <AppShell>
      <Toast />
      {state.status === "loading" && <Loading done={state.done} total={state.total} what="the Nifty 500" />}
      {state.status === "error" && <ErrorBox message={state.message} />}
      {state.status === "ready" && <Indices rows={state.snap.stocks} />}
    </AppShell>
  );
}

function Indices({ rows }: { rows: StockRow[] }) {
  const open = useOpenChart();
  const [mine, setMine] = useState<Basket[]>([]);
  const [active, setActive] = useState(THEMES[0].id);
  const [editing, setEditing] = useState<Basket | null>(null);
  const [tab, setTab] = useState<"themes" | "mine">("themes");
  useEffect(() => setMine(load()), []);
  const persist = (list: Basket[]) => {
    setMine(list);
    try { localStorage.setItem(hiveKey(KEY), JSON.stringify(list)); } catch { /* blocked */ }
  };

  const by = useMemo(() => new Map(rows.map((r) => [r.s, r])), [rows]);
  const stats = (b: Basket) => {
    const found = b.symbols.map((s) => by.get(s)).filter(Boolean) as StockRow[];
    const avg = (p: P) => { const v = found.map((r) => r.ret[p]).filter((x): x is number => x != null); return v.length ? v.reduce((a, c) => a + c, 0) / v.length : null; };
    return { found, ret: Object.fromEntries(PERIODS.map((p) => [p, avg(p)])) as Record<P, number | null> };
  };
  const list = tab === "themes" ? THEMES : mine;
  const current = [...THEMES, ...mine].find((b) => b.id === active) ?? list[0];
  const cur = current ? stats(current) : null;
  const ranked = useMemo(() => list.map((b) => ({ b, s: stats(b) })).sort((a, c) => (c.s.ret["1M"] ?? -999) - (a.s.ret["1M"] ?? -999)), [list, by]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (b: Basket) => {
    const symbols = [...new Set(b.symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
    const next = { ...b, symbols, name: b.name.trim() || "My index", custom: true, id: b.id || `u${newUid()}` };
    persist(mine.some((x) => x.id === next.id) ? mine.map((x) => (x.id === next.id ? next : x)) : [...mine, next]);
    setEditing(null);
    setTab("mine");
    setActive(next.id);
    const missing = symbols.filter((s) => !by.has(s));
    toast(missing.length ? `Saved. ${missing.length} not in the Nifty 500: ${missing.slice(0, 4).join(", ")}` : `Saved "${next.name}"`);
  };

  return (
    <div className="mx-auto flex h-full max-w-[1400px] min-h-0 gap-5 p-5">
      <aside className="flex w-80 shrink-0 flex-col rounded-lg border border-hive-line bg-hive-panel">
        <div className="flex gap-1 border-b border-hive-line p-2">
          <button className={`btn flex-1 justify-center ${tab === "themes" ? "btn-on" : ""}`} onClick={() => { setTab("themes"); setActive(THEMES[0].id); }}>Pre-built · {THEMES.length}</button>
          <button className={`btn flex-1 justify-center ${tab === "mine" ? "btn-on" : ""}`} onClick={() => { setTab("mine"); if (mine[0]) setActive(mine[0].id); }}>My index · {mine.length}</button>
        </div>
        <div className="grid grid-cols-[1fr_60px_60px] gap-2 px-4 py-1.5 text-2xs uppercase tracking-wide text-hive-muted"><span>Name</span><span className="text-right">1D</span><span className="text-right">1M</span></div>
        <div className="min-h-0 flex-1 overflow-auto">
          {ranked.map(({ b, s }) => (
            <button key={b.id} className={`grid w-full grid-cols-[1fr_60px_60px] items-center gap-2 px-4 py-2 text-left ${b.id === current?.id ? "bg-hive-hover" : "hover:bg-hive-hover"}`} onClick={() => setActive(b.id)}>
              <span className="truncate">{b.name}</span><Pct v={s.ret["1D"]} className="text-right" /><Pct v={s.ret["1M"]} className="text-right" />
            </button>
          ))}
          {tab === "mine" && mine.length === 0 && <div className="p-5 text-center text-hive-muted">No indices yet. Build one from any set of Nifty 500 stocks.</div>}
        </div>
        <div className="border-t border-hive-line p-2">
          <button className="btn w-full justify-center bg-hive-accent text-white hover:bg-hive-accent/90" onClick={() => setEditing({ id: "", name: "", symbols: [], custom: true })}><Icon name="plus" size={16} /> Create index</button>
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-auto">
        {current && cur && (
          <div className="rounded-lg border border-hive-line bg-hive-panel">
            <div className="flex flex-wrap items-center gap-2 border-b border-hive-line px-5 py-3">
              <div className="mr-auto">
                <h1 className="text-[18px] font-semibold">{current.name}</h1>
                <div className="text-hive-muted">Equal-weighted · {cur.found.length} of {current.symbols.length} stocks found</div>
              </div>
              <button className="btn border border-hive-line" onClick={() => { toWatchlist(current.name, cur.found.map((r) => r.s)); toast(`Added to a new watchlist "${current.name}"`); }}><Icon name="list" size={15} /> To watchlist</button>
              {current.custom && <button className="btn border border-hive-line" onClick={() => setEditing(current)}><Icon name="pencil" size={15} /> Edit</button>}
              {current.custom && <button className="btn border border-hive-line text-hive-down" onClick={() => { persist(mine.filter((m) => m.id !== current.id)); setActive(THEMES[0].id); setTab("themes"); }}><Icon name="trash" size={15} /> Delete</button>}
            </div>
            <div className="grid grid-cols-3 gap-px bg-hive-line md:grid-cols-6">
              {PERIODS.map((p) => (
                <div key={p} className="bg-hive-panel px-5 py-3">
                  <div className="text-2xs uppercase tracking-wide text-hive-muted">{p}</div>
                  <Pct v={cur.ret[p]} className="text-[19px] font-semibold" />
                </div>
              ))}
            </div>
            <table className="w-full text-[12.5px]">
              <thead className="text-2xs uppercase tracking-wide text-hive-muted"><tr><th className="px-5 py-2 text-left font-medium">Stock</th><th className="px-3 text-right font-medium">Price</th>{PERIODS.map((p) => <th key={p} className="px-3 text-right font-medium">{p}</th>)}<th className="px-5 text-right font-medium">RSI</th></tr></thead>
              <tbody>
                {[...cur.found].sort((a, b) => (b.ret["1M"] ?? -999) - (a.ret["1M"] ?? -999)).map((r) => (
                  <tr key={r.s} className="cursor-pointer border-t border-hive-line hover:bg-hive-hover" onClick={() => open(r.s)}>
                    <td className="px-5 py-1.5"><span className="font-semibold">{r.s}</span> <span className="text-2xs text-hive-muted">{r.name}</span></td>
                    <td className="tabular px-3 text-right">₹{num(r.close)}</td>
                    {PERIODS.map((p) => <td key={p} className="px-3 text-right"><Pct v={r.ret[p]} /></td>)}
                    <td className="tabular px-5 text-right">{num(r.rsi, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {current.symbols.some((s) => !by.has(s)) && <div className="border-t border-hive-line px-5 py-2 text-2xs text-hive-muted">Not in the Nifty 500, so left out: {current.symbols.filter((s) => !by.has(s)).join(", ")}</div>}
          </div>
        )}
      </section>

      {editing && <Editor basket={editing} rows={rows} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function Editor({ basket, rows, onSave, onCancel }: { basket: Basket; rows: StockRow[]; onSave: (b: Basket) => void; onCancel: () => void }) {
  const [name, setName] = useState(basket.name);
  const [symbols, setSymbols] = useState<string[]>(basket.symbols);
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => !symbols.includes(r.s) && (r.s.toLowerCase().startsWith(t) || r.name.toLowerCase().includes(t))).slice(0, 8) : [];
  }, [q, rows, symbols]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="w-[480px] max-w-[calc(100vw-32px)] rounded-lg border border-hive-line bg-hive-raised p-5 shadow-2xl shadow-black/50">
        <h2 className="mb-3 text-[15px] font-semibold">{basket.id ? "Edit index" : "Create index"}</h2>
        <input className="input mb-3 w-full" placeholder="Index name, e.g. My quality picks" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="relative">
          <input className="input w-full" placeholder="Add a stock: type a name or ticker" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.length > 0 && (
            <div className="menu absolute left-0 right-0 top-9 z-10">
              {hits.map((r) => <button key={r.s} className="menu-item" onClick={() => { setSymbols([...symbols, r.s]); setQ(""); }}><span className="font-semibold">{r.s}</span><span className="ml-2 truncate text-hive-muted">{r.name}</span></button>)}
            </div>
          )}
        </div>
        <div className="mt-3 flex min-h-[72px] flex-wrap content-start gap-1.5 rounded border border-hive-line p-2">
          {symbols.length === 0 && <span className="text-hive-muted">No stocks yet.</span>}
          {symbols.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded bg-hive-hover px-2 py-0.5">{s}<button className="text-hive-muted hover:text-hive-down" onClick={() => setSymbols(symbols.filter((x) => x !== s))} aria-label={`Remove ${s}`}><Icon name="x" size={12} /></button></span>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn bg-hive-accent text-white hover:bg-hive-accent/90" disabled={!symbols.length} onClick={() => onSave({ ...basket, name, symbols })}>Save</button>
        </div>
      </div>
    </div>
  );
}
