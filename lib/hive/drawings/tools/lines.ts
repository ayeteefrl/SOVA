// Trend line tools: trend line, ray, info line, extended line, trend angle, horizontal line and
// ray, vertical line, cross line, parallel channel.
import type { ToolDef, XY } from "../types";
import { distToSeg, extended, label, line, pct, poly, signed, stroke, withAlpha } from "../geom";

const ICON = {
  trend: '<path d="M6 22L22 6"/><circle cx="6" cy="22" r="2"/><circle cx="22" cy="6" r="2"/>',
  ray: '<path d="M6 22L24 4"/><circle cx="6" cy="22" r="2"/><circle cx="14" cy="14" r="2"/>',
  info: '<path d="M6 22L22 8"/><circle cx="6" cy="22" r="2"/><circle cx="22" cy="8" r="2"/><rect x="13" y="18" width="11" height="6" rx="1"/>',
  extended: '<path d="M3 25L25 3"/><circle cx="10" cy="18" r="2"/><circle cx="18" cy="10" r="2"/>',
  angle: '<path d="M6 22L22 8M6 22h16"/><path d="M14 22a8 8 0 0 0-2-5"/><circle cx="6" cy="22" r="2"/>',
  hline: '<path d="M3 14h22"/><circle cx="14" cy="14" r="2"/>',
  hray: '<path d="M10 14h16"/><circle cx="10" cy="14" r="2"/>',
  vline: '<path d="M14 3v22"/><circle cx="14" cy="14" r="2"/>',
  cross: '<path d="M14 3v22M3 14h22"/><circle cx="14" cy="14" r="2"/>',
  channel: '<path d="M4 18L18 6M10 24L24 12"/><circle cx="4" cy="18" r="2"/><circle cx="18" cy="6" r="2"/>',
};

const segHit = (_c: unknown, p: XY[], _d: unknown, x: number, y: number) => (p[1] ? distToSeg({ x, y }, p[0], p[1]) : Infinity);

function drawExtendable(c: Parameters<ToolDef["draw"]>[0], p: XY[], left: boolean, right: boolean, d: Parameters<ToolDef["draw"]>[2]) {
  const [a, b] = p;
  stroke(c.ctx, d.props, c.active);
  const [e1, e2] = extended(a, b, left, right);
  line(c.ctx, e1, e2);
  if (d.props.text) {
    label(c.ctx, d.props.text, (a.x + b.x) / 2, (a.y + b.y) / 2 - 10, { align: "center", color: d.props.textColor, font: `${d.props.fontSize}px Inter, sans-serif` });
  }
}

function extHit(left: boolean, right: boolean) {
  return (_c: unknown, p: XY[], d: { props: { extendLeft: boolean; extendRight: boolean } }, x: number, y: number) => {
    if (!p[1]) return Infinity;
    const [e1, e2] = extended(p[0], p[1], left || d.props.extendLeft, right || d.props.extendRight);
    return distToSeg({ x, y }, e1, e2);
  };
}

const priceTag = (c: Parameters<ToolDef["draw"]>[0], price: number, y: number, color: string) =>
  label(c.ctx, c.fmtPrice(price), c.w - 4, y, { align: "right", color: "#fff", bg: color, font: "11px Inter, sans-serif", pad: 4 });

