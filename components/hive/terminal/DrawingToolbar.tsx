"use client";
import { useState } from "react";
import { TOOLS, TOOL_BY_ID } from "@/lib/hive/drawings/registry";
import { CURSORS, GROUPS, isPointer, type ToolGroup } from "@/lib/hive/drawings/types";
import { setState, useStore } from "@/lib/hive/store";
import { Icon, ToolIcon } from "../ui";

type Props = { tool: string; onTool: (id: string) => void; onRemoveAll: () => void };

export default function DrawingToolbar({ tool, onTool, onRemoveAll }: Props) {
  const lastTool = useStore((s) => s.lastTool);
  const favorites = useStore((s) => s.favoriteTools);
  const magnet = useStore((s) => s.magnet);
  const keepDrawing = useStore((s) => s.keepDrawing);
  const lockAll = useStore((s) => s.lockAll);
  const hideAll = useStore((s) => s.hideAll);
  const favBar = useStore((s) => s.favBar);
  const [open, setOpen] = useState<ToolGroup | "magnet" | null>(null);

  const pick = (id: string) => {
    const def = TOOL_BY_ID[id];
    if (def) setState((s) => ({ lastTool: { ...s.lastTool, [def.group]: id } }));
    onTool(id);
    setOpen(null);
  };
  const toggleFav = (id: string) => setState((s) => ({ favoriteTools: s.favoriteTools.includes(id) ? s.favoriteTools.filter((x) => x !== id) : [...s.favoriteTools, id] }));

  return (
    <div className="relative flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-hive-line bg-hive-panel py-1.5" onMouseLeave={() => setOpen(null)}>
      <div className="group relative">
        {(() => {
          const cur = CURSORS.find((c) => c.id === (isPointer(tool) ? tool : lastTool.cursors)) || CURSORS[0];
          return (
            <Btn active={isPointer(tool)} title={cur.name} onClick={() => onTool(cur.id)}>
              <ToolIcon svg={cur.icon} />
            </Btn>
          );
        })()}
        <button className="absolute -right-1 top-0 hidden h-9 w-3 items-center justify-center text-hive-muted hover:text-hive-text group-hover:flex" onClick={() => setOpen(open === "cursors" ? null : "cursors")} aria-label="Cursors">
          <Icon name="chevronRight" size={10} />
        </button>
        {open === "cursors" && (
          <div className="menu absolute left-full top-0 z-40 ml-1 w-56">
            {CURSORS.map((c) => (
              <button
                key={c.id}
                className={`menu-item h-9 ${c.id === tool ? "text-hive-accent" : ""}`}
                onClick={() => {
                  setState((s) => ({ lastTool: { ...s.lastTool, cursors: c.id } }));
                  onTool(c.id);
                  setOpen(null);
                }}
              >
                <ToolIcon svg={c.icon} size={24} />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {GROUPS.filter((g) => g.id !== "cursors").map((g) => {
        const tools = TOOLS.filter((t) => t.group === g.id);
        if (!tools.length) return null;
        const shown = TOOL_BY_ID[lastTool[g.id]] || tools[0];
        const activeHere = TOOL_BY_ID[tool]?.group === g.id;
        return (
          <div key={g.id} className="group relative">
            <Btn active={activeHere} title={shown.name} onClick={() => pick(shown.id)}>
              <ToolIcon svg={(activeHere ? TOOL_BY_ID[tool] : shown).icon} />
            </Btn>
            <button className="absolute -right-1 top-0 hidden h-9 w-3 items-center justify-center text-hive-muted hover:text-hive-text group-hover:flex" onClick={() => setOpen(open === g.id ? null : g.id)} aria-label={`More ${g.name}`}>
              <Icon name="chevronRight" size={10} />
            </button>
            {open === g.id && (
              <div className="menu absolute left-full top-0 z-40 ml-1 max-h-[78vh] w-72 overflow-auto">
                <div className="px-3 pb-1 pt-1.5 text-2xs uppercase tracking-wide text-hive-muted">{g.name}</div>
                {tools.map((t) => (
                  <div key={t.id} className={`menu-item h-9 pr-2 ${t.id === tool ? "text-hive-accent" : ""}`}>
                    <button className="flex flex-1 items-center gap-2 text-left" onClick={() => pick(t.id)}>
                      <ToolIcon svg={t.icon} size={24} />
                      {t.name}
                    </button>
                    {t.hotkey && <span className="text-2xs text-hive-muted">{t.hotkey}</span>}
                    <button onClick={() => toggleFav(t.id)} className={favorites.includes(t.id) ? "text-[#ffb300]" : "text-hive-muted opacity-0 hover:text-hive-text group-hover:opacity-100"} title="Favourite">
                      <Icon name="star" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="my-1 h-px w-7 bg-hive-line" />
      <div className="relative">
        <Btn active={magnet !== "off"} title={`Magnet: ${magnet}`} onClick={() => setOpen(open === "magnet" ? null : "magnet")}>
          <Icon name="magnet" size={20} />
        </Btn>
        {open === "magnet" && (
          <div className="menu absolute left-full top-0 z-40 ml-1 w-56">
            {(["off", "weak", "strong"] as const).map((m) => (
              <button
                key={m}
                className={`menu-item ${magnet === m ? "text-hive-accent" : ""}`}
                onClick={() => {
                  setState({ magnet: m });
                  setOpen(null);
                }}
              >
                {m === "off" ? "Magnet off" : m === "weak" ? "Weak magnet (snaps when close)" : "Strong magnet (always snaps)"}
              </button>
            ))}
          </div>
        )}
      </div>
      <Btn active={favBar} title={favBar ? "Hide favourites bar" : "Show favourites bar on the chart"} onClick={() => setState({ favBar: !favBar })}>
        <Icon name="star" size={20} />
      </Btn>
      <Btn active={keepDrawing} title="Keep drawing (stay in the tool after placing)" onClick={() => setState({ keepDrawing: !keepDrawing })}>
        <Icon name="pencil" size={20} />
      </Btn>
      <Btn active={lockAll} title={lockAll ? "Unlock all drawings" : "Lock all drawings"} onClick={() => setState({ lockAll: !lockAll })}>
        <Icon name={lockAll ? "lock" : "unlock"} size={20} />
      </Btn>
      <Btn active={hideAll} title={hideAll ? "Show all drawings" : "Hide all drawings"} onClick={() => setState({ hideAll: !hideAll })}>
        <Icon name={hideAll ? "eyeOff" : "eye"} size={20} />
      </Btn>
      <div className="my-1 h-px w-7 bg-hive-line" />
      <Btn title="Remove all drawings on this symbol" onClick={onRemoveAll}>
        <Icon name="trash" size={20} />
      </Btn>
    </div>
  );
}

function Btn({ active, title, onClick, children }: { active?: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`grid h-9 w-9 place-items-center rounded transition-colors ${active ? "bg-hive-accent/15 text-hive-accent" : "text-hive-text hover:bg-hive-hover"}`} title={title} onClick={onClick}>
      {children}
    </button>
  );
}
