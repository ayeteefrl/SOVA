"use client";
import { useMemo, useRef, useEffect, useState } from "react";
import { COMING, INDICATORS } from "@/lib/hive/engine";
import { Icon, Modal } from "../ui";

// The indicators on your TradingView layout, first in the list.
const YOURS = ["macross", "ichimoku", "ema4", "vpvr", "tlvolume", "rsi", "relstrength"];

export default function IndicatorPicker({ onAdd, onClose }: { onAdd: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const [added, setAdded] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const groups = useMemo(() => ["Your chart", "All", ...[...new Set(INDICATORS.map((d) => d.group))].sort()], []);
  const needle = q.toLowerCase();
  const list = INDICATORS.filter(
    (d) =>
      (group === "All" || (group === "Your chart" ? YOURS.includes(d.id) : d.group === group)) &&
      (!needle || d.name.toLowerCase().includes(needle) || d.id.includes(needle) || d.tv?.toLowerCase().includes(needle)),
  ).sort((a, b) => (group === "Your chart" ? YOURS.indexOf(a.id) - YOURS.indexOf(b.id) : a.name.localeCompare(b.name)));
  const coming = COMING.filter((c) => !needle || c.name.toLowerCase().includes(needle));

  return (
    <Modal title="Indicators, metrics and strategies" onClose={onClose} width={780}>
      <div className="flex items-center gap-2 border-b border-hive-line px-4">
        <Icon name="search" className="text-hive-muted" />
        <input ref={input} className="h-12 flex-1 bg-transparent text-[15px] outline-none" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        {added && <span className="text-2xs text-hive-up">Added {added}</span>}
      </div>
      <div className="flex h-[500px]">
        <div className="w-48 shrink-0 overflow-auto border-r border-hive-line py-2">
          {groups.map((g) => (
            <button key={g} className={`menu-item ${g === group ? "bg-hive-hover text-hive-accent" : ""}`} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-auto py-1">
          <div className="px-4 py-1 text-2xs uppercase tracking-wide text-hive-muted">{list.length} indicators</div>
          {list.map((d) => (
            <button
              key={d.id}
              className="flex h-9 w-full items-center gap-2 px-4 text-left hover:bg-hive-hover"
              onClick={() => {
                onAdd(d.id);
                setAdded(d.name);
              }}
              title={d.description || d.name}
            >
              <span className="flex-1 truncate">
                {d.name}
                {d.tv && <span className="ml-2 text-2xs text-hive-muted">({d.tv})</span>}
              </span>
              <span className="text-2xs text-hive-muted">{d.overlay ? "on chart" : "own pane"}</span>
            </button>
          ))}
          {group === "All" && coming.length > 0 && (
            <>
              <div className="mt-3 px-4 py-1 text-2xs uppercase tracking-wide text-hive-muted">Coming in a later phase</div>
              {coming.map((c) => (
                <div key={c.name} className="flex h-8 items-center gap-2 px-4 text-hive-muted">
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-2xs">{c.why}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
