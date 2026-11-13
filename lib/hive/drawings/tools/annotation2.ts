// Annotation tools: note, price note, pin, table, callout, comment, signpost, flag mark, image; and icons.
import type { Drawing, RenderCtx, ToolDef, XY } from "../types";
import { distToSeg, font, label, line, roundRect, withAlpha } from "../geom";

type Box = { x: number; y: number; w: number; h: number };
const boxHit = (_c: RenderCtx, _p: XY[], d: Drawing, x: number, y: number) => {
  const b = (d as { _box?: Box })._box;
  return b && x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.y + b.h + 3 ? 0 : Infinity;
};
const keepBox = (d: Drawing, b: Box) => ((d as { _box?: Box })._box = b);
const TEXT_FIELDS: ToolDef["fields"] = [
  { key: "text", label: "Text", type: "textarea" },
  { key: "textColor", label: "Text colour", type: "color" },
  { key: "fontSize", label: "Font size", type: "number", min: 8, max: 72 },
  { key: "fillColor", label: "Background", type: "color" },
];

// Images are loaded once and redrawn when ready.
const images = new Map<string, HTMLImageElement>();
function imageFor(src: string) {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.onload = () => window.dispatchEvent(new Event("terminal:redraw"));
    img.src = src;
    images.set(src, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

function bubble(c: RenderCtx, d: Drawing, at: XY, tail: XY | null) {
  const txt = d.props.text || "Text";
  c.ctx.font = font(d.props);
  const lines = txt.split("\n");
  const lh = d.props.fontSize * 1.3;
  const w = Math.max(...lines.map((l) => c.ctx.measureText(l).width)) + 20,
    h = lh * lines.length + 14;
  const x = at.x - w / 2,
    y = at.y - h / 2;
  c.ctx.fillStyle = d.props.fillColor;
  c.ctx.strokeStyle = d.props.color;
  c.ctx.lineWidth = 1;
  c.ctx.setLineDash([]);
  if (tail) {
    c.ctx.beginPath();
    c.ctx.moveTo(tail.x, tail.y);
    c.ctx.lineTo(at.x - 8, at.y);
    c.ctx.lineTo(at.x + 8, at.y);
    c.ctx.closePath();
    c.ctx.fill();
    c.ctx.stroke();
  }
  roundRect(c.ctx, x, y, w, h, 6);
  c.ctx.fill();
  c.ctx.stroke();
  c.ctx.fillStyle = d.props.textColor;
  c.ctx.textBaseline = "middle";
  c.ctx.textAlign = "left";
  lines.forEach((l, i) => c.ctx.fillText(l, x + 10, y + 7 + lh * i + lh / 2));
  keepBox(d, { x, y, w, h });
}

function pinShape(c: RenderCtx, p: XY, color: string) {
  c.ctx.fillStyle = color;
  c.ctx.beginPath();
  c.ctx.arc(p.x, p.y - 18, 8, Math.PI, 0);
  c.ctx.lineTo(p.x, p.y);
  c.ctx.closePath();
  c.ctx.fill();
  c.ctx.fillStyle = "#fff";
  c.ctx.beginPath();
  c.ctx.arc(p.x, p.y - 18, 3, 0, Math.PI * 2);
  c.ctx.fill();
}

const TEXTY = { fontSize: 13, textColor: "#d1d4dc", fillColor: "rgba(30,34,45,0.95)", color: "#2962ff" };

export const ANNOTATION_TOOLS_2: ToolDef[] = [
  {
    id: "note",
    name: "Note",
    group: "annotation",
    icon: '<path d="M5 5h18v14l-5 5H5z"/><path d="M18 24v-5h5M9 10h10M9 14h7"/>',
    points: 1,
    editsText: true,
    defaults: { ...TEXTY, text: "Note", fillColor: "rgba(255,235,59,0.9)", textColor: "#131722" },
    fields: TEXT_FIELDS,
    draw: (c, p, d) => {
      const txt = d.props.text || "Note";
      c.ctx.font = font(d.props);
      const lines = txt.split("\n");
      const lh = d.props.fontSize * 1.35;
      const w = Math.min(260, Math.max(80, ...lines.map((l) => c.ctx.measureText(l).width + 20))),
        h = lh * lines.length + 16;
      const { x, y } = p[0];
      c.ctx.fillStyle = d.props.fillColor;
      c.ctx.shadowColor = "rgba(0,0,0,0.3)";
      c.ctx.shadowBlur = 6;
      c.ctx.fillRect(x, y, w, h);
      c.ctx.shadowBlur = 0;
      c.ctx.fillStyle = d.props.textColor;
      c.ctx.textBaseline = "middle";
      lines.forEach((l, i) => c.ctx.fillText(l, x + 10, y + 8 + lh * i + lh / 2));
      keepBox(d, { x, y, w, h });
    },
    hit: boxHit,
  },
  {
    id: "price_note",
    name: "Price note",
    group: "annotation",
    icon: '<circle cx="6" cy="20" r="2"/><path d="M8 18L16 10"/><rect x="14" y="5" width="11" height="7" rx="1"/>',
    points: 2,
    defaults: { ...TEXTY },
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      c.ctx.strokeStyle = d.props.color;
      c.ctx.lineWidth = 1;
      c.ctx.setLineDash([]);
      line(c.ctx, a, b);
      c.ctx.fillStyle = d.props.color;
      c.ctx.beginPath();
      c.ctx.arc(a.x, a.y, 3.5, 0, Math.PI * 2);
      c.ctx.fill();
      keepBox(d, label(c.ctx, c.fmtPrice(d.points[0].price), b.x, b.y, { align: "center", color: "#fff", bg: d.props.color, font: "12px Inter, sans-serif", pad: 6 }));
    },
    hit: (c, p, d, x, y) => Math.min(boxHit(c, p, d, x, y), p[1] ? distToSeg({ x, y }, p[0], p[1]) : Infinity),
  },
  {
    id: "pin",
    name: "Pin",
    group: "annotation",
    icon: '<path d="M14 24c-4-6-7-9-7-13a7 7 0 0 1 14 0c0 4-3 7-7 13z"/><circle cx="14" cy="11" r="2.5"/>',
    points: 1,
    defaults: { ...TEXTY, color: "#f23645", text: "" },
    fields: TEXT_FIELDS,
    draw: (c, p, d) => {
      pinShape(c, p[0], d.props.color);
      // The pin's text shows while it's selected or under the mouse, like TradingView.
      if (d.props.text && c.active) bubble(c, d, { x: p[0].x, y: p[0].y - 50 }, null);
      else keepBox(d, { x: p[0].x - 9, y: p[0].y - 27, w: 18, h: 27 });
    },
    hit: boxHit,
  },
  {
    id: "table",
    name: "Table",
    group: "annotation",
    icon: '<rect x="4" y="6" width="20" height="16"/><path d="M4 11h20M4 16h20M11 6v16M18 6v16"/>',
    points: 1,
    editsText: true,
    defaults: { ...TEXTY, text: "Header 1 | Header 2\nCell | Cell\nCell | Cell" },
    fields: [{ key: "text", label: "Rows (one per line, cells split by |)", type: "textarea" }, ...(TEXT_FIELDS || []).slice(1)],
    draw: (c, p, d) => {
      const rows = (d.props.text || "").split("\n").map((r) => r.split("|").map((s) => s.trim()));
      c.ctx.font = font(d.props);
      const cols = Math.max(...rows.map((r) => r.length));
      const widths = Array.from({ length: cols }, (_, j) => Math.max(40, ...rows.map((r) => c.ctx.measureText(r[j] || "").width + 16)));
      const rh = d.props.fontSize + 12;
      const { x, y } = p[0];
      const w = widths.reduce((a, b) => a + b, 0),
        h = rh * rows.length;
      c.ctx.fillStyle = d.props.fillColor;
      c.ctx.fillRect(x, y, w, h);
      c.ctx.strokeStyle = withAlpha(d.props.color, 0.6);
      c.ctx.lineWidth = 1;
      c.ctx.setLineDash([]);
      c.ctx.strokeRect(x, y, w, h);
      rows.forEach((r, i) => {
        let cx = x;
        if (i) line(c.ctx, { x, y: y + rh * i }, { x: x + w, y: y + rh * i });
        r.forEach((cell, j) => {
          c.ctx.fillStyle = i === 0 ? d.props.color : d.props.textColor;
          c.ctx.textBaseline = "middle";
          c.ctx.fillText(cell, cx + 8, y + rh * i + rh / 2);
          cx += widths[j];
          if (j < cols - 1) line(c.ctx, { x: cx, y }, { x: cx, y: y + h });
        });
      });
      keepBox(d, { x, y, w, h });
    },
    hit: boxHit,
  },
  {
    id: "callout",
    name: "Callout",
    group: "annotation",
    icon: '<path d="M4 6h20v12H12l-6 6v-6H4z"/>',
    points: 2,
    editsText: true,
    defaults: { ...TEXTY, text: "Callout" },
    fields: TEXT_FIELDS,
    draw: (c, p, d) => {
      const [a, b] = p;
      bubble(c, d, b || { x: a.x + 60, y: a.y - 40 }, a);
    },
    hit: boxHit,
  },
  {
    id: "comment",
    name: "Comment",
    group: "annotation",
    icon: '<path d="M5 6h18v12h-8l-6 5v-5H5z"/><path d="M9 11h10M9 14h6"/>',
    points: 1,
    editsText: true,
    defaults: { ...TEXTY, text: "Comment", fillColor: "rgba(41,98,255,0.95)", textColor: "#fff" },
    fields: TEXT_FIELDS,
    draw: (c, p, d) => bubble(c, d, { x: p[0].x, y: p[0].y - 30 }, p[0]),
    hit: boxHit,
  },
  {
    id: "signpost",
    name: "Signpost",
    group: "annotation",
    icon: '<path d="M14 24V6M14 6h8l3 3-3 3h-8"/>',
    points: 1,
    editsText: true,
    defaults: { ...TEXTY, text: "Signpost", fillColor: "rgba(41,98,255,0.95)", textColor: "#fff" },
    fields: TEXT_FIELDS,
    draw: (c, p, d) => {
      const { x, y } = p[0];
      c.ctx.strokeStyle = d.props.color;
      c.ctx.lineWidth = 1.5;
      c.ctx.setLineDash([]);
      line(c.ctx, { x, y }, { x, y: y - 40 });
      c.ctx.fillStyle = d.props.color;
      c.ctx.beginPath();
      c.ctx.arc(x, y, 3, 0, Math.PI * 2);
      c.ctx.fill();
      const box = label(c.ctx, d.props.text || "Signpost", x, y - 40, { align: "center", base: "bottom", color: d.props.textColor, bg: d.props.fillColor, font: font(d.props), pad: 6 });
      keepBox(d, { x: box.x, y: box.y, w: box.w, h: y - box.y });
    },
    hit: boxHit,
  },
  {
    id: "flag_mark",
    name: "Flag mark",
    group: "annotation",
    icon: '<path d="M7 24V5M7 5h14l-4 5 4 5H7"/>',
    points: 1,
    defaults: { color: "#f23645" },
    draw: (c, p, d) => {
      const { x, y } = p[0];
      c.ctx.strokeStyle = d.props.color;
      c.ctx.lineWidth = 2;
      c.ctx.setLineDash([]);
      line(c.ctx, { x, y }, { x, y: y - 26 });
      c.ctx.fillStyle = d.props.color;
      c.ctx.beginPath();
      c.ctx.moveTo(x, y - 26);
      c.ctx.lineTo(x + 16, y - 26);
      c.ctx.lineTo(x + 11, y - 20);
      c.ctx.lineTo(x + 16, y - 14);
      c.ctx.lineTo(x, y - 14);
      c.ctx.closePath();
      c.ctx.fill();
      keepBox(d, { x: x - 3, y: y - 27, w: 20, h: 28 });
    },
    hit: boxHit,
  },
  {
    id: "image",
    name: "Image",
    group: "annotation",
    icon: '<rect x="4" y="6" width="20" height="16" rx="1"/><circle cx="10" cy="11" r="2"/><path d="M4 20l6-5 4 3 4-4 6 6"/>',
    points: 2,
    editsText: true,
    defaults: { image: "", color: "#787b86" },
    fields: [{ key: "image", label: "Image", type: "image" }],
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const x = Math.min(a.x, b.x),
        y = Math.min(a.y, b.y),
        w = Math.abs(b.x - a.x),
        h = Math.abs(b.y - a.y);
      const img = d.props.image ? imageFor(String(d.props.image)) : null;
      if (img) c.ctx.drawImage(img, x, y, w, h);
      else {
        c.ctx.fillStyle = "rgba(120,123,134,0.15)";
        c.ctx.fillRect(x, y, w, h);
        label(c.ctx, d.props.image ? "Loading image…" : "Double-click to choose an image", x + w / 2, y + h / 2, { align: "center", color: "#787b86", font: "12px Inter, sans-serif" });
      }
      if (c.active) {
        c.ctx.strokeStyle = d.props.color;
        c.ctx.setLineDash([4, 3]);
        c.ctx.strokeRect(x, y, w, h);
      }
      keepBox(d, { x, y, w, h });
    },
    hit: boxHit,
  },
];

