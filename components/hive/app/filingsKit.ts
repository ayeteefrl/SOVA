"use client";
// Small pieces the Filings tabs share.
import { useEffect, useState } from "react";

export const card = "rounded-lg border border-hive-line bg-hive-panel";
export const IST = "Asia/Kolkata";
export const when = (ms: number | null) => (ms == null ? "" : new Date(ms).toLocaleString("en-IN", { timeZone: IST, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }));
export const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", year: "numeric" });

// Load one thing from the data server; reloads when `key` changes.
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ data: T | null; error: string; key: string }>({ data: null, error: "", key: "" });
  useEffect(() => {
    let alive = true;
    load()
      .then((data) => alive && setState({ data, error: "", key }))
      .catch((e) => alive && setState({ data: null, error: e instanceof Error ? e.message : "Couldn't load", key }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : "" };
}
