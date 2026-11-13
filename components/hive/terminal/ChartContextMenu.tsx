"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../ui";

export type MenuItem = { label: string; icon?: string; hint?: string; checked?: boolean; danger?: boolean; disabled?: boolean; onClick: () => void } | "sep";

// Right-click menu for the chart. Closes on outside click, Esc, scroll, resize or after picking an item.
export default function ChartContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)), y: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) });
  }, [x, y]);

  useEffect(() => {
    const down = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    window.addEventListener("wheel", onClose, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("wheel", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[230px] rounded-md border border-hive-line bg-hive-raised py-1 text-[13px] shadow-xl shadow-black/40"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it === "sep" ? (
          <div key={i} className="my-1 h-px bg-hive-line" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-hive-hover disabled:opacity-40 disabled:hover:bg-transparent ${it.danger ? "text-hive-down" : ""}`}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            <span className="grid w-4 place-items-center text-hive-muted">{it.icon ? <Icon name={it.icon} size={15} /> : it.checked ? <Icon name="check" size={15} /> : null}</span>
            <span className="flex-1">{it.label}</span>
            {it.checked && it.icon && <Icon name="check" size={14} />}
            {it.hint && <span className="text-2xs text-hive-muted">{it.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}
