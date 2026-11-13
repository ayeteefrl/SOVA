"use client";
// Small building blocks: modal, popover, icons, form controls.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { hiveRootEl } from "@/lib/hive/user";

export function Modal({ title, onClose, children, width = 560, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[85vh] flex-col rounded-lg border border-hive-line bg-hive-raised shadow-2xl shadow-black/50" style={{ width: `min(${width}px, calc(100vw - 32px))` }}>
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-hive-line px-4">
          <div className="text-[15px] font-semibold">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-hive-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// A button with a menu that closes on outside click. The menu is drawn on top of the page (not inside
// whatever scrolls or clips the button, like a dialog body) and flips or shifts to stay on screen.
export function Popover({ button, children, align = "left", className = "", open: openProp, onOpenChange }: { button: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; className?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setOpenState(o));
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; maxH: number } | null>(null);

  const place = () => {
    const btn = ref.current?.getBoundingClientRect();
    const m = menu.current;
    if (!btn || !m) return;
    const w = m.offsetWidth,
      h = m.offsetHeight,
      pad = 8;
    const left = Math.max(pad, Math.min(align === "right" ? btn.right - w : btn.left, window.innerWidth - w - pad));
    const below = window.innerHeight - btn.bottom - pad - 4;
    const above = btn.top - pad - 4;
    const flip = h > below && above > below;
    const room = flip ? above : below;
    const top = flip ? Math.max(pad, btn.top - 4 - Math.min(h, room)) : btn.bottom + 4;
    setAt({ left, top, maxH: Math.max(120, room) });
  };

  useLayoutEffect(() => {
    if (!open) return setAt(null);
    place();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // follows the button when the dialog scrolls
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  });

  return (
    <div className={`relative ${className}`} ref={ref}>
      {button(open, () => setOpen(!open))}
      {open &&
        createPortal(
          <div ref={menu} className="menu fixed z-[70] overflow-auto" style={{ left: at?.left ?? 0, top: at?.top ?? 0, maxHeight: at?.maxH, visibility: at ? "visible" : "hidden" }}>
            {children(() => setOpen(false))}
          </div>,
          hiveRootEl(),
        )}
    </div>
  );
}

const PATHS: Record<string, string> = {
  x: "M6 6l12 12M18 6L6 18",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  unlock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.7-1.5",
  magnet: "M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4",
  pencilLock: "M4 20l4-1 10-10-3-3L5 16zM14 7l3 3M15 15h6v5h-6zM16 15v-2a2 2 0 0 1 4 0v2",
  indicators: "M3 17l5-6 4 4 8-9M15 6h5v5",
  candles: "M7 4v16M17 4v16M5 8h4v8H5zM15 6h4v6h-4z",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  fullscreen: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  star: "M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.3L12 17.3 6.4 20.4l1.1-6.3L3 9.7l6.2-.9z",
  reset: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  pencil: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
  copy: "M8 8h12v12H8zM4 16V4h12",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  drag: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
  refresh: "M20 12a8 8 0 1 1-2.5-5.8L20 8M20 3v5h-5",
  alert: "M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0",
};

export function Icon({ name, size = 18, className = "" }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name] || ""} />
    </svg>
  );
}

export function ToolIcon({ svg, size = 28 }: { svg: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 28 28" className="tool-icon" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ---------- form controls ----------
const SWATCHES = ["#2962ff", "#089981", "#f23645", "#ff9800", "#ffeb3b", "#9c27b0", "#00bcd4", "#e91e63", "#787b86", "#ffffff", "#000000", "#4caf50"];

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hex, alpha] = splitColor(value);
  return (
    <Popover
      button={(_, toggle) => (
        <button className="h-7 w-10 rounded border border-hive-line p-0.5" onClick={toggle} aria-label="Colour">
          <span className="block h-full w-full rounded-sm" style={{ background: value }} />
        </button>
      )}
    >
      {() => (
        <div className="w-56 p-3">
          <div className="grid grid-cols-6 gap-1.5">
            {SWATCHES.map((c) => (
              <button key={c} className="h-6 w-6 rounded border border-hive-line" style={{ background: c }} onClick={() => onChange(joinColor(c, alpha))} aria-label={c} />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input type="color" value={hex} onChange={(e) => onChange(joinColor(e.target.value, alpha))} className="h-7 w-10 cursor-pointer bg-transparent" />
            <span className="text-2xs text-hive-muted">Opacity</span>
            <input type="range" min={0} max={100} value={Math.round(alpha * 100)} onChange={(e) => onChange(joinColor(hex, Number(e.target.value) / 100))} className="flex-1" />
          </div>
        </div>
      )}
    </Popover>
  );
}

function splitColor(c: string): [string, number] {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const [r, g, b, a = "1"] = m[1].split(",").map((s) => s.trim());
    const hex = "#" + [r, g, b].map((x) => Number(x).toString(16).padStart(2, "0")).join("");
    return [hex, Number(a)];
  }
  return [c.length === 7 ? c : "#2962ff", 1];
}
function joinColor(hex: string, a: number) {
  if (a >= 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 select-none">
      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--hive-accent))]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 px-5 py-1">
      <div className="text-hive-muted">{label}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
