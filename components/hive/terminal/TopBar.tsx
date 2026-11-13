"use client";
import { useState } from "react";
import { CHART_TYPES } from "@/lib/hive/chart/engine";
import { setState, useStore } from "@/lib/hive/store";
import { Icon, Popover } from "../ui";
import { NavLinks } from "../app/AppShell";

const TF_GROUPS: { name: string; tfs: [string, string][] }[] = [
  { name: "Minutes", tfs: [["1m", "1 minute"], ["2m", "2 minutes"], ["3m", "3 minutes"], ["5m", "5 minutes"], ["10m", "10 minutes"], ["15m", "15 minutes"], ["30m", "30 minutes"], ["45m", "45 minutes"]] },
  { name: "Hours", tfs: [["1h", "1 hour"], ["2h", "2 hours"], ["3h", "3 hours"], ["4h", "4 hours"]] },
  { name: "Days", tfs: [["1D", "1 day"], ["1W", "1 week"], ["1M", "1 month"], ["3M", "3 months"], ["6M", "6 months"], ["12M", "12 months"]] },
];
export const tfLabel = (tf: string) => tf.replace(/^1([DWM])$/, "$1").replace(/^(\d+)m$/, "$1m");

type Props = {
  onSymbolSearch: () => void;
  onIndicators: () => void;
  onScreenshot: () => void;
  onCompareSoon?: () => void;
};

export default function TopBar({ onSymbolSearch, onIndicators, onScreenshot }: Props) {
  const symbol = useStore((s) => s.symbol);
  const tf = useStore((s) => s.tf);
  const type = useStore((s) => s.type);
  const favs = useStore((s) => s.favoriteTfs);
  const theme = useStore((s) => s.theme);
  const [custom, setCustom] = useState("");

  const toggleFav = (t: string) => setState((s) => ({ favoriteTfs: s.favoriteTfs.includes(t) ? s.favoriteTfs.filter((x) => x !== t) : [...s.favoriteTfs, t] }));
  const typeName = CHART_TYPES.find(([id]) => id === type)?.[1] || "Candles";

  return (
    <div className="flex h-11 shrink-0 items-center gap-0.5 border-b border-hive-line bg-hive-panel px-2">
      <button className="btn min-w-[120px] justify-start font-semibold" onClick={onSymbolSearch} title="Symbol search (just start typing on the chart)">
        <Icon name="search" size={16} className="text-hive-muted" />
        {symbol.split(":").pop()}
      </button>
      <div className="divider-v" />
      {favs.map((t) => (
        <button key={t} className={`btn px-1.5 ${t === tf ? "btn-on" : ""}`} onClick={() => setState({ tf: t })}>
          {tfLabel(t)}
        </button>
      ))}
      <Popover
        button={(open, toggle) => (
          <button className={`icon-btn w-6 ${open ? "bg-hive-hover" : ""}`} onClick={toggle} title="Timeframes">
            <Icon name="chevronDown" size={14} />
          </button>
        )}
      >
        {(close) => (
          <div className="max-h-[70vh] w-56 overflow-auto">
            <div className="flex gap-1 px-2 py-1.5">
              <input
                className="input h-7 flex-1"
                placeholder="Custom: 7m, 2h, 3D"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && /^\d+[smhDWM]$/.test(custom.trim())) {
                    setState({ tf: custom.trim() });
                    close();
                  }
                }}
              />
            </div>
            {TF_GROUPS.map((g) => (
              <div key={g.name}>
                <div className="px-3 pt-2 text-2xs uppercase tracking-wide text-hive-muted">{g.name}</div>
                {g.tfs.map(([t, name]) => (
                  <div key={t} className={`menu-item justify-between ${t === tf ? "text-hive-accent" : ""}`}>
                    <button
                      className="flex-1 text-left"
                      onClick={() => {
                        setState({ tf: t });
                        close();
                      }}
                    >
                      {name}
                    </button>
                    <button onClick={() => toggleFav(t)} title={favs.includes(t) ? "Remove from favourites" : "Add to favourites"} className={favs.includes(t) ? "text-[#ffb300]" : "text-hive-muted hover:text-hive-text"}>
                      <Icon name="star" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Popover>
      <div className="divider-v" />
      <Popover
        button={(open, toggle) => (
          <button className={`btn ${open ? "bg-hive-hover" : ""}`} onClick={toggle} title={typeName}>
            <Icon name="candles" />
            <span className="hidden xl:inline">{typeName}</span>
          </button>
        )}
      >
        {(close) => (
          <div className="w-52">
            {CHART_TYPES.map(([id, name]) => (
              <button
                key={id}
                className={`menu-item ${id === type ? "text-hive-accent" : ""}`}
                onClick={() => {
                  setState({ type: id });
                  close();
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </Popover>
      <div className="divider-v" />
      <button className="btn" onClick={onIndicators} title="Indicators (/)">
        <Icon name="indicators" />
        Indicators
      </button>
      <div className="flex-1" />
      <NavLinks className="hidden lg:flex" />
      <div className="divider-v" />
      <button className="icon-btn" onClick={() => setState({ theme: theme === "dark" ? "light" : "dark" })} title="Light / dark theme">
        <Icon name={theme === "dark" ? "sun" : "moon"} />
      </button>
      <button className="icon-btn" onClick={onScreenshot} title="Download chart image">
        <Icon name="camera" />
      </button>
      <button
        className="icon-btn"
        onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
        title="Fullscreen"
      >
        <Icon name="fullscreen" />
      </button>
    </div>
  );
}
