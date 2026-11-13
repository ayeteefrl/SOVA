// Geometric shapes and annotations.
import type { ToolDef } from "../types";
import { distToPoly, distToSeg, font, inRect, label, line, poly, stroke, withAlpha } from "../geom";

const FILL_FIELDS: ToolDef["fields"] = [
  { key: "fill", label: "Background", type: "bool" },
  { key: "fillColor", label: "Background colour", type: "color" },
];

export const SHAPE_TOOLS: ToolDef[] = [
  {
    id: "rectangle",
    name: "Rectangle",
    group: "shapes",
    icon: '<rect x="5" y="7" width="18" height="14" rx="1"/>',
    points: 2,
    hotkey: "Alt+Shift+R",
    defaults: { fill: true, fillColor: "rgba(41,98,255,0.15)" },
    fields: [...(FILL_FIELDS || []), { key: "extendLeft", label: "Extend left", type: "bool" }, { key: "extendRight", label: "Extend right", type: "bool" }],
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const x1 = d.props.extendLeft ? 0 : Math.min(a.x, b.x),
        x2 = d.props.extendRight ? c.w : Math.max(a.x, b.x);
      const y1 = Math.min(a.y, b.y),
        y2 = Math.max(a.y, b.y);
      if (d.props.fill) {
        c.ctx.fillStyle = d.props.fillColor;
        c.ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }
      stroke(c.ctx, d.props, c.active);
      c.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      if (d.props.text) label(c.ctx, d.props.text, (x1 + x2) / 2, (y1 + y2) / 2, { align: "center", color: d.props.textColor, font: font(d.props) });
    },
    hit: (_c, p, d, x, y) => {
      if (!p[1]) return Infinity;
      const pt = { x, y };
      if (d.props.fill && inRect(pt, p[0], p[1])) return 2;
      const [a, b] = p;
      return distToPoly(pt, [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], true);
    },
  },
  {
    id: "circle",
    name: "Circle",
    group: "shapes",
    icon: '<circle cx="14" cy="14" r="9"/>',
    points: 2,
    defaults: { fill: true, fillColor: "rgba(41,98,255,0.15)" },
    fields: FILL_FIELDS,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      c.ctx.beginPath();
      c.ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      if (d.props.fill) {
        c.ctx.fillStyle = d.props.fillColor;
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      c.ctx.stroke();
    },
    hit: (_c, p, d, x, y) => {
      if (!p[1]) return Infinity;
      const r = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      const dist = Math.hypot(x - p[0].x, y - p[0].y);
      return d.props.fill && dist <= r ? 2 : Math.abs(dist - r);
    },
  },
  {
    id: "ellipse",
    name: "Ellipse",
    group: "shapes",
    icon: '<ellipse cx="14" cy="14" rx="10" ry="6"/>',
    points: 2,
    defaults: { fill: true, fillColor: "rgba(41,98,255,0.15)" },
    fields: FILL_FIELDS,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      c.ctx.beginPath();
      c.ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      if (d.props.fill) {
        c.ctx.fillStyle = d.props.fillColor;
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      c.ctx.stroke();
    },
    hit: (_c, p, _d, x, y) => {
      if (!p[1]) return Infinity;
      const cx = (p[0].x + p[1].x) / 2,
        cy = (p[0].y + p[1].y) / 2;
      const rx = Math.abs(p[1].x - p[0].x) / 2 || 1,
        ry = Math.abs(p[1].y - p[0].y) / 2 || 1;
      const k = Math.hypot((x - cx) / rx, (y - cy) / ry);
      return k <= 1 ? 2 : (k - 1) * Math.min(rx, ry);
    },
  },
  {
    id: "triangle",
    name: "Triangle",
    group: "shapes",
    icon: '<path d="M14 5L24 22H4z"/>',
    points: 3,
    defaults: { fill: true, fillColor: "rgba(41,98,255,0.15)" },
    fields: FILL_FIELDS,
    draw: (c, p, d) => {
      poly(c.ctx, p, p.length === 3);
      if (d.props.fill && p.length === 3) {
        c.ctx.fillStyle = d.props.fillColor;
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      c.ctx.stroke();
    },
    hit: (_c, p, _d, x, y) => distToPoly({ x, y }, p, true),
  },
  {
    id: "arrow",
    name: "Arrow",
    group: "shapes",
    icon: '<path d="M5 23L22 6M22 6h-8M22 6v8"/>',
    points: 2,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, a, b);
      const ang = Math.atan2(b.y - a.y, b.x - a.x),
        s = 8 + d.props.width * 2;
      c.ctx.fillStyle = d.props.color;
      c.ctx.setLineDash([]);
      c.ctx.beginPath();
      c.ctx.moveTo(b.x, b.y);
      c.ctx.lineTo(b.x - s * Math.cos(ang - 0.45), b.y - s * Math.sin(ang - 0.45));
      c.ctx.lineTo(b.x - s * Math.cos(ang + 0.45), b.y - s * Math.sin(ang + 0.45));
      c.ctx.closePath();
      c.ctx.fill();
    },
    hit: (_c, p, _d, x, y) => (p[1] ? distToSeg({ x, y }, p[0], p[1]) : Infinity),
  },
];