// Icons: one click places an emoji or symbol, sized in the settings.
const ICONS: [string, string, string][] = [
  ["icon_rocket", "Rocket", "🚀"],
  ["icon_fire", "Fire", "🔥"],
  ["icon_bull", "Bull", "🐂"],
  ["icon_bear", "Bear", "🐻"],
  ["icon_money", "Money bag", "💰"],
  ["icon_warning", "Warning", "⚠️"],
  ["icon_target", "Target", "🎯"],
  ["icon_star", "Star", "⭐"],
  ["icon_check", "Check", "✅"],
  ["icon_cross", "Cross", "❌"],
  ["icon_up", "Up", "⬆️"],
  ["icon_down", "Down", "⬇️"],
  ["icon_bell", "Bell", "🔔"],
  ["icon_eyes", "Eyes", "👀"],
  ["icon_diamond", "Diamond", "💎"],
  ["icon_question", "Question", "❓"],
];

export const ICON_TOOLS: ToolDef[] = ICONS.map(([id, name, glyph]) => ({
  id,
  name,
  group: "icons",
  icon: `<text x="14" y="20" text-anchor="middle" font-size="16" stroke="none" fill="currentColor">${glyph}</text>`,
  points: 1,
  defaults: { fontSize: 28, text: glyph },
  fields: [{ key: "fontSize", label: "Size", type: "number", min: 10, max: 120 }],
  draw: (c, p, d) => {
    c.ctx.font = `${d.props.fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    c.ctx.textAlign = "center";
    c.ctx.textBaseline = "middle";
    c.ctx.fillText(String(d.props.text || glyph), p[0].x, p[0].y);
    const s = d.props.fontSize;
    keepBox(d, { x: p[0].x - s / 2, y: p[0].y - s / 2, w: s, h: s });
  },
  hit: boxHit,
}));
