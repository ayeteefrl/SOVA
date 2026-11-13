"use client";
// Company filings from NSE: announcements, the results / board-meeting calendar, and bulk / block deals.
import { useEffect, useMemo, useState } from "react";
import { api, type Announcement, type AnnouncementsResponse, type CalendarResponse, type CalendarRow, type Deal, type DealsResponse } from "@/lib/hive/data";
import { addRule, useAlerts } from "@/lib/hive/alerts";
import { toWatchlist, useOpenChart } from "@/lib/hive/useSnapshot";
import { Icon } from "../ui";
import Toast from "../terminal/Toast";
import AlertsTab from "./AlertsTab";
import AppShell, { ErrorBox, num } from "./AppShell";
import { Seg } from "./MarketPage";
import ResultsTab from "./ResultsTab";
import ShareholdingTab from "./ShareholdingTab";
import { IST, card, dayLabel, useLoad, when } from "./filingsKit";

type Tab = "ann" | "alerts" | "cal" | "res" | "deals" | "hold";
const TABS = ["ann", "alerts", "cal", "res", "deals", "hold"] as const;

export default function FilingsPage() {
  const [tab, setTab] = useState<Tab>("ann");
  const [onlyN500, setOnlyN500] = useState(true);
  const { unread } = useAlerts();
  const TAB_LABELS = { ann: "Announcements", alerts: unread ? `Alerts (${unread})` : "Alerts", cal: "Results calendar", res: "Results & fundamentals", deals: "Bulk & block deals", hold: "Shareholding" };
  return (
    <AppShell>
      <Toast />
      <div className="mx-auto max-w-[1400px] space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold">Filings &amp; deals</h1>
            <p className="text-hive-muted">What companies told the exchange, who reports results when, and the big trades, straight from NSE.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-hive-muted">
              <input type="checkbox" className="accent-[rgb(var(--hive-accent))]" checked={onlyN500} onChange={(e) => setOnlyN500(e.target.checked)} />
              Nifty 500 only
            </label>
            <Seg value={tab} options={TABS} labels={TAB_LABELS} onChange={setTab} />
          </div>
        </div>
        {tab === "ann" && <Announcements onlyN500={onlyN500} />}
        {tab === "alerts" && <AlertsTab onlyN500={onlyN500} />}
        {tab === "cal" && <Calendar onlyN500={onlyN500} />}
        {tab === "res" && <ResultsTab />}
        {tab === "deals" && <Deals onlyN500={onlyN500} />}
        {tab === "hold" && <ShareholdingTab onlyN500={onlyN500} />}
        <p className="text-2xs text-hive-muted">Source: NSE India public filings. NSE publishes bulk and block deals for the latest session only; this app saves each day it sees, so history builds up from the first day you open this page. Shareholding shows promoter and public holding only: NSE&apos;s feed doesn&apos;t break out FII, DII or pledged shares.</p>
      </div>
    </AppShell>
  );
}

// ---------- announcements ----------
const GROUPS: { id: string; label: string; test: (c: string) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "call", label: "Concalls & meets", test: (c) => /call|meet|presentation|transcript/i.test(c) },
  { id: "board", label: "Board outcomes", test: (c) => /outcome of board|financial result|dividend|buyback|bonus|split|fund raising/i.test(c) },
  { id: "mgmt", label: "Management changes", test: (c) => /resignation|appointment|cessation|change in management|director|kmp/i.test(c) },
  { id: "deal", label: "Deals, orders & takeovers", test: (c) => /order|acquisition|takeover|amalgamation|scheme|agreement|award|contract/i.test(c) },
  { id: "news", label: "Press & clarifications", test: (c) => /press release|newspaper|clarification|updates/i.test(c) },
];