export const ANNOTATION_TOOLS: ToolDef[] = [
  {
    id: "text",
    name: "Text",
    group: "annotation",
    icon: '<path d="M7 7h14M14 7v15"/>',
    points: 1,
    editsText: true,
    defaults: { text: "Text", textColor: "#2962ff", fontSize: 14, fill: false, fillColor: "rgba(41,98,255,0.15)" },
    fields: [
      { key: "text", label: "Text", type: "textarea" },
      { key: "textColor", label: "Text colour", type: "color" },
      { key: "fontSize", label: "Font size", type: "number", min: 8, max: 72 },
      { key: "bold", label: "Bold", type: "bool" },
      { key: "italic", label: "Italic", type: "bool" },
      { key: "fill", label: "Background", type: "bool" },
      { key: "fillColor", label: "Background colour", type: "color" },
    ],
    draw: (c, p, d) => {
      const box = label(c.ctx, d.props.text || "Text", p[0].x, p[0].y, {
        color: d.props.textColor,
        font: font(d.props),
        base: "top",
        bg: d.props.fill ? d.props.fillColor : undefined,
      });
      if (c.active) {
        c.ctx.save();
        c.ctx.strokeStyle = withAlpha(d.props.textColor, 0.7);
        c.ctx.setLineDash([3, 3]);
        c.ctx.strokeRect(box.x, box.y, box.w, box.h);
        c.ctx.restore();
      }
      (d as { _box?: typeof box })._box = box;
    },
    hit: (_c, _p, d, x, y) => {
      const b = (d as { _box?: { x: number; y: number; w: number; h: number } })._box;
      return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h ? 0 : Infinity;
    },
  },
  {
    id: "price_label",
    name: "Price label",
    group: "annotation",
    icon: '<path d="M5 9h13l5 5-5 5H5z"/>',
    points: 1,
    defaults: { color: "#2962ff" },
    draw: (c, p, d) => {
      const txt = c.fmtPrice(d.points[0].price);
      c.ctx.save();
      c.ctx.font = "12px Inter, sans-serif";
      const w = c.ctx.measureText(txt).width + 14;
      const { x, y } = p[0];
      c.ctx.fillStyle = d.props.color;
      c.ctx.beginPath();
      c.ctx.moveTo(x, y);
      c.ctx.lineTo(x + 8, y - 11);
      c.ctx.lineTo(x + 8 + w, y - 11);
      c.ctx.lineTo(x + 8 + w, y + 11);
      c.ctx.lineTo(x + 8, y + 11);
      c.ctx.closePath();
      c.ctx.fill();
      c.ctx.fillStyle = "#fff";
      c.ctx.textBaseline = "middle";
      c.ctx.fillText(txt, x + 14, y);
      c.ctx.restore();
    },
    hit: (_c, p, _d, x, y) => (x >= p[0].x - 2 && x <= p[0].x + 90 && Math.abs(y - p[0].y) <= 12 ? 0 : Infinity),
  },
];
