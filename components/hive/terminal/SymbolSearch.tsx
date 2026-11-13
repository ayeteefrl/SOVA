"use client";
import { useEffect, useRef, useState } from "react";
import { api, type SearchResult } from "@/lib/hive/data";
import { Icon, Modal } from "../ui";
import ImportWatchlist from "./ImportWatchlist";

const TABS = [
  ["all", "All"],
  ["stock", "Stocks"],
  ["index", "Indices"],
  ["futures", "Futures"],
  ["option", "Options"],
  ["crypto", "Crypto"],
  ["fx", "Forex"],
] as const;

const typeOf = (r: SearchResult) => {
  const t = r.type.toLowerCase();
  if (/crypto|spot|perp/.test(t) || /BINANCE|COINBASE|KRAKEN/.test(r.exchange)) return "crypto";
  if (/forex|fx/.test(t) || r.exchange === "FX" || r.exchange === "OANDA") return "fx";
  if (/index/.test(t)) return "index";
  if (/fut/.test(t)) return "futures";
  if (/option/.test(t)) return "option";
  return "stock";
};

export default function SymbolSearch({ initial = "", title = "Symbol search", onPick, onClose, onImport }: { initial?: string; title?: string; onPick: (symbol: string) => void; onClose: () => void; onImport?: (dest: string, name: string, symbols: string[]) => void }) {
  const [q, setQ] = useState(initial);
  const [tab, setTab] = useState<string>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (!q.trim()) return setResults([]);
    setBusy(true);
    const t = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          setResults(r);
          setSel(0);
        })
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  const importing = tab === "import" && !!onImport;
  const shown = results.filter((r) => tab === "all" || typeOf(r) === tab);
  const choose = (r?: SearchResult) => {
    const sym = r?.symbol || q.trim().toUpperCase();
    if (sym) onPick(sym);
  };

  return (
    <Modal title={title} onClose={onClose} width={720}>
      <div className="flex items-center gap-2 border-b border-hive-line px-4">
        <Icon name="search" className="text-hive-muted" />
        <input
          ref={input}
          className="h-12 flex-1 bg-transparent text-[15px] outline-none"
          placeholder="Symbol, ISIN or name: RELIANCE, NIFTY, BANKNIFTY1!, BTCUSDT, AAPL"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(s + 1, shown.length - 1)));
            if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)));
            if (e.key === "Enter") choose(shown[sel]);
          }}
        />
        {busy && <span className="text-2xs text-hive-muted">searching…</span>}
      </div>
      <div className="flex gap-1 border-b border-hive-line px-3">
        {[...TABS, ...(onImport ? ([["import", "Import"]] as const) : [])].map(([id, name]) => (
          <button key={id} className={`tab ${tab === id ? "tab-on" : ""}`} onClick={() => setTab(id)}>
            {name}
          </button>
        ))}
      </div>
      {importing && <ImportWatchlist onCreate={onImport!} />}
      <div className={`h-[420px] overflow-auto py-1 ${importing ? "hidden" : ""}`}>
        {shown.map((r, i) => (
          <button key={r.symbol} className={`flex h-11 w-full items-center gap-3 px-4 text-left ${i === sel ? "bg-hive-hover" : "hover:bg-hive-hover"}`} onMouseEnter={() => setSel(i)} onClick={() => choose(r)}>
            <span className="w-44 shrink-0 truncate font-semibold">{r.symbol.split(":").pop()}</span>
            <span className="min-w-0 flex-1 truncate text-hive-muted">{r.name}</span>
            <span className="text-2xs text-hive-muted">{r.type}</span>
            <span className="w-16 text-right text-2xs font-semibold">{r.exchange}</span>
          </button>
        ))}
        {!shown.length && q.trim() && !busy && (
          <div className="p-6 text-center text-hive-muted">
            Nothing found. Press Enter to try <b className="text-hive-text">{q.trim().toUpperCase()}</b> anyway.
          </div>
        )}
        {!q.trim() && <div className="p-6 text-center text-hive-muted">Search NSE, BSE and MCX (stocks, indices, futures, options), crypto, US stocks, forex and global indices.</div>}
      </div>
    </Modal>
  );
}
