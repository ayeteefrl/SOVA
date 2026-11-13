"use client";
// Portfolio: drop in a broker tradebook (or add trades by hand) and see value, P&L, XIRR and allocation.
// Everything stays in this browser; nothing is uploaded.
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Quote } from "@/lib/hive/data";
import { build, loadTrades, parseTradebook, saveTrades, xirr, type Trade } from "@/lib/hive/portfolio";
import { useOpenChart, useSnapshot } from "@/lib/hive/useSnapshot";
import { Icon } from "../ui";
import Toast, { toast } from "../terminal/Toast";
import AppShell, { Pct, num } from "./AppShell";

const inr = (v: number) => `${v < 0 ? "-" : ""}₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function PortfolioPage() {
  const open = useOpenChart();
  const snap = useSnapshot();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [ready, setReady] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [hide, setHide] = useState(false);
  const [view, setView] = useState<"holdings" | "trades">("holdings");
  const [adding, setAdding] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { setTrades(loadTrades()); setReady(true); }, []);
  const commit = (t: Trade[]) => { setTrades(t); saveTrades(t); };

  const { holdings, issues } = useMemo(() => build(trades), [trades]);
  const symbols = useMemo(() => holdings.map((h) => h.symbol).sort().join(","), [holdings]);
  useEffect(() => {
    if (!symbols) return;
    let alive = true;
    const load = () => api.quotes(symbols.split(",").map((s) => `NSE:${s}`)).then((q) => alive && setQuotes(q)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [symbols]);

  const industry = useMemo(() => {
    const m = new Map<string, string>();
    if (snap.status === "ready") for (const r of snap.snap.stocks) m.set(r.s, r.industry);
    return m;
  }, [snap]);

  const rows = useMemo(() => holdings.map((h) => {
    const q = quotes[`NSE:${h.symbol}`];
    const price = q?.price ?? null;
    const value = price != null ? price * h.qty : null;
    const flows: [number, number][] = [...h.flows];
    if (h.qty > 0 && value != null) flows.push([Date.now(), value]);
    const day = q?.change != null ? q.change * h.qty : null;
    return { ...h, price, value, pnl: value != null ? value - h.avg * h.qty : null, pnlPct: value != null && h.avg ? (price! / h.avg - 1) * 100 : null, day, xirr: h.qty > 0 ? xirr(flows) : null, ind: industry.get(h.symbol) || "Unclassified" };
  }), [holdings, quotes, industry]);

  const open_ = rows.filter((r) => r.qty > 0);
  const sum = useMemo(() => {
    const value = open_.reduce((s, r) => s + (r.value ?? r.avg * r.qty), 0);
    const invested = open_.reduce((s, r) => s + r.avg * r.qty, 0);
    const realised = rows.reduce((s, r) => s + r.realised, 0);
    const day = open_.reduce((s, r) => s + (r.day ?? 0), 0);
    const all = rows.flatMap((r) => r.flows);
    if (open_.length) all.push([Date.now(), value]);
    return { value, invested, realised, day, unreal: value - invested, xirr: xirr(all), priced: open_.every((r) => r.value != null) };
  }, [rows, open_]);

  const mask = (s: string) => (hide ? "••••" : s);
  const alloc = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of open_) by.set(r.ind, (by.get(r.ind) ?? 0) + (r.value ?? r.avg * r.qty));
    return [...by.entries()].sort((a, b) => b[1] - a[1]);
  }, [open_]);

  const onFile = async (f: File) => {
    let text: string;
    if (/\.xlsx?$/i.test(f.name)) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer());
      text = wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
    } else text = await f.text();
    const r = parseTradebook(text);
    if (r.error) return toast(r.error);
    // Re-importing the same tradebook shouldn't double up.
    const have = new Set(trades.map((t) => `${t.date}|${t.symbol}|${t.side}|${t.qty}|${t.price}`));
    const fresh = r.trades.filter((t) => !have.has(`${t.date}|${t.symbol}|${t.side}|${t.qty}|${t.price}`));
    commit([...trades, ...fresh]);
    toast(`${fresh.length} trades added${r.trades.length - fresh.length ? `, ${r.trades.length - fresh.length} already there` : ""}${r.skipped ? `, ${r.skipped} rows skipped` : ""}`);
  };

  if (!ready) return <AppShell><div /></AppShell>;
  return (
    <AppShell
      actions={
        <>
          <button className="icon-btn" onClick={() => setHide(!hide)} title={hide ? "Show amounts" : "Hide amounts (for screenshots)"}><Icon name={hide ? "eyeOff" : "eye"} /></button>
          {trades.length > 0 && <button className="btn border border-hive-line" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Add trade</button>}
          <button className="btn border border-hive-line" onClick={() => file.current?.click()}>Import tradebook</button>
        </>
      }
    >
      <Toast />
      {/* SOVA addition: this is Chart Hive's own scratch portfolio, not the user's SOVA holdings. */}
      <div className="border-b border-hive-line bg-hive-panel px-5 py-2 text-2xs text-hive-muted">
        Chart Hive portfolio: separate from your SOVA portfolio. Trades you add or import here stay in this browser and never change your SOVA holdings.
      </div>
      <input ref={file} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {trades.length === 0 ? (
        <Empty onImport={() => file.current?.click()} onAdd={() => setAdding(true)} onDrop={onFile} />
      ) : (
        <div className="mx-auto max-w-[1300px] space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Card label="Current value" value={mask(inr(sum.value))} sub={<>Today <span className={sum.day >= 0 ? "text-hive-up" : "text-hive-down"}>{mask(`${sum.day >= 0 ? "+" : ""}${inr(sum.day)}`)}</span></>} />
            <Card label="Invested" value={mask(inr(sum.invested))} />
            <Card label="Unrealised P&L" value={mask(inr(sum.unreal))} tone={sum.unreal} sub={sum.invested ? <Pct v={(sum.unreal / sum.invested) * 100} /> : null} />
            <Card label="Realised P&L" value={mask(inr(sum.realised))} tone={sum.realised} />
            <Card label="Total P&L" value={mask(inr(sum.unreal + sum.realised))} tone={sum.unreal + sum.realised} />
            <Card label="XIRR" value={sum.xirr != null ? `${sum.xirr.toFixed(1)}%` : "—"} tone={sum.xirr ?? 0} sub="annualised, all trades" />
          </div>

          {issues.length > 0 && (
            <div className="rounded-lg border border-[#ff9800]/40 bg-[#ff9800]/10 p-3">
              <div className="mb-1 font-semibold text-[#ffb300]">{issues.length} thing{issues.length > 1 ? "s" : ""} need a look</div>
              <ul className="list-disc pl-5 text-hive-muted">{issues.slice(0, 5).map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="rounded-lg border border-hive-line bg-hive-panel">
              <div className="flex gap-1 border-b border-hive-line p-2">
                <button className={`btn ${view === "holdings" ? "btn-on" : ""}`} onClick={() => setView("holdings")}>Holdings · {open_.length}</button>
                <button className={`btn ${view === "trades" ? "btn-on" : ""}`} onClick={() => setView("trades")}>Trades · {trades.length}</button>
                <div className="flex-1" />
                <button className="btn text-hive-down" onClick={() => { if (confirm("Remove every trade from this browser?")) commit([]); }}><Icon name="trash" size={15} /> Clear</button>
              </div>
              <div className="overflow-auto">
                {view === "holdings" ? (
                  <table className="w-full min-w-[820px] text-[12.5px]">
                    <thead className="text-2xs uppercase tracking-wide text-hive-muted"><tr><th className="px-4 py-2 text-left font-medium">Stock</th>{["Qty", "Avg cost", "Price", "Value", "P&L", "P&L %", "XIRR", "Weight"].map((h) => <th key={h} className="px-3 text-right font-medium">{h}</th>)}</tr></thead>
                    <tbody>
                      {[...open_].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((r) => (
                        <tr key={r.symbol} className="cursor-pointer border-t border-hive-line hover:bg-hive-hover" onClick={() => open(r.symbol)}>
                          <td className="px-4 py-1.5"><div className="font-semibold">{r.symbol}</div><div className="text-2xs text-hive-muted">{r.ind}</div></td>
                          <td className="tabular px-3 text-right">{mask(String(r.qty))}</td>
                          <td className="tabular px-3 text-right">{mask(num(r.avg))}</td>
                          <td className="tabular px-3 text-right">{num(r.price)}</td>
                          <td className="tabular px-3 text-right">{mask(r.value != null ? inr(r.value) : "—")}</td>
                          <td className={`tabular px-3 text-right ${(r.pnl ?? 0) >= 0 ? "text-hive-up" : "text-hive-down"}`}>{mask(r.pnl != null ? inr(r.pnl) : "—")}</td>
                          <td className="px-3 text-right"><Pct v={r.pnlPct} /></td>
                          <td className="px-3 text-right"><Pct v={r.xirr} /></td>
                          <td className="tabular px-3 text-right text-hive-muted">{sum.value && r.value ? ((r.value / sum.value) * 100).toFixed(1) : "—"}%</td>
                        </tr>
                      ))}
                      {open_.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-hive-muted">No open positions. Everything has been sold.</td></tr>}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[620px] text-[12.5px]">
                    <thead className="text-2xs uppercase tracking-wide text-hive-muted"><tr><th className="px-4 py-2 text-left font-medium">Date</th><th className="px-3 text-left font-medium">Stock</th><th className="px-3 text-left font-medium">Side</th><th className="px-3 text-right font-medium">Qty</th><th className="px-3 text-right font-medium">Price</th><th className="px-3 text-right font-medium">Amount</th><th /></tr></thead>
                    <tbody>
                      {[...trades].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                        <tr key={t.id} className="border-t border-hive-line hover:bg-hive-hover">
                          <td className="px-4 py-1.5 text-hive-muted">{t.date}</td><td className="px-3 font-semibold">{t.symbol}</td>
                          <td className={`px-3 ${t.side === "BUY" ? "text-hive-up" : "text-hive-down"}`}>{t.side}</td>
                          <td className="tabular px-3 text-right">{mask(String(t.qty))}</td><td className="tabular px-3 text-right">{mask(num(t.price))}</td><td className="tabular px-3 text-right">{mask(inr(t.qty * t.price))}</td>
                          <td className="px-3 text-right"><button className="icon-btn h-6 w-6" onClick={() => commit(trades.filter((x) => x.id !== t.id))} title="Delete trade"><Icon name="trash" size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-hive-line bg-hive-panel p-4">
              <h2 className="mb-3 font-semibold">Allocation by industry</h2>
              <div className="space-y-2">
                {alloc.map(([name, v]) => (
                  <div key={name}>
                    <div className="flex justify-between text-[12px]"><span className="truncate pr-2">{name}</span><span className="tabular text-hive-muted">{sum.value ? ((v / sum.value) * 100).toFixed(1) : 0}%</span></div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-hive-hover"><div className="h-full rounded bg-hive-accent" style={{ width: `${sum.value ? (v / sum.value) * 100 : 0}%` }} /></div>
                  </div>
                ))}
              </div>
              {snap.status !== "ready" && <div className="mt-3 text-2xs text-hive-muted">Industries load with the Nifty 500 data.</div>}
            </div>
          </div>
        </div>
      )}
      {adding && <AddTrade onCancel={() => setAdding(false)} onSave={(t) => { commit([...trades, t]); setAdding(false); }} />}
    </AppShell>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: number }) {
  return (
    <div className="rounded-lg border border-hive-line bg-hive-panel p-3">
      <div className="text-2xs uppercase tracking-wide text-hive-muted">{label}</div>
      <div className={`tabular mt-1 text-[19px] font-semibold ${tone == null || value.includes("•") ? "" : tone >= 0 ? "text-hive-up" : "text-hive-down"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-hive-muted">{sub}</div>}
    </div>
  );
}

