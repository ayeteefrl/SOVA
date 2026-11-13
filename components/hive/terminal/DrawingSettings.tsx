"use client";
import { useState } from "react";
import { TOOL_BY_ID, newId } from "@/lib/hive/drawings/registry";
import type { Drawing, SettingField } from "@/lib/hive/drawings/types";
import type { ChartEngine } from "@/lib/hive/chart/engine";
import { ColorInput, Field, Icon, Modal, Toggle } from "../ui";

const VIS_TFS = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1M"];

export function DrawingSettings({ engine, drawing, onClose }: { engine: ChartEngine; drawing: Drawing; onClose: () => void }) {
  const [original] = useState<Drawing>(() => structuredClone(stripBox(drawing)));
  const [d, setD] = useState<Drawing>(() => structuredClone(stripBox(drawing)));
  const [tab, setTab] = useState<"style" | "text" | "coords" | "visibility">("style");
  const def = TOOL_BY_ID[d.tool];
  if (!def) return null;

  const apply = (next: Drawing) => {
    setD(next);
    engine.updateDrawing(structuredClone(next));
  };
  const setProp = (k: string, v: unknown) => apply({ ...d, props: { ...d.props, [k]: v } });
  const textual = def.editsText || def.fields?.some((f) => f.key === "text");
  const fields = (def.fields || []).filter((f) => !(tab === "style" && ["text", "textColor", "fontSize", "bold", "italic"].includes(f.key)));

  return (
    <Modal
      title={def.name}
      onClose={() => {
        apply(original);
        onClose();
      }}
      width={460}
      footer={
        <>
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
        {(["style", "text", "coords", "visibility"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "tab-on" : ""}`} onClick={() => setTab(t)}>
            {t === "coords" ? "Coordinates" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="py-2">
        {tab === "style" && (
          <>
            <Field label="Line">
              <ColorInput value={d.props.color} onChange={(c) => setProp("color", c)} />
              <select className="input w-16" value={d.props.width} onChange={(e) => setProp("width", Number(e.target.value))}>
                {[1, 2, 3, 4].map((w) => (
                  <option key={w} value={w}>
                    {w}px
                  </option>
                ))}
              </select>
              <select className="input w-24" value={d.props.style} onChange={(e) => setProp("style", Number(e.target.value))}>
                <option value={0}>Solid</option>
                <option value={1}>Dashed</option>
                <option value={2}>Dotted</option>
              </select>
            </Field>
            {fields.map((f) => (
              <SettingRow key={f.key} f={f} d={d} setProp={setProp} />
            ))}
          </>
        )}
        {tab === "text" && (
          <>
            <div className="px-5 py-2">
              <textarea className="input h-24 w-full py-1.5" placeholder="Add text" value={d.props.text} onChange={(e) => setProp("text", e.target.value)} />
            </div>
            <Field label="Text">
              <ColorInput value={d.props.textColor} onChange={(c) => setProp("textColor", c)} />
              <select className="input w-20" value={d.props.fontSize} onChange={(e) => setProp("fontSize", Number(e.target.value))}>
                {[10, 11, 12, 14, 16, 20, 24, 28, 32, 40].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button className={`icon-btn h-8 w-8 font-bold ${d.props.bold ? "btn-on" : ""}`} onClick={() => setProp("bold", !d.props.bold)}>
                B
              </button>
              <button className={`icon-btn h-8 w-8 italic ${d.props.italic ? "btn-on" : ""}`} onClick={() => setProp("italic", !d.props.italic)}>
                I
              </button>
            </Field>
            {!textual && <div className="px-5 pb-2 text-2xs text-hive-muted">Text shows beside the drawing.</div>}
          </>
        )}
        {tab === "coords" &&
          d.points.map((p, i) => (
            <Field key={i} label={`Point ${i + 1}`}>
              <input
                type="number"
                className="input w-32 text-right"
                value={Number(p.price.toFixed(4))}
                step="any"
                onChange={(e) => apply({ ...d, points: d.points.map((q, j) => (j === i ? { ...q, price: Number(e.target.value) } : q)) })}
              />
              <input
                type="datetime-local"
                className="input w-48"
                value={new Date((p.time - new Date().getTimezoneOffset() * 60) * 1000).toISOString().slice(0, 16)}
                onChange={(e) => {
                  const t = Date.parse(e.target.value) / 1000;
                  if (Number.isFinite(t)) apply({ ...d, points: d.points.map((q, j) => (j === i ? { ...q, time: t } : q)) });
                }}
              />
            </Field>
          ))}
        {tab === "visibility" && (
          <div className="px-5 py-2">
            <div className="mb-2 text-hive-muted">Show this drawing on:</div>
            <div className="grid grid-cols-3 gap-2">
              {VIS_TFS.map((t) => (
                <Toggle key={t} checked={!(d.hideOn || []).includes(t)} onChange={(c) => apply({ ...d, hideOn: c ? (d.hideOn || []).filter((x) => x !== t) : [...(d.hideOn || []), t] })} label={t} />
              ))}
            </div>
            <div className="mt-2 text-2xs text-hive-muted">Other timeframes always show it.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SettingRow({ f, d, setProp }: { f: SettingField; d: Drawing; setProp: (k: string, v: unknown) => void }) {
  const v = d.props[f.key];
  if (f.type === "levels")
    return (
      <div className="px-5 py-2">
        <div className="mb-1.5 text-hive-muted">{f.label}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {d.props.levels.map((lv, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={lv.visible}
                className="h-4 w-4"
                onChange={(e) =>
                  setProp(
                    "levels",
                    d.props.levels.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)),
                  )
                }
              />
              <input
                type="number"
                step="any"
                className="input h-7 w-20 text-right"
                value={lv.value}
                onChange={(e) =>
                  setProp(
                    "levels",
                    d.props.levels.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)),
                  )
                }
              />
              <ColorInput value={lv.color} onChange={(c) => setProp("levels", d.props.levels.map((x, j) => (j === i ? { ...x, color: c } : x)))} />
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <Field label={f.label}>
      {f.type === "color" && <ColorInput value={String(v ?? "#2962ff")} onChange={(c) => setProp(f.key, c)} />}
      {f.type === "image" && (
        <label className="btn cursor-pointer border border-hive-line">
          {v ? "Change image" : "Choose image"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && shrinkImage(e.target.files[0]).then((url) => setProp(f.key, url))} />
        </label>
      )}
      {f.type === "bool" && <Toggle checked={v !== false && v != null ? Boolean(v) : false} onChange={(c) => setProp(f.key, c)} />}
      {f.type === "number" && <input type="number" className="input w-28 text-right" value={Number(v ?? 0)} min={f.min} max={f.max} step={f.step ?? "any"} onChange={(e) => setProp(f.key, Number(e.target.value))} />}
      {(f.type === "text" || f.type === "textarea") && <input className="input w-48" value={String(v ?? "")} onChange={(e) => setProp(f.key, e.target.value)} />}
      {f.type === "select" && (
        <select className="input w-40" value={String(v)} onChange={(e) => setProp(f.key, e.target.value)}>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

// The little toolbar that floats over the chart while a drawing is selected.
export function SelectionBar({ engine, drawing, onSettings }: { engine: ChartEngine; drawing: Drawing; onSettings: () => void }) {
  const def = TOOL_BY_ID[drawing.tool];
  const update = (patch: Partial<Drawing>) => engine.updateDrawing({ ...drawing, ...patch });
  const setProp = (k: string, v: unknown) => update({ props: { ...drawing.props, [k]: v } });
  return (
    <div className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-hive-line bg-hive-raised px-1 py-1 shadow-xl shadow-black/30">
      <span className="px-2 text-2xs text-hive-muted">{def?.name}</span>
      <ColorInput value={drawing.props.color} onChange={(c) => setProp("color", c)} />
      <select className="input h-7 w-14 px-1" value={drawing.props.width} onChange={(e) => setProp("width", Number(e.target.value))} title="Thickness">
        {[1, 2, 3, 4].map((w) => (
          <option key={w} value={w}>
            {w}px
          </option>
        ))}
      </select>
      <select className="input h-7 w-20 px-1" value={drawing.props.style} onChange={(e) => setProp("style", Number(e.target.value))} title="Line style">
        <option value={0}>Solid</option>
        <option value={1}>Dashed</option>
        <option value={2}>Dotted</option>
      </select>
      <button className="icon-btn h-7 w-7" onClick={onSettings} title="Settings">
        <Icon name="gear" size={16} />
      </button>
      <button className={`icon-btn h-7 w-7 ${drawing.locked ? "text-hive-accent" : ""}`} onClick={() => update({ locked: !drawing.locked })} title={drawing.locked ? "Unlock" : "Lock"}>
        <Icon name={drawing.locked ? "lock" : "unlock"} size={16} />
      </button>
      <button
        className="icon-btn h-7 w-7"
        title="Clone"
        onClick={() => {
          const copy = { ...structuredClone(stripBox(drawing)), id: newId(), locked: false };
          const step = engine.step;
          copy.points = copy.points.map((p) => ({ ...p, time: p.time + step * 5 }));
          engine.setDrawings([...engine.drawings.items, copy]);
          engine.updateDrawing(copy);
        }}
      >
        <Icon name="copy" size={16} />
      </button>
      <button className="icon-btn h-7 w-7 hover:text-hive-down" onClick={() => engine.deleteSelected()} title="Remove (Delete)">
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}

// Pictures are kept with the drawing in this browser's storage, so large ones are scaled down
// to at most 800 px and saved as JPEG/PNG data.
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 800 / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function stripBox(d: Drawing): Drawing {
  const rest = { ...d } as Drawing & { _box?: unknown };
  delete rest._box;
  return rest;
}
