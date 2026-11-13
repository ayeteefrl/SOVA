"use client";
import { useState } from "react";
import { BY_ID, defaults } from "@/lib/hive/engine";
import { shortName, type IndicatorInstance } from "@/lib/hive/chart/engine";
import { getState, setState } from "@/lib/hive/store";
import { ColorInput, Field, Modal, Toggle } from "../ui";

const SOURCES = ["close", "open", "high", "low", "hl2", "hlc3", "ohlc4", "hlcc4", "volume"];
const TFS = ["", "1m", "5m", "15m", "30m", "1h", "2h", "4h", "1D", "1W", "1M"];
const PLOTS = [
  ["line", "Line"],
  ["step", "Step line"],
  ["circles", "Circles"],
  ["cross", "Cross"],
  ["area", "Area"],
  ["columns", "Columns"],
];

// Changes show on the chart as you make them; Cancel puts the indicator back as it was.
export default function IndicatorSettings({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [original] = useState(() => getState().indicators.find((x) => x.uid === uid));
  const [ind, setInd] = useState<IndicatorInstance | undefined>(original);
  const [tab, setTab] = useState<"inputs" | "style" | "levels">("inputs");
  if (!ind || !original) return null;
  const def = BY_ID[ind.id];
  if (!def) return null;

  const apply = (next: IndicatorInstance) => {
    setInd(next);
    setState((s) => ({ indicators: s.indicators.map((x) => (x.uid === uid ? next : x)) }));
  };
  const setParam = (k: string, v: unknown) => apply({ ...ind, params: { ...ind.params, [k]: v } });
  const setStyle = (k: string, patch: object) => apply({ ...ind, styles: { ...ind.styles, [k]: { ...ind.styles?.[k], ...patch } } });
  const levels = ind.levels || (def.levels || []).map((v) => ({ value: v, color: "#787b86", visible: true }));
  const others = getState().indicators.filter((x) => x.uid !== uid && BY_ID[x.id]);

  return (
    <Modal
      title={shortName(def.name) === def.name ? def.name : `${def.name}`}
      onClose={() => {
        apply(original);
        onClose();
      }}
      width={480}
      footer={
        <>
          <button className="btn mr-auto" onClick={() => apply({ ...ind, params: defaults(ind.id), styles: {}, fills: undefined, levels: undefined, tf: undefined })}>
            Defaults
          </button>
          <button
            className="btn border border-hive-line"
            onClick={() => {
              apply(original);
              onClose();
            }}
          >
            Cancel
          </button>
          <button className="btn bg-hive-accent px-4 text-white hover:bg-hive-accent/90" onClick={onClose}>
            Ok
          </button>
        </>
      }
    >
      <div className="flex gap-1 border-b border-hive-line px-3">
        {(["inputs", "style", ...(levels.length || !def.overlay ? ["levels"] : [])] as const).map((t) => (
          <button key={t} className={`tab capitalize ${tab === t ? "tab-on" : ""}`} onClick={() => setTab(t as typeof tab)}>
            {t}
          </button>
        ))}
      </div>
      <div className="py-2">
        {tab === "inputs" && (
          <>
            {def.inputs.map((inp, idx) => {
              const v = ind.params[inp.key] ?? inp.default;
              const heading = inp.group && inp.group !== def.inputs[idx - 1]?.group ? <div className="px-5 pb-1 pt-3 text-2xs font-semibold uppercase tracking-wide text-hive-muted">{inp.group}</div> : null;
              return (
                <div key={inp.key}>
                {heading}
                <Field label={inp.label}>
                  {inp.type === "int" || inp.type === "float" ? (
                    <input
                      type="number"
                      className="input w-28 text-right"
                      value={String(v ?? "")}
                      min={inp.min}
                      max={inp.max}
                      step={inp.step ?? (inp.type === "int" ? 1 : 0.1)}
                      onChange={(e) => setParam(inp.key, e.target.value === "" ? inp.default : inp.type === "int" ? Math.round(Number(e.target.value)) : Number(e.target.value))}
                    />
                  ) : inp.type === "select" || inp.type === "ltf" || inp.type === "breadth" ? (
                    <select className="input w-40" value={String(v)} onChange={(e) => setParam(inp.key, e.target.value)}>
                      {inp.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : inp.type === "source" ? (
                    <select className="input w-48" value={String(v)} onChange={(e) => setParam(inp.key, e.target.value)}>
                      {SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      {others.flatMap((o) =>
                        BY_ID[o.id].outputs.map((out) => (
                          <option key={`${o.uid}:${out.key}`} value={`ind:${o.uid}:${out.key}`}>
                            {shortName(BY_ID[o.id].name)}: {out.label}
                          </option>
                        )),
                      )}
                    </select>
                  ) : inp.type === "bool" ? (
                    <Toggle checked={Boolean(v)} onChange={(c) => setParam(inp.key, c)} />
                  ) : inp.type === "color" ? (
                    <ColorInput value={String(v)} onChange={(c) => setParam(inp.key, c)} />
                  ) : inp.type === "symbol" ? (
                    <input className="input w-40 uppercase" value={String(v ?? "")} onChange={(e) => setParam(inp.key, e.target.value.toUpperCase())} placeholder="NSE:NIFTY" />
                  ) : inp.type === "time" ? (
                    <input
                      type="date"
                      className="input w-40"
                      value={v ? new Date((v as number) * 1000).toISOString().slice(0, 10) : ""}
                      onChange={(e) => setParam(inp.key, e.target.value ? Date.parse(e.target.value + "T00:00:00Z") / 1000 : null)}
                    />
                  ) : (
                    <input className="input w-40" value={String(v ?? "")} onChange={(e) => setParam(inp.key, e.target.value)} />
                  )}
                </Field>
                </div>
              );
            })}
            <Field label="Timeframe">
              <select className="input w-40" value={ind.tf || ""} onChange={(e) => apply({ ...ind, tf: e.target.value || undefined })}>
                {TFS.map((t) => (
                  <option key={t} value={t}>
                    {t || "Chart"}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        {tab === "style" && (
          <>
            {def.outputs.map((o) => {
              const st = ind.styles?.[o.key] || {};
              const plot = st.plot || o.plot || (o.kind === "histogram" ? "columns" : "line");
              return (
                <Field
                  key={o.key}
                  label={<Toggle checked={st.visible ?? !o.hiddenByDefault} onChange={(c) => setStyle(o.key, { visible: c })} label={<span className="text-hive-text">{o.label}</span>} />}
                >
                  <ColorInput value={st.color || o.color} onChange={(c) => setStyle(o.key, { color: c })} />
                  <select className="input w-24" value={plot} onChange={(e) => setStyle(o.key, { plot: e.target.value })} title="Plot style">
                    {PLOTS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  {plot !== "columns" && (
                    <>
                      <select className="input w-16" value={st.width || o.lineWidth || 1} onChange={(e) => setStyle(o.key, { width: Number(e.target.value) })} title="Thickness">
                        {[1, 2, 3, 4].map((w) => (
                          <option key={w} value={w}>
                            {w}px
                          </option>
                        ))}
                      </select>
                      <select className="input w-20" value={st.style || 0} onChange={(e) => setStyle(o.key, { style: Number(e.target.value) })} title="Line style">
                        <option value={0}>Solid</option>
                        <option value={1}>Dashed</option>
                        <option value={2}>Dotted</option>
                      </select>
                    </>
                  )}
                </Field>
              );
            })}
            {(def.fills || []).map((f) => {
              const fs = ind.fills?.[f.id] || {};
              return (
                <Field key={f.id} label={<Toggle checked={fs.visible ?? !f.hiddenByDefault} onChange={(c) => apply({ ...ind, fills: { ...ind.fills, [f.id]: { ...fs, visible: c } } })} label={<span className="text-hive-text">{f.label}</span>} />}>
                  {f.upColor && f.downColor ? (
                    // Two colours: one where the first line is on top, one where it's below.
                    <>
                      <span className="text-2xs text-hive-muted" title={`Colour where ${f.from} is above ${f.to}`}>Up</span>
                      <ColorInput value={fs.upColor || f.upColor} onChange={(c) => apply({ ...ind, fills: { ...ind.fills, [f.id]: { ...fs, upColor: c } } })} />
                      <span className="text-2xs text-hive-muted" title={`Colour where ${f.from} is below ${f.to}`}>Down</span>
                      <ColorInput value={fs.downColor || f.downColor} onChange={(c) => apply({ ...ind, fills: { ...ind.fills, [f.id]: { ...fs, downColor: c } } })} />
                    </>
                  ) : (
                    <ColorInput
                      value={fs.color || f.color || (f.gradient ? f.gradient.topColor : "rgba(41,98,255,0.1)")}
                      onChange={(c) => apply({ ...ind, fills: { ...ind.fills, [f.id]: { ...fs, color: c } } })}
                    />
                  )}
                </Field>
              );
            })}
          </>
        )}
        {tab === "levels" && (
          <>
            {levels.map((lv, i) => (
              <Field key={i} label={<Toggle checked={lv.visible} onChange={(c) => apply({ ...ind, levels: levels.map((x, j) => (j === i ? { ...x, visible: c } : x)) })} label={<span className="text-hive-text">Level {i + 1}</span>} />}>
                <input type="number" className="input w-24 text-right" value={lv.value} onChange={(e) => apply({ ...ind, levels: levels.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)) })} />
                <ColorInput value={lv.color} onChange={(c) => apply({ ...ind, levels: levels.map((x, j) => (j === i ? { ...x, color: c } : x)) })} />
                <button className="icon-btn h-7 w-7 text-hive-muted hover:text-hive-down" onClick={() => apply({ ...ind, levels: levels.filter((_, j) => j !== i) })} title="Remove level">
                  ✕
                </button>
              </Field>
            ))}
            <div className="px-5 py-2">
              <button className="btn border border-hive-line" onClick={() => apply({ ...ind, levels: [...levels, { value: 0, color: "#787b86", visible: true }] })}>
                + Add level
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
