"use client";
// Company financials and promoter holding for the scanner. Both load in the background, so the price scans work straight away
// and the fundamentals fill in when they arrive (the first financials build takes about a minute, after that it is cached).
import { useEffect, useState } from "react";
import { api, type FinRow, type HoldingRow } from "./data";

export type Fundamentals = { fin: FinRow[] | null; hold: HoldingRow[] | null; progress: { done: number; total: number } | null; error: string };

let cache: { fin: FinRow[] | null; hold: HoldingRow[] | null } = { fin: null, hold: null };

export function useFundamentals(): Fundamentals {
  const [state, setState] = useState<Fundamentals>({ ...cache, progress: null, error: "" });
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await api.financials();
        if (!alive) return;
        if (s.loading) {
          if (s.error) return setState((p) => ({ ...p, error: s.error as string }));
          setState((p) => ({ ...p, progress: { done: s.done, total: s.total } }));
          timer = setTimeout(tick, 2000);
        } else {
          cache = { ...cache, fin: s.stocks };
          setState((p) => ({ ...p, fin: s.stocks, progress: null, error: "" }));
        }
      } catch (e) {
        if (alive) setState((p) => ({ ...p, error: e instanceof Error ? e.message : "Couldn't load company financials" }));
      }
    };
    tick();
    api
      .shareholding()
      .then((s) => {
        if (!alive) return;
        cache = { ...cache, hold: s.rows };
        setState((p) => ({ ...p, hold: s.rows }));
      })
      .catch(() => {
        /* holdings are optional: the other fundamentals still work */
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return state;
}
