"use client";
// Keyword alerts on NSE announcements: set the words, and new matching filings show up here, in the nav bar badge and (if allowed) as desktop notifications.
import { useEffect, useMemo, useState } from "react";
import { api, type AnnouncementsResponse } from "@/lib/hive/data";
import { addRule, checkNow, clearHits, markAllRead, matchesRule, parseWords, removeRule, useAlerts } from "@/lib/hive/alerts";
import { useOpenChart } from "@/lib/hive/useSnapshot";
import { Icon } from "../ui";
import { card, useLoad, when } from "./filingsKit";

const IDEAS = ["order win", "buyback", "bonus", "acquisition", "resignation", "preferential", "fund raising", "capacity expansion", "stake"];

export default function AlertsTab({ onlyN500 }: { onlyN500: boolean }) {
  const { rules, hits, unread, checking, lastCheck } = useAlerts();
  const [input, setInput] = useState("");
  const [n500Only, setN500Only] = useState(onlyN500);
  const [perm, setPerm] = useState<string>("default");
  const open = useOpenChart();
  const { data } = useLoad<AnnouncementsResponse>(() => api.announcements(7), "ann7");

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const words = useMemo(() => parseWords(input), [input]);
  // A sanity check before you commit: how many filings in the last week would this have caught?
  const preview = useMemo(() => (words.length && data ? data.rows.filter((r) => matchesRule({ words, n500Only }, r)) : null), [words, n500Only, data]);

  const create = () => {
    if (!words.length) return;
    addRule(words, n500Only);
    setInput("");
  };
  const ask = async () => setPerm(await Notification.requestPermission());
  const ruleName = (id: string) => rules.find((r) => r.id === id)?.words.join(", ") ?? "";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className={`${card} space-y-3 p-3`}>
          <div>
            <div className="font-semibold">New alert</div>
            <p className="mt-0.5 text-[12px] text-hive-muted">Words to look for in new NSE announcements. Separate several with commas: any one is enough. It checks the company, the category and the subject line.</p>
          </div>
          <input className="input w-full" placeholder="e.g. order win, buyback" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} aria-label="Alert words" />
          <div className="flex flex-wrap gap-1.5">
            {IDEAS.map((w) => (
              <button key={w} className="rounded bg-hive-hover px-1.5 py-0.5 text-2xs text-hive-muted hover:text-hive-text" onClick={() => setInput((v) => (parseWords(v).includes(w) ? v : v.trim() ? `${v.trim().replace(/,$/, "")}, ${w}` : w))}>
                + {w}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-hive-muted">
            <input type="checkbox" className="accent-[rgb(var(--hive-accent))]" checked={n500Only} onChange={(e) => setN500Only(e.target.checked)} />
            Nifty 500 companies only
          </label>
          {preview && (
            <div className="rounded border border-hive-line px-2 py-1.5 text-[12px] text-hive-muted">
              Would have caught <span className="font-semibold text-hive-text">{preview.length}</span> {preview.length === 1 ? "filing" : "filings"} in the last 7 days
              {preview[0] && (
                <>
                  , latest: <span className="text-hive-text">{preview[0].symbol}</span> {preview[0].category}
                </>
              )}
              .
            </div>
          )}
          <button className="btn w-full justify-center bg-hive-accent text-white hover:bg-hive-accent/90" disabled={!words.length} onClick={create}>
            <Icon name="alert" size={15} /> Create alert
          </button>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 font-semibold">Your alerts</div>
          {!rules.length ? (
            <p className="text-[12px] text-hive-muted">None yet. An alert only reports filings that arrive after you create it.</p>
          ) : (
            <ul className="space-y-2">
              {rules.map((r) => (
                <li key={r.id} className="flex items-start gap-2 rounded border border-hive-line px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1">
                      {r.words.map((w) => (
                        <span key={w} className="rounded bg-hive-accent/15 px-1.5 py-0.5 text-2xs font-semibold text-hive-accent">{w}</span>
                      ))}
                    </div>
                    <div className="mt-1 text-2xs text-hive-muted">
                      {r.n500Only ? "Nifty 500 only" : "All NSE companies"} · since {when(r.since)} · {hits.filter((h) => h.rule === r.id).length} found
                    </div>
                  </div>
                  <button className="icon-btn h-6 w-6" onClick={() => removeRule(r.id)} title="Delete alert">
                    <Icon name="trash" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 border-t border-hive-line pt-3 text-[12px] text-hive-muted">
            {perm === "granted" ? (
              <span className="text-hive-up">Desktop notifications are on.</span>
            ) : perm === "denied" ? (
              "Desktop notifications are blocked in this browser. Allow them in the site settings, or just watch the badge on the Filings link."
            ) : perm === "unsupported" ? (
              "This browser can't show desktop notifications. The badge on the Filings link still counts new matches."
            ) : (
              <button className="btn" onClick={ask}>Turn on desktop notifications</button>
            )}
            <p className="mt-2">Checks NSE every 3 minutes while any Chart Hive page is open. Close the browser and checks stop; filings that came in meanwhile are picked up next time you open it (up to 7 days back).</p>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center gap-2 border-b border-hive-line px-3 py-2">
          <span className="font-semibold">Matches</span>
          <span className="text-[12px] text-hive-muted">{unread ? `${unread} new` : "nothing new"}{lastCheck ? ` · checked ${when(lastCheck)}` : ""}</span>
          <div className="flex-1" />
          <button className="btn h-7 px-2 text-[12px]" disabled={!rules.length || checking} onClick={() => void checkNow()}>{checking ? "Checking…" : "Check now"}</button>
          <button className="btn h-7 px-2 text-[12px]" disabled={!unread} onClick={markAllRead}>Mark all read</button>
          <button className="btn h-7 px-2 text-[12px]" disabled={!hits.length} onClick={clearHits}>Clear</button>
        </div>
        {!hits.length ? (
          <div className="p-8 text-center text-hive-muted">{rules.length ? "No matching filings yet. New ones will appear here the moment NSE publishes them." : "Create an alert to start."}</div>
        ) : (
          <ul className="divide-y divide-hive-line">
            {hits.map((h) => (
              <li key={h.key} className="flex gap-3 px-3 py-2.5 hover:bg-hive-hover">
                <div className="flex w-[92px] shrink-0 items-start gap-1.5 pt-0.5 text-[12px] text-hive-muted">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${h.read ? "bg-transparent" : "bg-hive-accent"}`} aria-label={h.read ? "Read" : "New"} />
                  <span className="tabular">{when(h.t)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="font-semibold text-hive-accent hover:underline" onClick={() => open(h.symbol)} title="Open chart">{h.symbol}</button>
                    <span className="truncate text-hive-muted">{h.name}</span>
                    <span className="rounded bg-hive-hover px-1.5 py-0.5 text-2xs text-hive-muted">{h.category}</span>
                    <span className="rounded bg-hive-accent/15 px-1.5 py-0.5 text-2xs text-hive-accent" title="The alert that caught it">{ruleName(h.rule) || h.words}</span>
                  </div>
                  {h.text && <div className="mt-0.5 text-[12.5px]">{h.text}</div>}
                </div>
                {h.file && (
                  <a className="btn h-7 shrink-0 self-center px-2 text-[12px]" href={h.file} target="_blank" rel="noreferrer">
                    PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