export const LINE_TOOLS: ToolDef[] = [
  {
    id: "trend_line",
    name: "Trend line",
    group: "lines",
    icon: ICON.trend,
    points: 2,
    hotkey: "Alt+T",
    fields: [
      { key: "extendLeft", label: "Extend left", type: "bool" },
      { key: "extendRight", label: "Extend right", type: "bool" },
    ],
    draw: (c, p, d) => drawExtendable(c, p, d.props.extendLeft, d.props.extendRight, d),
    hit: extHit(false, false),
  },
  {
    id: "ray",
    name: "Ray",
    group: "lines",
    icon: ICON.ray,
    points: 2,
    draw: (c, p, d) => drawExtendable(c, p, false, true, d),
    hit: extHit(false, true),
  },
  {
    id: "info_line",
    name: "Info line",
    group: "lines",
    icon: ICON.info,
    points: 2,
    draw: (c, p, d) => {
      drawExtendable(c, p, d.props.extendLeft, d.props.extendRight, d);
      const [a, b] = d.points;
      if (!b) return;
      const diff = b.price - a.price;
      const bars = c.barsBetween(a.time, b.time);
      const deg = (Math.atan2(p[0].y - p[1].y, p[1].x - p[0].x) * 180) / Math.PI;
      label(
        c.ctx,
        `${signed(diff, c.fmtPrice(diff))} (${signed(diff, pct(a.price, b.price).toFixed(2))}%)\n${bars} bars, ${deg.toFixed(1)}°`,
        p[1].x + 10,
        p[1].y,
        { color: "#d1d4dc", bg: "rgba(30,34,45,0.92)", font: "11px Inter, sans-serif" },
      );
    },
    hit: extHit(false, false),
  },
  {
    id: "extended",
    name: "Extended line",
    group: "lines",
    icon: ICON.extended,
    points: 2,
    draw: (c, p, d) => drawExtendable(c, p, true, true, d),
    hit: extHit(true, true),
  },
  {
    id: "trend_angle",
    name: "Trend angle",
    group: "lines",
    icon: ICON.angle,
    points: 2,
    draw: (c, p, d) => {
      drawExtendable(c, p, false, false, d);
      const [a, b] = p;
      if (!b) return;
      const ang = Math.atan2(a.y - b.y, b.x - a.x);
      c.ctx.save();
      c.ctx.setLineDash([3, 3]);
      line(c.ctx, a, { x: a.x + Math.max(40, Math.abs(b.x - a.x) * 0.5), y: a.y });
      c.ctx.beginPath();
      c.ctx.arc(a.x, a.y, 30, -ang, 0, ang < 0);
      c.ctx.stroke();
      c.ctx.restore();
      label(c.ctx, `${((ang * 180) / Math.PI).toFixed(2)}°`, a.x + 36, a.y - (ang > 0 ? 10 : -10), { color: d.props.color, font: "11px Inter, sans-serif" });
    },
    hit: segHit,
  },
  {
    id: "horizontal_line",
    name: "Horizontal line",
    group: "lines",
    icon: ICON.hline,
    points: 1,
    hotkey: "Alt+H",
    fields: [{ key: "showPrice", label: "Price label", type: "bool" }],
    draw: (c, p, d) => {
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, { x: 0, y: p[0].y }, { x: c.w, y: p[0].y });
      if (d.props.text) label(c.ctx, d.props.text, c.w / 2, p[0].y - 10, { align: "center", color: d.props.textColor, font: `${d.props.fontSize}px Inter, sans-serif` });
      if (d.props.showPrice) priceTag(c, d.points[0].price, p[0].y, d.props.color);
    },
    hit: (_c, p, _d, _x, y) => Math.abs(y - p[0].y),
  },
  {
    id: "horizontal_ray",
    name: "Horizontal ray",
    group: "lines",
    icon: ICON.hray,
    points: 1,
    hotkey: "Alt+J",
    fields: [{ key: "showPrice", label: "Price label", type: "bool" }],
    draw: (c, p, d) => {
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, p[0], { x: c.w, y: p[0].y });
      if (d.props.text) label(c.ctx, d.props.text, p[0].x + 8, p[0].y - 10, { color: d.props.textColor, font: `${d.props.fontSize}px Inter, sans-serif` });
      if (d.props.showPrice) priceTag(c, d.points[0].price, p[0].y, d.props.color);
    },
    hit: (_c, p, _d, x, y) => (x >= p[0].x - 4 ? Math.abs(y - p[0].y) : Infinity),
  },
  {
    id: "vertical_line",
    name: "Vertical line",
    group: "lines",
    icon: ICON.vline,
    points: 1,
    hotkey: "Alt+V",
    draw: (c, p, d) => {
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, { x: p[0].x, y: 0 }, { x: p[0].x, y: c.h });
      if (d.props.showLabels)
        label(c.ctx, c.fmtTime(d.points[0].time), p[0].x, c.h - 12, { align: "center", color: "#fff", bg: d.props.color, font: "11px Inter, sans-serif", pad: 4 });
    },
    hit: (_c, p, _d, x) => Math.abs(x - p[0].x),
  },
  {
    id: "cross_line",
    name: "Cross line",
    group: "lines",
    icon: ICON.cross,
    points: 1,
    hotkey: "Alt+C",
    draw: (c, p, d) => {
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, { x: 0, y: p[0].y }, { x: c.w, y: p[0].y });
      line(c.ctx, { x: p[0].x, y: 0 }, { x: p[0].x, y: c.h });
      if (d.props.showPrice) priceTag(c, d.points[0].price, p[0].y, d.props.color);
    },
    hit: (_c, p, _d, x, y) => Math.min(Math.abs(x - p[0].x), Math.abs(y - p[0].y)),
  },
  {
    id: "parallel_channel",
    name: "Parallel channel",
    group: "lines",
    icon: ICON.channel,
    points: 3,
    defaults: { fill: true, fillColor: "rgba(41,98,255,0.12)" },
    fields: [
      { key: "fill", label: "Background", type: "bool" },
      { key: "fillColor", label: "Background colour", type: "color" },
      { key: "extendLeft", label: "Extend left", type: "bool" },
      { key: "extendRight", label: "Extend right", type: "bool" },
      { key: "showMiddle", label: "Middle line", type: "bool" },
    ],
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      const off = q ? q.y - (a.y + ((b.y - a.y) * (q.x - a.x)) / (b.x - a.x || 1)) : 0;
      const a2 = { x: a.x, y: a.y + off },
        b2 = { x: b.x, y: b.y + off };
      const [l1, r1] = extended(a, b, d.props.extendLeft, d.props.extendRight);
      const [l2, r2] = extended(a2, b2, d.props.extendLeft, d.props.extendRight);
      if (d.props.fill && q) {
        c.ctx.fillStyle = d.props.fillColor;
        poly(c.ctx, [l1, r1, r2, l2], true);
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, l1, r1);
      if (q) line(c.ctx, l2, r2);
      if (q && d.props.showMiddle !== false) {
        c.ctx.save();
        c.ctx.setLineDash([4, 4]);
        c.ctx.strokeStyle = withAlpha(d.props.color, 0.6);
        line(c.ctx, { x: (l1.x + l2.x) / 2, y: (l1.y + l2.y) / 2 }, { x: (r1.x + r2.x) / 2, y: (r1.y + r2.y) / 2 });
        c.ctx.restore();
      }
    },
    hit: (_c, p, d, x, y) => {
      const [a, b, q] = p;
      if (!b) return Infinity;
      const off = q ? q.y - (a.y + ((b.y - a.y) * (q.x - a.x)) / (b.x - a.x || 1)) : 0;
      const [l1, r1] = extended(a, b, d.props.extendLeft, d.props.extendRight);
      const [l2, r2] = extended({ x: a.x, y: a.y + off }, { x: b.x, y: b.y + off }, d.props.extendLeft, d.props.extendRight);
      return Math.min(distToSeg({ x, y }, l1, r1), distToSeg({ x, y }, l2, r2));
    },
  },
];
