"use client";
// The scan snapshot, shared by every page: polls while the server is still building it, then keeps it.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type StockRow, type Snapshot } from "./data";
import { getState, newUid, setState } from "./store";

export type SnapState = { status: "loading"; done: number; total: number } | { status: "error"; message: string } | { status: "ready"; snap: Extract<Snapshot, { loading: false }> };

let cached: Extract<Snapshot, { loading: false }> | null = null;

export function useSnapshot(): SnapState {
  const [state, setLocal] = useState<SnapState>(cached ? { status: "ready", snap: cached } : { status: "loading", done: 0, total: 0 });
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await api.snapshot();
        if (!alive) return;
        if (s.loading) {
          if (s.error) return setLocal({ status: "error", message: s.error });
          setLocal({ status: "loading", done: s.done, total: s.total });
          timer = setTimeout(tick, 1500);
        } else {
          cached = s;
          setLocal({ status: "ready", snap: s });
          if (s.refreshing) timer = setTimeout(tick, 5000); // picks up the fresh copy when it lands
        }
      } catch (e) {
        if (alive) setLocal({ status: "error", message: e instanceof Error ? e.message : "Couldn't reach the data server" });
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return state;
}

// Open a stock on the chart page (client-side navigation, so the chosen symbol is still in memory).
export function useOpenChart() {
  const router = useRouter();
  return (symbol: string) => {
    setState({ symbol: symbol.includes(":") ? symbol : `NSE:${symbol}` });
    router.push("/charts");
  };
}

// Put tickers into a new watchlist (or the end of an existing one) and say what happened.
export function toWatchlist(name: string, tickers: string[], dest: string = "new") {
  const symbols = tickers.map((t) => (t.includes(":") ? t : `NSE:${t}`));
  setState((st) => {
    if (dest === "new") {
      const taken = new Set(st.lists.map((l) => l.name));
      let unique = name;
      for (let n = 2; taken.has(unique); n++) unique = `${name} ${n}`;
      const id = newUid();
      return { lists: [...st.lists, { id, name: unique, sections: [{ name: "", symbols }] }], activeList: id };
    }
    return {
      lists: st.lists.map((l) => {
        if (l.id !== dest) return l;
        const have = new Set(l.sections.flatMap((x) => x.symbols));
        const fresh = symbols.filter((x) => !have.has(x));
        if (!l.sections.length) return { ...l, sections: [{ name: "", symbols: fresh }] };
        return { ...l, sections: l.sections.map((x, i) => (i === l.sections.length - 1 ? { ...x, symbols: [...x.symbols, ...fresh] } : x)) };
      }),
    };
  });
  return getState().lists;
}

export const byTicker = (rows: StockRow[]) => new Map(rows.map((r) => [r.s, r]));