function Announcements({ onlyN500 }: { onlyN500: boolean }) {
  const [days, setDays] = useState(2);
  const [group, setGroup] = useState("all");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(200);
  const [notice, setNotice] = useState("");
  const open = useOpenChart();
  const { data, error } = useLoad<AnnouncementsResponse>(() => api.announcements(days), `ann${days}`);

  const base = useMemo(() => (data?.rows ?? []).filter((r) => !onlyN500 || r.n500), [data, onlyN500]);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of base) m.set(r.category, (m.get(r.category) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [base]);
  const rows = useMemo(() => {
    const g = GROUPS.find((x) => x.id === group)!;
    const s = q.trim().toLowerCase();
    const kept = base.filter((r) => g.test(r.category) && (!cat || r.category === cat) && (!s || `${r.symbol} ${r.name} ${r.category} ${r.text}`.toLowerCase().includes(s)));
    // Companies often file the same notice several times in a row: show the latest once, with a count.
    const merged = new Map<string, Announcement & { count: number }>();
    for (const r of kept) {
      const k = `${r.symbol}|${r.category}|${r.text}`;
      const hit = merged.get(k);
      if (hit) hit.count++;
      else merged.set(k, { ...r, count: 1 });
    }
    return [...merged.values()];
  }, [base, group, cat, q]);
  useEffect(() => setShown(200), [group, cat, q, days, onlyN500]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.map((g) => (
          <button key={g.id} className={`btn px-2.5 ${group === g.id ? "btn-on" : ""}`} onClick={() => (setGroup(g.id), setCat(""))}>
            {g.label}
            {data && g.id !== "all" && <span className="ml-1.5 text-2xs text-hive-muted">{base.filter((r) => g.test(r.category)).length}</span>}
          </button>
        ))}
        <div className="flex-1" />
        <select className="input max-w-[260px]" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">Every category ({cats.length})</option>
          {cats.map(([c, n]) => (
            <option key={c} value={c}>{c} ({n})</option>
          ))}
        </select>
        <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={1}>Today</option>
          <option value={2}>Last 2 days</option>
          <option value={3}>Last 3 days</option>
          <option value={7}>Last 7 days</option>
        </select>
        <input className="input w-52" placeholder="Search company or text" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn"
          disabled={!q.trim()}
          title="Get notified when a new filing mentions this"
          onClick={() => {
            addRule([q.trim()], onlyN500);
            setNotice(`Alert created for "${q.trim()}". New matching filings will show on the Alerts tab.`);
          }}
        >
          <Icon name="alert" size={15} /> Alert me
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
            {rows.length.toLocaleString("en-IN")} announcements (repeat filings merged) · {data.from} to {data.to}
          </div>
          {!rows.length ? (
            <div className="p-8 text-center text-hive-muted">Nothing matches these filters.</div>
          ) : (
            <ul className="divide-y divide-hive-line">
              {rows.slice(0, shown).map((r) => (
                <AnnouncementRow key={r.id} r={r} onOpen={() => open(r.symbol)} />
              ))}
            </ul>
          )}
          {rows.length > shown && (
            <div className="border-t border-hive-line p-3 text-center">
              <button className="btn" onClick={() => setShown((n) => n + 300)}>Show more ({rows.length - shown} left)</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AnnouncementRow({ r, onOpen }: { r: Announcement & { count: number }; onOpen: () => void }) {
  return (
    <li className="flex gap-3 px-3 py-2.5 hover:bg-hive-hover">
      <div className="tabular w-[92px] shrink-0 pt-0.5 text-[12px] text-hive-muted">{when(r.t)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button className="font-semibold text-hive-accent hover:underline" onClick={onOpen} title="Open chart">{r.symbol}</button>
          <span className="truncate text-hive-muted">{r.name}</span>
          <span className="rounded bg-hive-hover px-1.5 py-0.5 text-2xs text-hive-muted">{r.category}</span>
          {r.count > 1 && <span className="rounded bg-hive-hover px-1.5 py-0.5 text-2xs text-hive-accent" title="The same notice was filed this many times">×{r.count}</span>}
        </div>
        {r.text && <div className="mt-0.5 text-[12.5px]">{r.text}</div>}
      </div>
      {r.file && (
        <a className="btn h-7 shrink-0 self-center px-2 text-[12px]" href={r.file} target="_blank" rel="noreferrer" title={r.size ? `Open the filing (${r.size})` : "Open the filing"}>
          PDF
        </a>
      )}
    </li>
  );
}

// ---------- results / board-meeting calendar ----------
function Calendar({ onlyN500 }: { onlyN500: boolean }) {
  const [days, setDays] = useState(7);
  const [purpose, setPurpose] = useState("results");
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState("");
  const open = useOpenChart();
  const { data, error } = useLoad<CalendarResponse>(() => api.calendar(days), `cal${days}`);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => (!onlyN500 || r.n500) && (purpose === "all" || (purpose === "results" ? /result/i.test(r.purpose) : !/result/i.test(r.purpose))) && (!s || `${r.symbol} ${r.name} ${r.desc}`.toLowerCase().includes(s)));
  }, [data, onlyN500, purpose, q]);
  const byDay = useMemo(() => {
    const m = new Map<number, CalendarRow[]>();
    for (const r of rows) m.set(r.date, [...(m.get(r.date) || []), r]);
    return [...m.entries()];
  }, [rows]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={purpose} options={["results", "other", "all"] as const} labels={{ results: "Results", other: "Other meetings", all: "All" }} onChange={setPurpose} />
        <div className="flex-1" />
        <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Next 7 days</option>
          <option value={14}>Next 14 days</option>
          <option value={30}>Next 30 days</option>
        </select>
        <input className="input w-52" placeholder="Search company" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn"
          disabled={!rows.length}
          onClick={() => {
            const syms = [...new Set(rows.map((r) => r.symbol))];
            toWatchlist("Results due", syms);
            setNotice(`Added ${syms.length} to a new watchlist "Results due". Open it on the Charts page.`);
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
      ) : !byDay.length ? (
        <div className={`${card} p-8 text-center text-hive-muted`}>No meetings match these filters.</div>
      ) : (
        <div className="space-y-4">
          {byDay.map(([date, list]) => (
            <div key={date} className={card}>
              <div className="flex items-center justify-between border-b border-hive-line px-3 py-2">
                <span className="font-semibold">{dayLabel(date)}</span>
                <span className="text-2xs text-hive-muted">{list.length} {list.length === 1 ? "company" : "companies"}</span>
              </div>
              <ul className="divide-y divide-hive-line">
                {list.map((r) => (
                  <li key={`${r.symbol}-${r.date}-${r.purpose}`} className="flex gap-3 px-3 py-2 hover:bg-hive-hover">
                    <button className="w-28 shrink-0 text-left font-semibold text-hive-accent hover:underline" onClick={() => open(r.symbol)} title="Open chart">{r.symbol}</button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate">{r.name}</span>
                        <span className="rounded bg-hive-hover px-1.5 py-0.5 text-2xs text-hive-muted">{r.purpose}</span>
                      </div>
                      {r.desc && <div className="mt-0.5 line-clamp-2 text-[12px] text-hive-muted" title={r.desc}>{r.desc}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- bulk / block / short-selling deals ----------
type Kind = Deal["kind"];
type SortKey = "valueCr" | "qty" | "price" | "symbol";

function Deals({ onlyN500 }: { onlyN500: boolean }) {
  const [days, setDays] = useState(1);
  const [kind, setKind] = useState<Kind>("bulk");
  const [side, setSide] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "valueCr", dir: -1 });
  const open = useOpenChart();
  const { data, error } = useLoad<DealsResponse>(() => api.deals(days), `deals${days}`);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (data?.rows ?? []).filter((r) => r.kind === kind && (!onlyN500 || r.n500) && (kind === "short" || side === "all" || r.side === side) && (!s || `${r.symbol} ${r.name} ${r.client}`.toLowerCase().includes(s)));
    const get = (r: Deal) => (sort.key === "symbol" ? r.symbol : (r[sort.key] ?? -Infinity));
    return list.sort((a, b) => {
      const x = get(a), y = get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [data, kind, onlyN500, side, q, sort]);

  const totals = useMemo(() => {
    let buy = 0, sell = 0;
    for (const r of rows) if (r.side === "BUY") buy += r.valueCr ?? 0;
    else if (r.side === "SELL") sell += r.valueCr ?? 0;
    return { buy, sell };
  }, [rows]);

  const Th = ({ k, children, left }: { k: SortKey; children: string; left?: boolean }) => (
    <th className={`cursor-pointer select-none px-3 py-2 font-medium hover:text-hive-text ${left ? "text-left" : "text-right"}`} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : k === "symbol" ? 1 : -1 }))}>
      {children}
      {sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={kind} options={["bulk", "block", "short"] as const} labels={{ bulk: "Bulk deals", block: "Block deals", short: "Short selling" }} onChange={setKind} />
        {kind !== "short" && <Seg value={side} options={["all", "BUY", "SELL"] as const} labels={{ all: "Buy & sell", BUY: "Buy", SELL: "Sell" }} onChange={setSide} />}
        <div className="flex-1" />
        <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={1}>Latest session</option>
          <option value={5}>Last 5 saved sessions</option>
          <option value={20}>Last 20 saved sessions</option>
        </select>
        <input className="input w-52" placeholder="Search stock or client" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? (
        <ErrorBox message={error} />
      ) : !data ? (
        <div className="h-64 animate-pulse rounded-lg bg-hive-panel" />
      ) : (
        <div className={card}>
          <div className="flex flex-wrap items-center gap-x-4 border-b border-hive-line px-3 py-2 text-[12px] text-hive-muted">
            <span>{rows.length.toLocaleString("en-IN")} rows · {data.days.length} {data.days.length === 1 ? "session" : "sessions"} ({data.days.map((d) => dayLabel(d)).join(", ")})</span>
            {kind !== "short" && (
              <span>
                Bought <span className="tabular text-hive-up">₹{num(totals.buy, 0)} cr</span> · Sold <span className="tabular text-hive-down">₹{num(totals.sell, 0)} cr</span>
              </span>
            )}
          </div>
          {!rows.length ? (
            <div className="p-8 text-center text-hive-muted">No {kind === "short" ? "short-selling disclosures" : `${kind} deals`} match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-hive-panel text-2xs uppercase tracking-wide text-hive-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <Th k="symbol" left>Stock</Th>
                    {kind !== "short" && <th className="px-3 py-2 text-left font-medium">Client</th>}
                    {kind !== "short" && <th className="px-3 py-2 text-left font-medium">Side</th>}
                    <Th k="qty">Quantity</Th>
                    {kind !== "short" && <Th k="price">Avg price ₹</Th>}
                    {kind !== "short" && <Th k="valueCr">Value ₹ cr</Th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hive-line">
                  {rows.slice(0, 500).map((r, i) => (
                    <tr key={`${r.symbol}-${r.client}-${r.date}-${r.side}-${i}`} className="hover:bg-hive-hover">
                      <td className="tabular whitespace-nowrap px-3 py-1.5 text-hive-muted">{new Date(r.date).toLocaleDateString("en-IN", { timeZone: IST, day: "2-digit", month: "short" })}</td>
                      <td className="px-3 py-1.5">
                        <button className="font-semibold text-hive-accent hover:underline" onClick={() => open(r.symbol)}>{r.symbol}</button>
                        <span className="ml-2 text-hive-muted">{r.name}</span>
                      </td>
                      {kind !== "short" && <td className="max-w-[300px] truncate px-3 py-1.5" title={r.client}>{r.client}</td>}
                      {kind !== "short" && <td className={`px-3 py-1.5 font-medium ${r.side === "BUY" ? "text-hive-up" : "text-hive-down"}`}>{r.side}</td>}
                      <td className="tabular px-3 py-1.5 text-right">{r.qty.toLocaleString("en-IN")}</td>
                      {kind !== "short" && <td className="tabular px-3 py-1.5 text-right">{num(r.price)}</td>}
                      {kind !== "short" && <td className="tabular px-3 py-1.5 text-right">{num(r.valueCr)}</td>}
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
