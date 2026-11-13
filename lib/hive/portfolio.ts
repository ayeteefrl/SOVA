// Portfolio maths: read a broker tradebook, build holdings (average cost), realised P&L and XIRR.
import { hiveKey } from "./user";
export type Trade = { id: string; date: string; symbol: string; side: "BUY" | "SELL"; qty: number; price: number };
export type Holding = { symbol: string; qty: number; avg: number; invested: number; realised: number; firstBuy: string; flows: [number, number][]; sold: number };

// ---------- reading a tradebook ----------
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t") (row.push(cell), (cell = ""));
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s); // day first, as Indian brokers write it
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{1,2})[-/ ]([A-Za-z]{3})[a-z]*[-/ ,]+(\d{4})/.exec(s);
  if (m && MONTHS.includes(m[2].toLowerCase())) return `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const num = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

// Works with Zerodha, Groww, Upstox, Angel One style exports: finds columns by name.
export function parseTradebook(text: string): { trades: Trade[]; skipped: number; error?: string } {
  const rows = splitCsv(text);
  const hi = rows.findIndex((r) => r.some((c) => /symbol|scrip|stock|instrument|ticker/i.test(c)) && r.some((c) => /qty|quantity/i.test(c)));
  if (hi < 0) return { trades: [], skipped: 0, error: "Couldn't find a header row with a symbol and a quantity column." };
  const head = rows[hi].map((h) => h.trim().toLowerCase());
  const col = (...res: RegExp[]) => { for (const re of res) { const i = head.findIndex((h) => re.test(h)); if (i >= 0) return i; } return -1; };
  const ci = {
    sym: col(/^symbol$/, /^(scrip|ticker|instrument)/, /stock/),
    date: col(/trade.?date/, /execution.?date/, /^date/, /date/),
    side: col(/trade.?type/, /^type$/, /buy.?\/?sell/, /side/, /transaction/),
    qty: col(/^quantity$/, /^qty$/, /qty|quantity/),
    price: col(/^price$/, /trade.?price/, /avg|rate/),
    value: col(/^value$/, /amount|net.?total/),
  };
  if (ci.sym < 0 || ci.qty < 0 || ci.side < 0 || ci.date < 0 || (ci.price < 0 && ci.value < 0)) return { trades: [], skipped: 0, error: "Needs columns for symbol, date, buy/sell, quantity and price." };
  const trades: Trade[] = [];
  let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const side = /sell|^s$/i.test(r[ci.side] || "") ? "SELL" : /buy|^b$/i.test(r[ci.side] || "") ? "BUY" : null;
    const date = parseDate(r[ci.date] || "");
    const qty = Math.abs(num(r[ci.qty]));
    let price = ci.price >= 0 ? num(r[ci.price]) : NaN;
    if (!(price > 0) && ci.value >= 0 && qty) price = Math.abs(num(r[ci.value])) / qty;
    const symbol = (r[ci.sym] || "").trim().toUpperCase().replace(/-(EQ|BE|BZ|SM)$/, "").replace(/^(NSE|BSE):/, "");
    if (!side || !date || !(qty > 0) || !(price > 0) || !symbol) { skipped++; continue; }
    trades.push({ id: `${date}-${symbol}-${trades.length}-${Math.random().toString(36).slice(2, 6)}`, date, symbol, side, qty, price });
  }
  return { trades, skipped };
}

// ---------- holdings ----------
export function build(trades: Trade[]) {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map<string, Holding>();
  const issues: string[] = [];
  for (const t of sorted) {
    const h = map.get(t.symbol) ?? { symbol: t.symbol, qty: 0, avg: 0, invested: 0, realised: 0, firstBuy: t.date, flows: [], sold: 0 };
    map.set(t.symbol, h);
    if (t.side === "BUY") {
      h.invested += t.qty * t.price;
      h.qty += t.qty;
      h.avg = h.invested / h.qty;
      h.flows.push([Date.parse(t.date), -t.qty * t.price]);
    } else {
      const q = Math.min(t.qty, h.qty);
      if (q < t.qty) issues.push(`${t.symbol}: sold ${t.qty} on ${t.date} but only ${q} on record. Add the missing buy.`);
      h.realised += (t.price - h.avg) * q;
      h.invested -= h.avg * q;
      h.qty -= q;
      h.sold += q * t.price;
      h.flows.push([Date.parse(t.date), t.qty * t.price]);
    }
  }
  return { holdings: [...map.values()], issues };
}

// Annualised return of dated cash flows (negative = money in), found by bisection.
export function xirr(flows: [number, number][]): number | null {
  if (flows.length < 2 || !flows.some((f) => f[1] < 0) || !flows.some((f) => f[1] > 0)) return null;
  const t0 = Math.min(...flows.map((f) => f[0]));
  const npv = (r: number) => flows.reduce((s, [t, v]) => s + v / Math.pow(1 + r, (t - t0) / (365 * 864e5)), 0);
  let lo = -0.99, hi = 100;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
  }
  const r = (lo + hi) / 2;
  return Number.isFinite(r) ? r * 100 : null;
}

export const KEY = "chart-hive.portfolio.v1";
export const loadTrades = (): Trade[] => { try { return JSON.parse(localStorage.getItem(hiveKey(KEY)) || "[]"); } catch { return []; } };
export const saveTrades = (t: Trade[]) => { try { localStorage.setItem(hiveKey(KEY), JSON.stringify(t)); } catch { /* blocked */ } };
