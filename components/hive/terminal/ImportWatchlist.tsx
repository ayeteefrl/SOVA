"use client";
// Turns a CSV, Excel sheet, text list or a screenshot of a watchlist into symbols we can chart.
import { useEffect, useRef, useState } from "react";
import { api, ticker } from "@/lib/hive/data";
import { useStore } from "@/lib/hive/store";

type Row = { token: string; symbol: string | null; name?: string; on: boolean; fuzzy?: boolean; candidates?: { symbol: string; name: string }[] };

const HEADER = /^(symbol|symbols|ticker|tickers|scrip|script|instrument|stock|stocks|security|code|name|company)$/i;
const SKIP = new Set(["SYMBOL", "SYMBOLS", "TICKER", "NAME", "LAST", "CHG", "CHG%", "CHANGE", "PRICE", "WATCHLIST", "WATCHLISTS", "LTP", "VOLUME", "OPEN", "HIGH", "LOW", "CLOSE", "QTY", "TOTAL", "INDICES", "STOCKS", "FUTURES", "FOREX", "CRYPTO", "ALL", "NSE", "BSE", "MCX", "THE", "AND", "NA", "N/A", "NULL"]);

// "reliance.ns", "RELIANCE-EQ", "nse:tcs" -> clean ticker (exchange prefix kept when given).
function clean(raw: string): string | null {
  let s = String(raw ?? "").trim().toUpperCase();
  if (!s || s.length > 30) return null;
  s = s.replace(/^["'`\s]+|["'`,;\s]+$/g, "");
  // A name cut short by the panel width ends in "…" or "..."; keep that mark so the server can offer completions.
  const cut = /(…|\.{2,})$/.test(s);
  if (cut) {
    const base = s.replace(/(…|\.{2,})$/, "");
    return base.length >= 2 && /^([A-Z]+:)?[A-Z0-9&^_\-]{2,24}$/.test(base) && !SKIP.has(base) ? `${base}…` : null;
  }
  s = s.replace(/\.(NS|BO)$/, "").replace(/-(EQ|BE|SM)$/, "");
  if (!/^([A-Z]+:)?[A-Z0-9&^_.\-!]{1,24}$/.test(s)) return null;
  if (!/[A-Z]/.test(s)) return null; // pure numbers are prices, not symbols
  if (SKIP.has(s)) return null;
  return s;
}

function fromTable(rows: unknown[][]): string[] {
  const grid = rows.map((r) => r.map((c) => String(c ?? "").trim()));
  // A header row such as "Symbol" tells us exactly which column holds the tickers.
  for (let r = 0; r < Math.min(grid.length, 6); r++) {
    const c = grid[r].findIndex((cell) => HEADER.test(cell));
    if (c >= 0) {
      const col = grid.slice(r + 1).map((row) => row[c]);
      const out = col.map(clean).filter(Boolean) as string[];
      if (out.length) return out;
    }
  }
  // TradingView exports are one long comma-separated line ("###Section,NSE:TCS,NSE:INFY"), so read every cell.
  const out: string[] = [];
  for (const row of grid) for (const cell of row) for (const part of cell.split(/[\s,;|]+/)) {
    const t = clean(part.replace(/^#+/, ""));
    if (t) out.push(t);
  }
  return out;
}

// OCR reads big, dark-on-light text best: scale small screenshots up, go greyscale, flip dark themes, stretch contrast.
async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(3, Math.max(1, 2200 / bmp.width));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, 0, 0, c.width, c.height);
  const px = g.getImageData(0, 0, c.width, c.height);
  const d = px.data;
  const grey = new Uint8ClampedArray(d.length / 4);
  let sum = 0;
  for (let i = 0; i < grey.length; i++) sum += grey[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
  const invert = sum / grey.length < 128;
  const sorted = Uint8ClampedArray.from(grey).sort();
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.floor(sorted.length * 0.98)];
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < grey.length; i++) {
    let v = Math.max(0, Math.min(255, ((grey[i] - lo) * 255) / range));
    if (invert) v = 255 - v;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  g.putImageData(px, 0, 0);
  return c;
}

async function tokensFromFile(file: File, progress: (s: string) => void): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/.test(name)) {
    progress("Cleaning up the screenshot…");
    const img = await prepareImage(file);
    progress("Reading the screenshot (first run downloads the text model)…");
    const { createWorker } = await import("tesseract.js");
    // Self-hosted (public/hive/tesseract) instead of tesseract.js's CDN defaults, so the /charts CSP stays 'self'.
    // Same engine (LSTM, the default) and the same English model as before.
    const worker = await createWorker("eng", 1, {
      workerPath: "/hive/tesseract/worker.min.js",
      corePath: "/hive/tesseract",
      langPath: "/hive/tesseract/lang",
      workerBlobURL: false,
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: "6" as never, preserve_interword_spaces: "1" });
      const { data } = await worker.recognize(img);
      // Symbols sit in one left-hand column: take each line's first word, then keep only the ones lined up with that column.
      const firsts: { t: string; x: number }[] = [];
      for (const line of data.lines || []) {
        for (const w of line.words || []) {
          const t = clean(w.text.replace(/[|\/]+$/, ""));
          if (t && t.length >= 2 && w.confidence >= 40) firsts.push({ t, x: w.bbox.x0 });
          if (t || w.text.trim().length > 1) break; // the first real word is the symbol; the rest are prices
        }
      }
      if (!firsts.length) return [];
      const xs = firsts.map((f) => f.x).sort((a, b) => a - b);
      const med = xs[Math.floor(xs.length / 2)];
      const tol = img.width * 0.08;
      return firsts.filter((f) => Math.abs(f.x - med) <= tol).map((f) => f.t);
    } finally {
      await worker.terminate();
    }
  }
  if (/\.(xlsx|xls|xlsm|ods)$/.test(name)) {
    progress("Reading the spreadsheet…");
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const out: string[] = [];
    for (const sn of wb.SheetNames) out.push(...fromTable(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, blankrows: false })));
    return out;
  }
  // Plain text: one symbol per line, or separated by commas.
  const text = await file.text();
  return fromTable(text.split(/\r?\n/).map((l) => l.split(/\t|,/)));
}

