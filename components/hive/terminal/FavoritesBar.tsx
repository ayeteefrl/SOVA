"use client";
// A small toolbar of your favourite drawing tools that floats over the chart. Drag it by the grip;
// it can't leave the chart. Star tools in the left toolbar's menus to add them. Drag a tool sideways
// to change its place in the bar.
import { useCallback, useEffect, useRef, useState } from "react";
import { TOOL_BY_ID } from "@/lib/hive/drawings/registry";
import { setState, useStore } from "@/lib/hive/store";
import { Icon, ToolIcon } from "../ui";

export default function FavoritesBar({ tool, onTool }: { tool: string; onTool: (id: string) => void }) {
  const favorites = useStore((s) => s.favoriteTools);
  const pos = useStore((s) => s.favBarPos);
  const ref = useRef<HTMLDivElement>(null);
  // While a tool is being dragged to a new spot, `order` holds the live arrangement; it's saved on release.
  const [order, setOrder] = useState<string[] | null>(null);
  const dragging = useRef(false);
  const tools = (order ?? favorites).map((id) => TOOL_BY_ID[id]).filter(Boolean);

  // Keep the bar fully inside the chart, including after the chart or the watchlist is resized.
  const clamp = useCallback((x: number, y: number) => {
    const bar = ref.current;
    const box = bar?.parentElement;
    if (!bar || !box) return { x, y };
    return { x: Math.max(0, Math.min(x, box.clientWidth - bar.offsetWidth)), y: Math.max(0, Math.min(y, box.clientHeight - bar.offsetHeight)) };
  }, []);

  useEffect(() => {
    const box = ref.current?.parentElement;
    if (!box) return;
    const fit = () => {
      const p = clamp(pos.x, pos.y);
      if (p.x !== pos.x || p.y !== pos.y) setState({ favBarPos: p }, { history: false });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [pos, clamp, tools.length]);

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const grip = e.currentTarget as HTMLElement;
    grip.setPointerCapture(e.pointerId);
    const sx = e.clientX,
      sy = e.clientY,
      ox = pos.x,
      oy = pos.y;
    const move = (ev: PointerEvent) => setState({ favBarPos: clamp(ox + ev.clientX - sx, oy + ev.clientY - sy) }, { history: false });
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  };

  // Press a tool and drag sideways to put it before or after its neighbours.
  const startReorder = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    const bar = ref.current;
    if (!bar) return;
    const sx = e.clientX;
    // Slots stay where they are (every button is the same width); the dragged tool takes the one nearest the pointer.
    const ids = favorites.filter((f) => TOOL_BY_ID[f]);
    const slots = ids.map((k) => {
      const el = bar.querySelector<HTMLElement>(`[data-fav="${k}"]`);
      return el ? el.offsetLeft + el.offsetWidth / 2 : 0;
    });
    let cur = [...favorites];
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - sx) < 5) return;
      moved = dragging.current = true;
      const x = ev.clientX - bar.getBoundingClientRect().left;
      let target = 0;
      slots.forEach((c, j) => {
        if (Math.abs(x - c) < Math.abs(x - slots[target])) target = j;
      });
      const rest = ids.filter((k) => k !== id);
      rest.splice(target, 0, id);
      cur = [...rest, ...favorites.filter((f) => !TOOL_BY_ID[f])];
      setOrder(cur);
    };
    // Listen on the window: reordering moves the button in the page, which would drop a pointer capture.
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (moved) setState({ favoriteTools: cur });
      setOrder(null);
      setTimeout(() => (dragging.current = false), 0); // swallow the click that follows a drag
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const pick = (id: string) => {
    if (dragging.current) return;
    const def = TOOL_BY_ID[id];
    if (def) setState((s) => ({ lastTool: { ...s.lastTool, [def.group]: id } }));
    onTool(id);
  };

  return (
    <div ref={ref} className="absolute z-20 flex items-center gap-0.5 rounded-md border border-hive-line bg-hive-raised p-1 shadow-xl shadow-black/40" style={{ left: pos.x, top: pos.y }}>
      <div className="grid h-8 w-5 cursor-grab touch-none place-items-center text-hive-muted hover:text-hive-text active:cursor-grabbing" title="Drag to move" onPointerDown={startDrag}>
        <Icon name="drag" size={16} />
      </div>
      {tools.length === 0 && <span className="px-2 text-2xs text-hive-muted">Star a tool in the left toolbar to pin it here</span>}
      {tools.map((t) => (
        <button
          key={t.id}
          data-fav={t.id}
          className={`grid h-8 w-8 touch-none place-items-center rounded transition-colors ${order ? "cursor-grabbing" : ""} ${t.id === tool ? "bg-hive-accent/15 text-hive-accent" : "text-hive-text hover:bg-hive-hover"}`}
          title={`${t.name}${t.hotkey ? ` (${t.hotkey})` : ""}. Drag to reorder, right-click to unpin`}
          onPointerDown={(e) => startReorder(e, t.id)}
          onClick={() => pick(t.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setState((s) => ({ favoriteTools: s.favoriteTools.filter((x) => x !== t.id) }));
          }}
        >
          <ToolIcon svg={t.icon} size={24} />
        </button>
      ))}
      <button className="grid h-8 w-5 place-items-center text-hive-muted hover:text-hive-text" title="Hide favourites bar" onClick={() => setState({ favBar: false })}>
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