function Empty({ onImport, onAdd, onDrop }: { onImport: () => void; onAdd: () => void; onDrop: (f: File) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div className="grid h-full place-items-center p-6">
      <div
        className={`w-full max-w-xl rounded-xl border-2 border-dashed p-10 text-center transition-colors ${over ? "border-hive-accent bg-hive-accent/5" : "border-hive-line"}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onDrop(f); }}
      >
        <h1 className="text-[22px] font-semibold">Every stock you own. One clear picture.</h1>
        <p className="mx-auto mt-2 max-w-md text-hive-muted">Drop your broker&apos;s tradebook (CSV or Excel) to see value, P&amp;L, XIRR and allocation. Works with Zerodha, Groww, Upstox, Angel One and similar exports.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn bg-hive-accent px-4 text-white hover:bg-hive-accent/90" onClick={onImport}>Upload tradebook</button>
          <button className="btn border border-hive-line px-4" onClick={onAdd}>Add a trade</button>
        </div>
        <p className="mt-5 text-2xs text-hive-muted">Only you can see your portfolio. Trades are saved in this browser and never uploaded.</p>
      </div>
    </div>
  );
}

function AddTrade({ onSave, onCancel }: { onSave: (t: Trade) => void; onCancel: () => void }) {
  const [f, setF] = useState({ symbol: "", side: "BUY" as Trade["side"], qty: "", price: "", date: today() });
  const ok = f.symbol.trim() && Number(f.qty) > 0 && Number(f.price) > 0 && f.date;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="w-[380px] max-w-[calc(100vw-32px)] space-y-3 rounded-lg border border-hive-line bg-hive-raised p-5 shadow-2xl shadow-black/50" onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ id: `m${Date.now().toString(36)}`, date: f.date, symbol: f.symbol.trim().toUpperCase().replace(/^NSE:/, ""), side: f.side, qty: Number(f.qty), price: Number(f.price) }); }}>
        <h2 className="text-[15px] font-semibold">Add a trade</h2>
        <input className="input w-full" placeholder="NSE ticker, e.g. RELIANCE" value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })} autoFocus />
        <div className="flex gap-2">
          {(["BUY", "SELL"] as const).map((s) => <button key={s} type="button" className={`btn flex-1 justify-center border border-hive-line ${f.side === s ? (s === "BUY" ? "bg-hive-up/20 text-hive-up" : "bg-hive-down/20 text-hive-down") : ""}`} onClick={() => setF({ ...f, side: s })}>{s}</button>)}
        </div>
        <div className="flex gap-2">
          <input className="input w-full" type="number" min="0" step="any" placeholder="Quantity" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
          <input className="input w-full" type="number" min="0" step="any" placeholder="Price ₹" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        </div>
        <input className="input w-full" type="date" value={f.date} max={today()} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn" onClick={onCancel}>Cancel</button><button className="btn bg-hive-accent text-white hover:bg-hive-accent/90" disabled={!ok}>Add</button></div>
      </form>
    </div>
  );
}
