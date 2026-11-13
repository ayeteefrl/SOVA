"use client";
import { useEffect, useState } from "react";
import { stream, type FeedStatus } from "@/lib/hive/data";
import { setState, useStore } from "@/lib/hive/store";

const RANGES = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];
// Range button -> a sensible bar size, like TradingView's.
export const RANGE_TF: Record<string, string> ={ "1D": "1m", "5D": "5m", "1M": "30m", "3M": "1h", "6M": "2h", YTD: "1D", "1Y": "1D", "5Y": "1W", All: "1M" };

export default function BottomBar({ onRange }: { onRange: (r: string) => void }) {
  const log = useStore((s) => s.log);
  const percent = useStore((s) => s.percent);
  const [now, setNow] = useState(new Date());
  const [feed, setFeed] = useState<FeedStatus>(stream.status);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const off = stream.onStatus(setFeed);
    return () => {
      clearInterval(t);
      off();
    };
  }, []);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = -now.getTimezoneOffset();
  const up = feed.upstox;
  const feedTone = up === "live" ? "bg-hive-up" : up === "no token" ? "bg-[#ff9800]" : up === "offline" ? "bg-hive-down" : "bg-hive-muted";
  const feedText = up === "live" ? "Upstox live" : up === "no token" ? "NSE/BSE delayed (no Upstox token)" : up === "offline" ? "Data server offline" : up === "idle" ? "Upstox ready" : `Upstox: ${up}`;

  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5 border-t border-hive-line bg-hive-panel px-2 text-[12px]">
      {RANGES.map((r) => (
        <button
          key={r}
          className="rounded px-1.5 py-0.5 hover:bg-hive-hover"
          onClick={() => onRange(r)}
          title={`Show ${r}`}
        >
          {r}
        </button>
      ))}
      <div className="flex-1" />
      <span className="mr-2 flex items-center gap-1.5 text-hive-muted" title={feedText}>
        <span className={`h-2 w-2 rounded-full ${feedTone}`} />
        <span className="hidden md:inline">{feedText}</span>
      </span>
      <span className="tabular mr-2 text-hive-muted" title={tz}>
        {now.toLocaleTimeString("en-IN", { hour12: false })} UTC{offset >= 0 ? "+" : "-"}
        {Math.floor(Math.abs(offset) / 60)}
        {offset % 60 ? `:${String(Math.abs(offset) % 60).padStart(2, "0")}` : ""}
      </span>
      <button className={`rounded px-1.5 py-0.5 hover:bg-hive-hover ${percent ? "text-hive-accent" : ""}`} onClick={() => setState({ percent: !percent, log: false })} title="Percent scale">
        %
      </button>
      <button className={`rounded px-1.5 py-0.5 hover:bg-hive-hover ${log ? "text-hive-accent" : ""}`} onClick={() => setState({ log: !log, percent: false })} title="Log scale">
        log
      </button>
    </div>
  );
}