async function resolveAll(tokens: string[], progress: (s: string) => void): Promise<Row[]> {
  const uniq = [...new Set(tokens)];
  progress("Matching symbols…");
  // NSE / BSE first: exact tickers, then the closest spelling, which repairs most OCR slips.
  const india = await api.match(uniq).catch(() => []);
  const rows: Row[] = uniq.map((token, i) => {
    const m = india[i];
    // Guesses on very short tickers are too risky to tick by default.
    if (m?.prefix) return { token, symbol: m.symbol, name: m.name, candidates: m.candidates, on: !!m.symbol };
    return { token, symbol: m?.symbol ?? null, name: m?.name, fuzzy: m?.fuzzy, on: !!m?.symbol && !(m.fuzzy && token.length <= 4) };
  });
  // Anything left (US stocks, crypto, forex) goes through the general search for an exact ticker match.
  // A near-miss Indian match is only a guess, so check it here too (AAPL must not become AEPL).
  const rest = rows.map((r, i) => i).filter((i) => !rows[i].symbol || rows[i].fuzzy);
  let next = 0;
  let done = 0;
  const work = async () => {
    while (next < rest.length) {
      const i = rest[next++];
      const token = rows[i].token;
      try {
        const res = await api.search(token);
        const bare = token.split(":").pop()!;
        const hit = res.find((r) => r.symbol.toUpperCase() === token) || res.find((r) => ticker(r.symbol).toUpperCase() === bare && r.type !== "option");
        if (hit) rows[i] = { token, symbol: hit.symbol, name: hit.name, on: true };
      } catch {
        /* leave unresolved */
      }
      progress(`Matching symbols… ${++done}/${rest.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  return rows;
}

export default function ImportWatchlist({ onCreate }: { onCreate: (dest: string, name: string, symbols: string[]) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("Imported");
  const [drag, setDrag] = useState(false);
  const lists = useStore((s) => s.lists);
  const activeList = useStore((s) => s.activeList);
  const [dest, setDest] = useState("new");
  const input = useRef<HTMLInputElement>(null);

  const load = async (file: File) => {
    setError("");
    setRows(null);
    try {
      const tokens = await tokensFromFile(file, setStatus);
      if (!tokens.length) throw new Error("No symbols found in that file.");
      const base = file.name.replace(/\.[^.]+$/, "");
      if (base && !/^(image|screenshot|screen shot|capture)/i.test(base)) setName(base.slice(0, 30));
      setRows(await resolveAll(tokens, setStatus));
    } catch (e) {
      setError((e as Error).message || "Couldn't read that file.");
    } finally {
      setStatus("");
    }
  };

  // Paste a screenshot straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
      if (f) load(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const picked = rows?.filter((r) => r.on && r.symbol) ?? [];

  return (
    <div className="flex h-[420px] flex-col">
      {!rows ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <div
            className={`flex w-full max-w-md cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center ${drag ? "border-hive-accent bg-hive-accent/10" : "border-hive-line"}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) load(f);
            }}
          >
            <div className="font-semibold">{status || "Drop a file or a screenshot here"}</div>
            {!status && (
              <div className="text-hive-muted">
                CSV, Excel (.xlsx, .xls), text list, or an image of your watchlist.
                <br />
                You can also paste a screenshot with Ctrl+V.
              </div>
            )}
          </div>
          <input ref={input} type="file" hidden accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,image/*" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          {error && <div className="mt-3 text-hive-down">{error}</div>}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-hive-line px-4 py-2">
            <span className="text-hive-muted">Add to</span>
            <select className="input w-44" value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="new">A new watchlist</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.id === activeList ? " (current)" : ""}
                </option>
              ))}
            </select>
            {dest === "new" && (
              <>
                <span className="text-hive-muted">Name</span>
                <input className="input w-36" value={name} onChange={(e) => setName(e.target.value)} />
              </>
            )}
            <span className="ml-auto text-2xs text-hive-muted">
              {picked.length} of {rows.length} matched
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto py-1">
            {rows.map((r, i) => (
              <label key={r.token} className={`flex h-9 items-center gap-3 px-4 ${r.symbol ? "cursor-pointer hover:bg-hive-hover" : "opacity-60"}`}>
                <input type="checkbox" className="accent-[rgb(var(--hive-accent))]" disabled={!r.symbol} checked={r.on} onChange={(e) => setRows((rs) => rs!.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
                <span className="w-40 shrink-0 truncate font-semibold">{r.symbol ? r.symbol : r.token}</span>
                {r.candidates && r.candidates.length > 1 ? (
                  <select
                    className="input h-7 min-w-0 flex-1 text-[13px]"
                    value={r.symbol ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const c = r.candidates!.find((x) => x.symbol === e.target.value);
                      setRows((rs) => rs!.map((x, j) => (j === i ? { ...x, symbol: c?.symbol ?? null, name: c?.name, on: !!c } : x)));
                    }}
                  >
                    <option value="">{`“${r.token}” was cut off. Pick one`}</option>
                    {r.candidates.map((c) => (
                      <option key={c.symbol} value={c.symbol}>
                        {c.symbol.split(":")[1]} · {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-hive-muted">{r.symbol ? r.name : r.candidates ? "No match" : "Not found"}</span>
                )}
                {r.fuzzy && <span className="shrink-0 text-2xs text-hive-muted" title="Closest match to what was read">read as “{r.token}”</span>}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t border-hive-line px-4 py-3">
            <button className="btn" onClick={() => setRows(null)}>
              Back
            </button>
            <button className="btn bg-hive-accent px-3 text-white hover:bg-hive-accent/90" disabled={!picked.length} onClick={() => onCreate(dest, name.trim() || "Imported", picked.map((r) => r.symbol!))}>
              {dest === "new" ? "Create watchlist" : "Add to watchlist"} ({picked.length})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
