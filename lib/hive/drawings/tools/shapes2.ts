// More geometric shapes: brush, highlighter, arrow marker and marks, rotated rectangle, path,
// polyline, arc, curve and double curve.
import type { Drawing, RenderCtx, ToolDef, XY } from "../types";
import { distToPoly, font, label, poly, stroke, withAlpha } from "../geom";

const FILL: ToolDef["fields"] = [
  { key: "fill", label: "Background", type: "bool" },
  { key: "fillColor", label: "Background colour", type: "color" },
];
const polyHit = (_c: RenderCtx, p: XY[], _d: Drawing, x: number, y: number) => distToPoly({ x, y }, p);

function smooth(ctx: CanvasRenderingContext2D, p: XY[]) {
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
  if (p.length > 1) ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
}

function arrowHead(ctx: CanvasRenderingContext2D, from: XY, to: XY, size: number, color: string) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.fillStyle = color;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(ang - 0.45), to.y - size * Math.sin(ang - 0.45));
  ctx.lineTo(to.x - size * Math.cos(ang + 0.45), to.y - size * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
}

// Bezier points sampled for hit testing.
function sampleQuad(a: XY, ctl: XY, b: XY) {
  return Array.from({ length: 21 }, (_, i) => {
    const t = i / 20,
      u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * ctl.x + t * t * b.x, y: u * u * a.y + 2 * u * t * ctl.y + t * t * b.y };
  });
}
function sampleCubic(a: XY, c1: XY, c2: XY, b: XY) {
  return Array.from({ length: 31 }, (_, i) => {
    const t = i / 30,
      u = 1 - t;
    return {
      x: u ** 3 * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * b.x,
      y: u ** 3 * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * b.y,
    };
  });
}

// Circle through three points (for the arc tool); null when they're in a line.
function circle3(a: XY, b: XY, c: XY) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return null;
  const s = (p: XY) => p.x * p.x + p.y * p.y;
  const x = (s(a) * (b.y - c.y) + s(b) * (c.y - a.y) + s(c) * (a.y - b.y)) / d;
  const y = (s(a) * (c.x - b.x) + s(b) * (a.x - c.x) + s(c) * (b.x - a.x)) / d;
  return { x, y, r: Math.hypot(a.x - x, a.y - y) };
}

function markArrow(up: boolean): ToolDef {
  return {
    id: up ? "arrow_mark_up" : "arrow_mark_down",
    name: up ? "Arrow mark up" : "Arrow mark down",
    group: "shapes",
    icon: up ? '<path d="M14 6l7 9h-4v7h-6v-7H7z"/>' : '<path d="M14 22l7-9h-4V6h-6v7H7z"/>',
    points: 1,
    defaults: { color: up ? "#089981" : "#f23645", text: "", textColor: up ? "#089981" : "#f23645", fontSize: 12 },
    fields: [{ key: "text", label: "Text", type: "text" }],
    draw: (c, p, d) => {
      const { x, y } = p[0];
      const s = up ? 1 : -1;
      c.ctx.fillStyle = d.props.color;
      c.ctx.beginPath();
      c.ctx.moveTo(x, y);
      c.ctx.lineTo(x + 9, y + s * 12);
      c.ctx.lineTo(x + 4, y + s * 12);
      c.ctx.lineTo(x + 4, y + s * 24);
      c.ctx.lineTo(x - 4, y + s * 24);
      c.ctx.lineTo(x - 4, y + s * 12);
      c.ctx.lineTo(x - 9, y + s * 12);
      c.ctx.closePath();
      c.ctx.fill();
      if (d.props.text) label(c.ctx, d.props.text, x, y + s * 36, { align: "center", color: d.props.textColor, font: font(d.props) });
    },
    hit: (_c, p, _d, x, y) => (Math.abs(x - p[0].x) < 10 && (up ? y >= p[0].y - 2 && y <= p[0].y + 26 : y <= p[0].y + 2 && y >= p[0].y - 26) ? 0 : Infinity),
  };
}

