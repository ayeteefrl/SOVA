"use client";
// Keyword alerts on NSE announcements: "order win", "buyback", a company name. Rules and hits live in this browser.
// While any ChartHive page is open the app checks NSE every few minutes, so an alert fires on any page, not just Filings.
import { useEffect, useSyncExternalStore } from "react";
import { api, type Announcement } from "./data";
import { hiveKey } from "./user";

export type AlertRule = { id: string; words: string[]; n500Only: boolean; since: number };
export type AlertHit = { key: string; rule: string; words: string; t: number | null; symbol: string; name: string; category: string; text: string; file: string; read: boolean };
type State = { rules: AlertRule[]; hits: AlertHit[]; keys: string[]; lastCheck: number; checking: boolean };

const K = { rules: "chart-hive.alert-rules.v1", hits: "chart-hive.alert-hits.v1", keys: "chart-hive.alert-keys.v1", last: "chart-hive.alert-last.v1" };
const EVERY = 3 * 60e3;
const MAX_HITS = 300;
const MAX_KEYS = 2000;
const EMPTY: State = { rules: [], hits: [], keys: [], lastCheck: 0, checking: false };

const read = <T,>(k: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(hiveKey(k)) || "") as T;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(hiveKey(k), JSON.stringify(v));
  } catch {
    /* storage blocked: alerts still work until the tab closes */
  }
};

let state: State = EMPTY;
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  emit();
};

function load() {
  state = { rules: read(K.rules, []), hits: read(K.hits, []), keys: read(K.keys, []), lastCheck: read(K.last, 0), checking: false };
  loaded = true;
  emit();
}

const persist = () => {
  write(K.rules, state.rules);
  write(K.hits, state.hits);
  write(K.keys, state.keys);
  write(K.last, state.lastCheck);
};

// Does this announcement match the rule? Any one of the words is enough, anywhere in the company, category or subject.
export const matchesRule = (rule: Pick<AlertRule, "words" | "n500Only">, r: Announcement) => {
  if (rule.n500Only && !r.n500) return false;
  const hay = `${r.symbol} ${r.name} ${r.category} ${r.text}`.toLowerCase();
  return rule.words.some((w) => hay.includes(w));
};

export const parseWords = (input: string) => [...new Set(input.split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean))];

export function addRule(words: string[], n500Only: boolean) {
  const clean = words.map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (!clean.length) return null;
  const dupe = state.rules.find((r) => r.n500Only === n500Only && r.words.join("|") === clean.join("|"));
  if (dupe) return dupe;
  const rule: AlertRule = { id: Math.random().toString(36).slice(2, 9), words: clean, n500Only, since: Date.now() };
  set({ rules: [...state.rules, rule] });
  persist();
  void checkNow();
  return rule;
}

export function removeRule(id: string) {
  set({ rules: state.rules.filter((r) => r.id !== id), hits: state.hits.filter((h) => h.rule !== id) });
  persist();
}
export function markAllRead() {
  set({ hits: state.hits.map((h) => (h.read ? h : { ...h, read: true })) });
  persist();
}
export function clearHits() {
  set({ hits: [] });
  persist();
}

// Desktop notification, if the person allowed them.
function notify(fresh: AlertHit[]) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    if (fresh.length > 3) {
      new Notification(`${fresh.length} new filings match your alerts`, { body: fresh.slice(0, 4).map((h) => h.symbol).join(", ") + ", …", tag: "chart-hive-alerts" });
      return;
    }
    for (const h of fresh) new Notification(`${h.symbol}: ${h.category}`, { body: h.text || h.name, tag: h.key });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

let running: Promise<void> | null = null;
export function checkNow() {
  if (running) return running;
  if (!state.rules.length) return Promise.resolve();
  running = (async () => {
    set({ checking: true });
    try {
      const gap = Date.now() - (state.lastCheck || Date.now());
      const days = Math.min(7, Math.max(1, Math.ceil(gap / 864e5) + 1));
      const res = await api.announcements(days);
      const seen = new Set(state.keys);
      const fresh: AlertHit[] = [];
      for (const r of res.rows) {
        if (r.t == null) continue;
        for (const rule of state.rules) {
          const key = `${r.id}|${rule.id}`;
          if (r.t < rule.since || seen.has(key) || !matchesRule(rule, r)) continue;
          seen.add(key);
          fresh.push({ key, rule: rule.id, words: rule.words.join(", "), t: r.t, symbol: r.symbol, name: r.name, category: r.category, text: r.text, file: r.file, read: false });
        }
      }
      const hits = [...fresh, ...state.hits].sort((a, b) => (b.t ?? 0) - (a.t ?? 0)).slice(0, MAX_HITS);
      set({ hits, keys: [...seen].slice(-MAX_KEYS), lastCheck: Date.now() });
      persist();
      if (fresh.length) {
        notify(fresh);
        window.dispatchEvent(new CustomEvent("terminal:toast", { detail: fresh.length === 1 ? `Alert: ${fresh[0].symbol} ${fresh[0].category}` : `${fresh.length} new filings match your alerts` }));
      }
    } catch {
      /* NSE hiccup: try again next time */
    } finally {
      set({ checking: false });
      running = null;
    }
  })();
  return running;
}

let timer: ReturnType<typeof setInterval> | undefined;
function start() {
  if (timer) return;
  setTimeout(() => void checkNow(), 3000);
  timer = setInterval(() => void checkNow(), EVERY);
  window.addEventListener("storage", (e) => {
    if (e.key && Object.values(K).some((k) => { try { return hiveKey(k) === e.key; } catch { return false; } })) load(); // another tab changed the rules or read the hits
  });
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

// Every page calls this (via the nav bar), which is what keeps the checks running.
export function useAlerts() {
  useEffect(() => {
    if (!loaded) load();
    start();
  }, []);
  const s = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  return { ...s, unread: s.hits.filter((h) => !h.read).length };
}
