"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartEngine } from "@/lib/hive/chart/engine";
import type { Drawing } from "@/lib/hive/drawings/types";
import { TOOLS } from "@/lib/hive/drawings/registry";
import { isPointer } from "@/lib/hive/drawings/types";
import { defaults, BY_ID } from "@/lib/hive/engine";
import { getState, newUid, redo, setState, undo, useStore } from "@/lib/hive/store";
import ChartView from "./ChartView";
import TopBar from "./TopBar";
import DrawingToolbar from "./DrawingToolbar";
import BottomBar, { RANGE_TF } from "./BottomBar";
import Watchlist from "./Watchlist";
import SymbolSearch from "./SymbolSearch";
import IndicatorPicker from "./IndicatorPicker";
import IndicatorSettings from "./IndicatorSettings";
import { DrawingSettings, SelectionBar } from "./DrawingSettings";
import { Icon } from "../ui";
import FavoritesBar from "./FavoritesBar";
import Toast, { toast } from "./Toast";
import StrategyTester, { type StrategyReport } from "./StrategyTester";
import { api } from "@/lib/hive/data";

type Dialog = { kind: "symbol"; initial?: string } | { kind: "watchAdd"; section: number } | { kind: "indicators" } | { kind: "indSettings"; uid: string } | { kind: "drawing"; id: string } | null;

const HOTKEYS: Record<string, string> = Object.fromEntries(TOOLS.filter((t) => t.hotkey).map((t) => [t.hotkey!.toLowerCase(), t.id]));