export const SHAPE_TOOLS_2: ToolDef[] = [
  {
    id: "brush",
    name: "Brush",
    group: "shapes",
    icon: '<path d="M4 22c4 0 4-6 8-6s3 4 6 4 4-8 6-12"/>',
    points: 0,
    defaults: { color: "#2962ff", width: 2, fill: false, fillColor: "rgba(41,98,255,0.15)" },
    fields: FILL,
    draw: (c, p, d) => {
      if (p.length < 2) return;
      smooth(c.ctx, p);
      if (d.props.fill) {
        c.ctx.closePath();
        c.ctx.fillStyle = d.props.fillColor;
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      c.ctx.lineJoin = "round";
      c.ctx.stroke();
    },
    hit: polyHit,
  },
  {
    id: "highlighter",
    name: "Highlighter",
    group: "shapes",
    icon: '<path d="M6 22l4-1 12-12-3-3L7 18z"/><path d="M4 24h12" stroke-width="3" stroke-opacity=".5"/>',
    points: 0,
    defaults: { color: "rgba(255,235,59,0.35)", width: 12 },
    draw: (c, p, d) => {
      if (p.length < 2) return;
      smooth(c.ctx, p);
      c.ctx.strokeStyle = d.props.color;
      c.ctx.lineWidth = d.props.width;
      c.ctx.lineCap = "round";
      c.ctx.lineJoin = "round";
      c.ctx.setLineDash([]);
      c.ctx.stroke();
    },
    hit: (_c, p, d, x, y) => distToPoly({ x, y }, p) - d.props.width / 2,
  },
  {
    id: "arrow_marker",
    name: "Arrow marker",
    group: "shapes",
    icon: '<path d="M4 18l12-2v-4l8 6-8 6v-4z" />',
    points: 2,
    defaults: { color: "#2962ff", text: "" },
    fields: [{ key: "text", label: "Text", type: "text" }],
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      // A solid arrow shape from A to B.
      const ang = Math.atan2(b.y - a.y, b.x - a.x),
        len = Math.hypot(b.x - a.x, b.y - a.y);
      const head = Math.min(24, len * 0.4),
        w = 5;
      const pt = (along: number, side: number) => ({ x: a.x + Math.cos(ang) * along - Math.sin(ang) * side, y: a.y + Math.sin(ang) * along + Math.cos(ang) * side });
      c.ctx.fillStyle = d.props.color;
      poly(c.ctx, [pt(0, -w / 2), pt(len - head, -w), pt(len - head, -head / 1.6), b, pt(len - head, head / 1.6), pt(len - head, w), pt(0, w / 2)], true);
      c.ctx.fill();
      if (d.props.text) label(c.ctx, d.props.text, a.x, a.y - 12, { align: "center", color: d.props.color, font: font(d.props) });
    },
    hit: polyHit,
  },
  markArrow(true),
  markArrow(false),
  {
    id: "rotated_rectangle",
    name: "Rotated rectangle",
    group: "shapes",
    icon: '<path d="M8 4l16 8-8 12L0 16z" transform="translate(2 0)"/>',
    points: 3,
    defaults: { fill: true, fillColor: "rgba(41,98,255,0.15)" },
    fields: FILL,
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      if (!q) {
        stroke(c.ctx, d.props, c.active);
        poly(c.ctx, [a, b]);
        c.ctx.stroke();
        return;
      }
      // A-B is one side; the third point sets how wide the rectangle is.
      const dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len,
        ny = dx / len;
      const off = (q.x - a.x) * nx + (q.y - a.y) * ny;
      const pts = [a, b, { x: b.x + nx * off, y: b.y + ny * off }, { x: a.x + nx * off, y: a.y + ny * off }];
      poly(c.ctx, pts, true);
      if (d.props.fill) {
        c.ctx.fillStyle = d.props.fillColor;
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      c.ctx.stroke();
    },
    hit: polyHit,
  },
  {
    id: "path",
    name: "Path",
    group: "shapes",
    icon: '<path d="M4 20l6-8 6 4 8-10M24 6h-5M24 6v5"/>',
    points: -1,
    draw: (c, p, d) => {
      stroke(c.ctx, d.props, c.active);
      poly(c.ctx, p);
      c.ctx.stroke();
      if (p.length > 1) arrowHead(c.ctx, p[p.length - 2], p[p.length - 1], 10 + d.props.width * 2, d.props.color);
    },
    hit: polyHit,
  },
  {
    id: "polyline",
    name: "Polyline",
    group: "shapes",
    icon: '<path d="M4 20l6-10 6 6 8-10"/><circle cx="4" cy="20" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="16" r="1.5"/>',
    points: -1,
    defaults: { fill: false, fillColor: "rgba(41,98,255,0.15)" },
    fields: FILL,
    draw: (c, p, d) => {
      poly(c.ctx, p, d.props.fill);
      if (d.props.fill) {
        c.ctx.fillStyle = d.props.fillColor;
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      c.ctx.stroke();
    },
    hit: polyHit,
  },
  {
    id: "arc",
    name: "Arc",
    group: "shapes",
    icon: '<path d="M4 20a12 12 0 0 1 20 0"/>',
    points: 3,
    defaults: { fill: false, fillColor: "rgba(41,98,255,0.15)" },
    fields: FILL,
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      const circ = q && circle3(a, q, b);
      stroke(c.ctx, d.props, c.active);
      if (!circ) {
        poly(c.ctx, q ? [a, q, b] : [a, b]);
        c.ctx.stroke();
        return;
      }
      // Draw from A to B the way that passes through the third point.
      const t1 = Math.atan2(a.y - circ.y, a.x - circ.x),
        t2 = Math.atan2(b.y - circ.y, b.x - circ.x),
        tm = Math.atan2(q.y - circ.y, q.x - circ.x);
      const norm = (t: number) => (t - t1 + 4 * Math.PI) % (2 * Math.PI);
      const ccw = norm(tm) > norm(t2);
      c.ctx.beginPath();
      c.ctx.arc(circ.x, circ.y, circ.r, t1, t2, ccw);
      if (d.props.fill) {
        c.ctx.closePath();
        c.ctx.fillStyle = d.props.fillColor;
        c.ctx.fill();
      }
      c.ctx.stroke();
    },
    hit: (_c, p, _d, x, y) => {
      const circ = p[2] && circle3(p[0], p[2], p[1]);
      return circ ? Math.abs(Math.hypot(x - circ.x, y - circ.y) - circ.r) : distToPoly({ x, y }, p);
    },
  },
  {
    id: "curve",
    name: "Curve",
    group: "shapes",
    icon: '<path d="M4 20Q14 0 24 20"/>',
    points: 3,
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      stroke(c.ctx, d.props, c.active);
      c.ctx.beginPath();
      c.ctx.moveTo(a.x, a.y);
      if (q) c.ctx.quadraticCurveTo(q.x, q.y, b.x, b.y);
      else c.ctx.lineTo(b.x, b.y);
      c.ctx.stroke();
    },
    hit: (_c, p, _d, x, y) => distToPoly({ x, y }, p[2] ? sampleQuad(p[0], p[2], p[1]) : p),
  },
  {
    id: "double_curve",
    name: "Double curve",
    group: "shapes",
    icon: '<path d="M4 14C8 2 12 2 14 14S20 26 24 14"/>',
    points: 4,
    draw: (c, p, d) => {
      const [a, b, c1, c2] = p;
      if (!b) return;
      stroke(c.ctx, d.props, c.active);
      c.ctx.beginPath();
      c.ctx.moveTo(a.x, a.y);
      if (c1 && c2) c.ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
      else if (c1) c.ctx.quadraticCurveTo(c1.x, c1.y, b.x, b.y);
      else c.ctx.lineTo(b.x, b.y);
      c.ctx.stroke();
      if (c.active && c1) {
        c.ctx.setLineDash([2, 3]);
        c.ctx.strokeStyle = withAlpha(d.props.color, 0.5);
        poly(c.ctx, c2 ? [a, c1, c2, b] : [a, c1, b]);
        c.ctx.stroke();
      }
    },
    hit: (_c, p, _d, x, y) => distToPoly({ x, y }, p[3] ? sampleCubic(p[0], p[2], p[3], p[1]) : p),
  },
];
