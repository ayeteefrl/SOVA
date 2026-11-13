"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ChartContextMenu, { type MenuItem } from "./ChartContextMenu";
import { toast } from "./Toast";
import { ChartEngine, type LegendState } from "@/lib/hive/chart/engine";
import type { Drawing } from "@/lib/hive/drawings/types";
import { getState, setState, useStore } from "@/lib/hive/store";
import { readTheme } from "@/lib/hive/theme";
import { setHiveTheme } from "@/lib/hive/user";
import { digitsFor, fmtPct, fmtPrice, fmtVol } from "@/lib/hive/data";
import { Icon } from "../ui";
import type { StrategyReport } from "./StrategyTester";

type Props = {
  onReady: (e: ChartEngine) => void;
  onSelectDrawing: (d: Drawing | null) => void;
  onEditDrawing: (d: Drawing) => void;
  onIndicatorSettings: (uid: string) => void;
  onSymbolClick: () => void;
  onStrategies: (list: StrategyReport[]) => void;
  onScreenshot: () => void;
  onIndicators: () => void;
};

export default function ChartView({ onReady, onSelectDrawing, onEditDrawing, onIndicatorSettings, onSymbolClick, onStrategies, onScreenshot, onIndicators }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; price: number | null } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const engine = useRef<ChartEngine | null>(null);
  const [legend, setLegend] = useState<LegendState | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const symbol = useStore((s) => s.symbol);
  const tf = useStore((s) => s.tf);
  const type = useStore((s) => s.type);
  const log = useStore((s) => s.log);
  const percent = useStore((s) => s.percent);
  const indicators = useStore((s) => s.indicators);
  const drawings = useStore((s) => s.drawings);
  const theme = useStore((s) => s.theme);
  const magnet = useStore((s) => s.magnet);
  const keepDrawing = useStore((s) => s.keepDrawing);
  const lockAll = useStore((s) => s.lockAll);
  const hideAll = useStore((s) => s.hideAll);

  // Create once.
  useEffect(() => {
    const s = getState();
    const e = new ChartEngine(host.current!, { symbol: s.symbol, tf: s.tf, type: s.type, indicators: s.indicators, log: s.log, percent: s.percent }, readTheme(), {
      onLegend: setLegend,
      onLoaded: (r) => {
        // The server may have renamed the symbol ("reliance" -> NSE:RELIANCE).
        if (r.symbol !== getState().symbol) setState({ symbol: r.symbol }, { history: false });
        e.setDrawings(getState().drawings[r.symbol] || []);
        window.dispatchEvent(new CustomEvent("terminal:loaded"));
      },
      onDrawingsChange: (sym, items) => setState((st) => ({ drawings: { ...st.drawings, [sym]: items.map(stripRuntime) } })),
      onSelectDrawing,
      onToolDone: () => window.dispatchEvent(new CustomEvent("terminal:tool", { detail: "cursor" })),
      onEditDrawing,
      onStrategies,
    });
    engine.current = e;
    onReady(e);
    e.load();
    return () => e.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const e = engine.current;
    if (!e || (e.cfg.symbol === symbol && e.cfg.tf === tf)) return;
    e.cfg.symbol = symbol;
    e.cfg.tf = tf;
    e.setDrawings(getState().drawings[symbol] || []);
    e.load();
  }, [symbol, tf]);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.cfg.type = type;
    e.cfg.log = log;
    e.cfg.percent = percent;
    e.render(false);
  }, [type, log, percent]);

  useEffect(() => {
    engine.current?.setIndicators(indicators);
  }, [indicators]);

  useEffect(() => {
    const e = engine.current;
    if (e) e.setDrawings(drawings[e.cfg.symbol] || []);
  }, [drawings]);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.magnet = magnet;
    e.keepDrawing = keepDrawing;
    e.lockAll = lockAll;
    e.drawings.hideAll = hideAll;
    e.drawings.update();
  }, [magnet, keepDrawing, lockAll, hideAll]);

  useEffect(() => {
    setHiveTheme(theme);
    engine.current?.setTheme(readTheme());
  }, [theme]);

  const toggleHidden = (uid: string) => setState((s) => ({ indicators: s.indicators.map((x) => (x.uid === uid ? { ...x, hidden: !x.hidden } : x)) }));
  const remove = (uid: string) => setState((s) => ({ indicators: s.indicators.filter((x) => x.uid !== uid) }));

  const b = legend?.bar,
    prev = legend?.prev;
  const chg = b && prev ? b.close - prev.close : null;
  const chgPct = b && prev ? ((b.close - prev.close) / prev.close) * 100 : null;
  const tone = chg == null ? "" : chg >= 0 ? "text-hive-up" : "text-hive-down";

  const openMenu = (ev: React.MouseEvent) => {
    ev.preventDefault();
    // Leave the legend's own buttons alone.
    if ((ev.target as HTMLElement).closest("button")) return;
    const top = host.current?.getBoundingClientRect().top ?? 0;
    setMenu({ x: ev.clientX, y: ev.clientY, price: engine.current?.priceAtY(ev.clientY - top) ?? null });
  };

  const menuItems = (): MenuItem[] => {
    const e = engine.current;
    const st = getState();
    const count = (st.drawings[st.symbol] || []).length;
    return [
      { label: "Refresh data", icon: "refresh", onClick: () => { e?.load({ keepView: true }); toast("Refreshing…"); } },
      { label: "Reset chart view", icon: "reset", onClick: () => e?.resetView() },
      {
        label: "Reset to default",
        icon: "reset",
        onClick: () => {
          setState({ log: false, percent: false, type: "candles", magnet: "off", lockAll: false, hideAll: false });
          e?.resetView();
          toast("Chart reset to default");
        },
      },
      "sep",
      { label: "Copy price", icon: "copy", hint: menu?.price != null ? e?.fmt(menu.price) : "", disabled: menu?.price == null, onClick: () => { const t = e?.fmt(menu!.price!) ?? ""; navigator.clipboard?.writeText(t.replace(/,/g, "")); toast(`Copied ${t}`); } },
      { label: "Add indicator…", icon: "indicators", hint: "/", onClick: onIndicators },
      { label: "Save image", icon: "camera", onClick: onScreenshot },
      "sep",
      { label: "Logarithmic scale", checked: st.log, onClick: () => setState({ log: !st.log }) },
      { label: "Percentage scale", checked: st.percent, onClick: () => setState({ percent: !st.percent }) },
      { label: st.hideAll ? "Show all drawings" : "Hide all drawings", icon: st.hideAll ? "eye" : "eyeOff", onClick: () => setState({ hideAll: !st.hideAll }) },
      { label: st.lockAll ? "Unlock all drawings" : "Lock all drawings", icon: st.lockAll ? "unlock" : "lock", onClick: () => setState({ lockAll: !st.lockAll }) },
      "sep",
      { label: count ? `Remove ${count} drawing${count > 1 ? "s" : ""}` : "Remove drawings", icon: "trash", danger: true, disabled: !count, onClick: () => { e?.clearDrawings(); toast("Drawings removed. Ctrl+Z to undo"); } },
      { label: "Remove all indicators", icon: "trash", danger: true, disabled: !st.indicators.length, onClick: () => { setState({ indicators: [] }); toast("Indicators removed. Ctrl+Z to undo"); } },
    ];
  };

  return (
    <div className="relative h-full w-full" onContextMenu={openMenu}>
      {menu && <ChartContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={closeMenu} />}
      <div ref={host} className="absolute inset-0" />
      {legend && (
        <div className="pointer-events-none absolute left-2 top-1.5 z-10 max-w-[calc(100%-90px)] select-none text-[12px]">
          <div className="pointer-events-auto flex flex-wrap items-center gap-x-2">
            <button className="font-semibold hover:text-hive-accent" onClick={onSymbolClick}>
              {legend.name || legend.symbol.split(":").pop()}
            </button>
            <span className="text-hive-muted">·</span>
            <span>{legend.tf}</span>
            <span className="text-hive-muted">·</span>
            <span className="text-hive-muted">{legend.exchange || legend.symbol.split(":")[0]}</span>
            {legend.provider && <span className={`rounded px-1 text-2xs ${/delayed/i.test(legend.provider) ? "bg-[#ff9800]/15 text-[#ff9800]" : "bg-hive-up/15 text-hive-up"}`}>{legend.provider}</span>}
            {b && (
              <span className={`tabular flex gap-2 ${tone}`}>
                <span>
                  <span className="text-hive-muted">O</span>
                  {fmt(b.open)}
                </span>
                <span>
                  <span className="text-hive-muted">H</span>
                  {fmt(b.high)}
                </span>
                <span>
                  <span className="text-hive-muted">L</span>
                  {fmt(b.low)}
                </span>
                <span>
                  <span className="text-hive-muted">C</span>
                  {fmt(b.close)}
                </span>
                {chg != null && (
                  <span>
                    {chg >= 0 ? "+" : ""}
                    {fmtPrice(chg, digitsFor(b.close))} ({fmtPct(chgPct)})
                  </span>
                )}
                {b.volume ? (
                  <span>
                    <span className="text-hive-muted">Vol </span>
                    {fmtVol(b.volume)}
                  </span>
                ) : null}
              </span>
            )}
          </div>
          {legendOpen &&
            legend.rows.map((r) => (
              <div key={r.uid} className="group pointer-events-auto flex h-6 items-center gap-2" style={{ opacity: r.hidden ? 0.45 : 1 }}>
                <span className="whitespace-nowrap">
                  {r.name} <span className="text-hive-muted">{r.params}</span>
                </span>
                <span className="tabular flex gap-2">
                  {r.error ? <span className="text-hive-down">{r.error}</span> : r.pending ? <span className="text-hive-muted">loading…</span> : r.values.map((v, i) => <span key={i} style={{ color: v.color }}>{v.text}</span>)}
                </span>
                <span className="hidden items-center rounded bg-hive-raised group-hover:flex">
                  <button className="grid h-6 w-6 place-items-center hover:text-hive-accent" title={r.hidden ? "Show" : "Hide"} onClick={() => toggleHidden(r.uid)}>
                    <Icon name={r.hidden ? "eyeOff" : "eye"} size={14} />
                  </button>
                  <button className="grid h-6 w-6 place-items-center hover:text-hive-accent" title="Settings" onClick={() => onIndicatorSettings(r.uid)}>
                    <Icon name="gear" size={14} />
                  </button>
                  <button className="grid h-6 w-6 place-items-center hover:text-hive-down" title="Remove" onClick={() => remove(r.uid)}>
                    <Icon name="x" size={14} />
                  </button>
                </span>
              </div>
            ))}
          {legend.rows.length > 0 && (
            <button className="pointer-events-auto mt-0.5 grid h-5 w-6 place-items-center rounded border border-hive-line bg-hive-panel text-hive-muted hover:text-hive-text" onClick={() => setLegendOpen(!legendOpen)} title={legendOpen ? "Hide indicator legend" : "Show indicator legend"}>
              <Icon name="chevronDown" size={12} className={legendOpen ? "rotate-180" : ""} />
            </button>
          )}
          {legend.notes.map((n) => (
            <div key={n} className="mt-1 text-2xs text-[#ff9800]">
              {n}
            </div>
          ))}
        </div>
      )}
      {legend?.loading && <div className="absolute inset-0 grid place-items-center text-hive-muted">Loading {legend.symbol}…</div>}
      {legend?.error && !legend.loading && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="max-w-md rounded-lg border border-hive-line bg-hive-raised p-5 text-center">
            <div className="font-semibold">Couldn&apos;t load {legend.symbol} on {legend.tf}</div>
            <div className="mt-2 text-hive-muted">{legend.error}</div>
          </div>
        </div>
      )}
    </div>
  );

  function fmt(v: number) {
    return engine.current?.fmt(v) ?? String(v);
  }
}

// Drawings carry a cached text box while on screen; don't save it.
function stripRuntime(d: Drawing): Drawing {
  const rest = { ...d } as Drawing & { _box?: unknown };
  delete rest._box;
  return rest;
}