export default function Terminal({ initialSymbol = null }: { initialSymbol?: string | null }) {
  const engine = useRef<ChartEngine | null>(null);
  // SOVA addition: /charts?symbol=NSE:TCS (from "Open chart" on SOVA holdings). The server page checked the
  // format; here the data server confirms the symbol exists before the chart is created, so the saved layout
  // (indicators, drawings, watchlists) stays as it was and an unknown symbol leaves the saved one in place.
  // An NSE ticker that isn't on NSE (BSE-only companies) is retried on BSE.
  const [ready, setReady] = useState(!initialSymbol);
  const opened = useRef(false);
  useEffect(() => {
    if (!initialSymbol || opened.current) return;
    opened.current = true;
    (async () => {
      const tries = [initialSymbol, ...(initialSymbol.startsWith("NSE:") ? [`BSE:${initialSymbol.slice(4)}`] : [])];
      let found: string | null = null;
      for (const t of tries) {
        const info = await api.symbol(t).catch(() => null);
        if (info?.symbol) {
          found = info.symbol;
          break;
        }
      }
      if (found) {
        if (found !== getState().symbol) setState({ symbol: found });
      } else toast(`Couldn't find ${initialSymbol}`);
      window.history.replaceState(null, "", "/charts");
      setReady(true);
    })();
  }, [initialSymbol]);
  const [tool, setTool] = useState("cursor");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pendingRange = useRef<string | null>(null);
  const [reports, setReports] = useState<StrategyReport[]>([]);
  const [testerOpen, setTesterOpen] = useState(true);
  const reportCount = useRef(0);
  const symbol = useStore((s) => s.symbol);
  const drawings = useStore((s) => s.drawings);
  const rightPanel = useStore((s) => s.rightPanel);
  const watchWidth = useStore((s) => s.watchWidth);
  const favBar = useStore((s) => s.favBar);
  const selected = selectedId ? (drawings[symbol] || []).find((d) => d.id === selectedId) || null : null;

  const chooseTool = useCallback((id: string) => {
    setTool(id);
    engine.current?.setTool(id);
  }, []);

  useEffect(() => {
    const onTool = (e: Event) => chooseTool((e as CustomEvent<string>).detail);
    const onLoaded = () => {
      if (pendingRange.current) engine.current?.setRange(pendingRange.current);
      pendingRange.current = null;
    };
    window.addEventListener("terminal:tool", onTool);
    window.addEventListener("terminal:loaded", onLoaded);
    return () => {
      window.removeEventListener("terminal:tool", onTool);
      window.removeEventListener("terminal:loaded", onLoaded);
    };
  }, [chooseTool]);

  // Keyboard: type to search a symbol, / for indicators, Esc, Delete, Alt+T/H/V/C/F/J tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (dialog || t.closest("input, textarea, select, [contenteditable]")) return;
      // Ctrl+Z walks back through everything you've done; Ctrl+Y (or Ctrl+Shift+Z) goes forward again.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (engine.current?.cancelPlacement()) toast("Placement cancelled");
        else toast(undo() ? "Undone" : "Nothing to undo");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        toast(redo() ? "Redone" : "Nothing to redo");
        return;
      }
      // Alt+] / Alt+[ move to the next / previous watchlist; Alt+1 to Alt+9 jump straight to one.
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === "BracketRight" || e.code === "BracketLeft" || /^Digit[1-9]$/.test(e.code))) {
        e.preventDefault();
        const { lists, activeList } = getState();
        const cur = Math.max(0, lists.findIndex((l) => l.id === activeList));
        const next = e.code.startsWith("Digit") ? Number(e.code.slice(5)) - 1 : (cur + (e.code === "BracketRight" ? 1 : -1) + lists.length) % lists.length;
        if (!lists[next]) return toast(`No watchlist ${next + 1}`);
        if (next !== cur) setState({ activeList: lists[next].id });
        toast(lists[next].name);
        return;
      }
      const combo = [e.altKey && "alt", e.shiftKey && "shift", e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()].filter(Boolean).join("+");
      if (e.altKey && HOTKEYS[combo]) {
        e.preventDefault();
        chooseTool(HOTKEYS[combo]);
        // With the mouse over the chart the drawing starts right there, no extra click.
        engine.current?.placeAtCursor(HOTKEYS[combo]);
        return;
      }
      if (e.key === "Escape") {
        if (!engine.current?.cancelPlacement()) chooseTool("cursor");
        return;
      }
      if (e.key === "Enter" && engine.current?.commitPlacement()) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (engine.current?.deleteSelected()) setSelectedId(null);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        return setDialog({ kind: "indicators" });
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[a-z0-9]$/i.test(e.key)) setDialog({ kind: "symbol", initial: e.key });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, chooseTool]);

  const addIndicator = (id: string) => {
    if (!BY_ID[id]) return;
    setState((s) => ({ indicators: [...s.indicators, { uid: newUid(), id, params: defaults(id) }] }));
  };

  const screenshot = () => {
    const canvas = engine.current?.screenshot();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${getState().symbol.replace(":", "_")}_${getState().tf}_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <div className="flex h-screen flex-col">
      <Toast />
      <TopBar onSymbolSearch={() => setDialog({ kind: "symbol" })} onIndicators={() => setDialog({ kind: "indicators" })} onScreenshot={screenshot} />
      <div className="flex min-h-0 flex-1">
        <DrawingToolbar
          tool={tool}
          onTool={chooseTool}
          onRemoveAll={() => {
            // No blocking dialog: it's one Ctrl+Z away from coming back.
            if (!(getState().drawings[symbol] || []).length) return toast("No drawings to remove");
            engine.current?.clearDrawings();
            toast("Drawings removed. Ctrl+Z to undo");
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {!ready ? (
              <div className="grid h-full place-items-center text-hive-muted">Opening {initialSymbol}…</div>
            ) : (
            <ChartView
              onReady={(e) => {
                engine.current = e;
                if (process.env.NODE_ENV === "development") Object.assign(window, { __engine: e, __tools: TOOLS });
              }}
              onSelectDrawing={(d) => setSelectedId(d?.id || null)}
              onEditDrawing={(d) => setDialog({ kind: "drawing", id: d.id })}
              onIndicatorSettings={(uid) => setDialog({ kind: "indSettings", uid })}
              onSymbolClick={() => setDialog({ kind: "symbol" })}
              onScreenshot={screenshot}
              onIndicators={() => setDialog({ kind: "indicators" })}
              onStrategies={(list) => {
                // A newly added strategy opens the tester again.
                if (list.length > reportCount.current) setTesterOpen(true);
                reportCount.current = list.length;
                setReports(list);
              }}
            />
            )}
            {favBar && <FavoritesBar tool={tool} onTool={chooseTool} />}
            {selected && engine.current && isPointer(tool) && <SelectionBar engine={engine.current} drawing={selected} onSettings={() => setDialog({ kind: "drawing", id: selected.id })} />}
          </div>
          {testerOpen && reports.length > 0 && <StrategyTester reports={reports} onClose={() => setTesterOpen(false)} onSettings={(uid) => setDialog({ kind: "indSettings", uid })} />}
          <BottomBar
            onRange={(r) => {
              const tf = RANGE_TF[r];
              if (tf === getState().tf) engine.current?.setRange(r);
              else {
                pendingRange.current = r;
                setState({ tf });
              }
            }}
          />
        </div>
        {rightPanel === "watchlist" && (
          <div className="relative shrink-0 border-l border-hive-line bg-hive-panel" style={{ width: watchWidth }}>
            <div
              className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-hive-accent/40"
              title="Drag to resize"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = watchWidth;
                const move = (ev: MouseEvent) => setState({ watchWidth: Math.max(200, Math.min(640, startW + startX - ev.clientX)) });
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                  document.body.style.userSelect = "";
                };
                document.body.style.userSelect = "none";
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            />
            <Watchlist onAdd={(section) => setDialog({ kind: "watchAdd", section })} />
          </div>
        )}
        <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-hive-line bg-hive-panel py-1.5">
          <button className={`icon-btn ${rightPanel === "watchlist" ? "text-hive-accent" : ""}`} title="Watchlist" onClick={() => setState({ rightPanel: rightPanel === "watchlist" ? null : "watchlist" })}>
            <Icon name="list" size={20} />
          </button>
        </div>
      </div>

      {dialog?.kind === "symbol" && (
        <SymbolSearch
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onPick={(s) => {
            setState({ symbol: s });
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "watchAdd" && (
        <SymbolSearch
          title="Add to watchlist"
          onClose={() => setDialog(null)}
          onImport={(dest, name, symbols) => {
            setState((st) => {
              if (dest === "new") {
                const taken = new Set(st.lists.map((l) => l.name));
                let unique = name;
                for (let n = 2; taken.has(unique); n++) unique = `${name} ${n}`;
                const id = newUid();
                return { lists: [...st.lists, { id, name: unique, sections: [{ name: "", symbols }] }], activeList: id };
              }
              // Into an existing watchlist: straight onto the end, no divider added. Dividers are the user's to place.
              return {
                activeList: dest,
                lists: st.lists.map((l) => {
                  if (l.id !== dest) return l;
                  const have = new Set(l.sections.flatMap((x) => x.symbols));
                  const fresh = symbols.filter((x) => !have.has(x));
                  if (!l.sections.length) return { ...l, sections: [{ name: "", symbols: fresh }] };
                  return { ...l, sections: l.sections.map((x, i) => (i === l.sections.length - 1 ? { ...x, symbols: [...x.symbols, ...fresh] } : x)) };
                }),
              };
            });
            setDialog(null);
          }}
          onPick={(s) => {
            setState((st) => ({
              lists: st.lists.map((l) => {
                if (l.id !== st.activeList) return l;
                const sections = l.sections.length ? l.sections : [{ name: "", symbols: [] }];
                return { ...l, sections: sections.map((w, i) => (i === dialog.section && !w.symbols.includes(s) ? { ...w, symbols: [...w.symbols, s] } : w)) };
              }),
            }));
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "indicators" && <IndicatorPicker onClose={() => setDialog(null)} onAdd={addIndicator} />}
      {dialog?.kind === "indSettings" && <IndicatorSettings uid={dialog.uid} onClose={() => setDialog(null)} />}
      {dialog?.kind === "drawing" && engine.current && (() => {
        const d: Drawing | undefined = engine.current.drawings.items.find((x) => x.id === dialog.id);
        return d ? <DrawingSettings engine={engine.current} drawing={d} onClose={() => setDialog(null)} /> : null;
      })()}
    </div>
  );
}
