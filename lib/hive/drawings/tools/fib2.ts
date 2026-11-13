// Gann and Fibonacci tools beyond the retracement and extension.
import type { Drawing, Level, RenderCtx, ToolDef, XY } from "../types";
import { FAR, distToSeg, extended, label, line, poly, stroke, withAlpha } from "../geom";

const lv = (value: number, color: string, visible = true): Level => ({ value, color, visible });
const PAL = ["#787b86", "#f23645", "#ff9800", "#4caf50", "#089981", "#00bcd4", "#2962ff", "#9c27b0", "#e91e63", "#795548", "#607d8b"];
const levels = (vals: number[], hidden: number[] = []) => vals.map((v, i) => lv(v, PAL[i % PAL.length], !hidden.includes(v)));
const visible = (d: Drawing) => d.props.levels.filter((l) => l.visible).sort((a, b) => a.value - b.value);
const FIELDS: ToolDef["fields"] = [
  { key: "levels", label: "Levels", type: "levels" },
  { key: "fill", label: "Background", type: "bool" },
  { key: "showLabels", label: "Labels", type: "bool" },
];
const tiny = "11px Inter, sans-serif";
const segHit = (_c: RenderCtx, p: XY[], _d: Drawing, x: number, y: number) => {
  let best = Infinity;
  for (let i = 0; i + 1 < p.length; i++) best = Math.min(best, distToSeg({ x, y }, p[i], p[i + 1]));
  return best;
};
const ray = (from: XY, through: XY) => extended(from, through, false, true)[1];

// Vertical lines at bar offsets from an anchor (time zones).
function verticals(c: RenderCtx, d: Drawing, startIdx: number, unit: number, lvls: Level[], name = (l: Level) => String(l.value)) {
  for (const l of lvls) {
    const x = c.xAt(startIdx + unit * l.value);
    if (x == null) continue;
    stroke(c.ctx, { ...d.props, color: l.color, width: 1 }, c.active);
    line(c.ctx, { x, y: 0 }, { x, y: c.h });
    if (d.props.showLabels) label(c.ctx, name(l), x + 3, c.h - 12, { color: l.color, font: tiny });
  }
}

export const FIB_TOOLS_2: ToolDef[] = [
  {
    id: "fib_channel",
    name: "Fib channel",
    group: "fib",
    icon: '<path d="M4 18L20 6M8 22L24 10M6 20L22 8" stroke-dasharray="2 2"/>',
    points: 3,
    defaults: { levels: levels([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236], [2.618, 3.618, 4.236]), fill: true, width: 1, extendRight: true },
    fields: [...(FIELDS || []), { key: "extendLeft", label: "Extend left", type: "bool" }, { key: "extendRight", label: "Extend right", type: "bool" }],
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      const off = q ? q.y - (a.y + ((b.y - a.y) * (q.x - a.x)) / (b.x - a.x || 1)) : 0;
      const ls = visible(d);
      const seg = (k: number) => extended({ x: a.x, y: a.y + off * k }, { x: b.x, y: b.y + off * k }, d.props.extendLeft, d.props.extendRight);
      if (d.props.fill && q)
        for (let i = 0; i + 1 < ls.length; i++) {
          const [p1, p2] = seg(ls[i].value),
            [p3, p4] = seg(ls[i + 1].value);
          c.ctx.fillStyle = withAlpha(ls[i + 1].color, 0.1);
          poly(c.ctx, [p1, p2, p4, p3], true);
          c.ctx.fill();
        }
      for (const l of q ? ls : [lv(0, d.props.color)]) {
        const [s, e] = seg(l.value);
        stroke(c.ctx, { ...d.props, color: l.color }, c.active);
        line(c.ctx, s, e);
        if (d.props.showLabels && q) label(c.ctx, String(l.value), a.x - 4, a.y + off * l.value, { align: "right", color: l.color, font: tiny });
      }
    },
    hit: segHit,
  },
  {
    id: "fib_time_zone",
    name: "Fib time zone",
    group: "fib",
    icon: '<path d="M5 4v20M9 4v20M13 4v20M19 4v20" />',
    points: 2,
    defaults: { levels: levels([0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]), width: 1 },
    fields: [{ key: "levels", label: "Levels", type: "levels" }, { key: "showLabels", label: "Labels", type: "bool" }],
    draw: (c, p, d) => {
      const i1 = c.indexOf(d.points[0].time),
        i2 = d.points[1] ? c.indexOf(d.points[1].time) : null;
      if (i1 == null || i2 == null || !p[1]) return;
      verticals(c, d, i1, i2 - i1, visible(d));
      c.ctx.setLineDash([3, 3]);
      line(c.ctx, p[0], p[1]);
    },
    hit: (c, p, d, x) => {
      const i1 = c.indexOf(d.points[0].time),
        i2 = d.points[1] ? c.indexOf(d.points[1].time) : null;
      if (i1 == null || i2 == null) return Infinity;
      let best = Infinity;
      for (const l of visible(d)) {
        const xx = c.xAt(i1 + (i2 - i1) * l.value);
        if (xx != null) best = Math.min(best, Math.abs(x - xx));
      }
      return best;
    },
  },
  {
    id: "trend_fib_time",
    name: "Trend-based fib time",
    group: "fib",
    icon: '<path d="M4 20L10 8L14 16" /><path d="M16 4v20M20 4v20M24 4v20" stroke-dasharray="2 2"/>',
    points: 3,
    defaults: { levels: levels([0, 0.382, 0.5, 0.618, 1, 1.382, 1.618, 2, 2.382, 2.618, 3, 3.618, 4.236], [0.5, 2.382, 3.618, 4.236]), width: 1 },
    fields: [{ key: "levels", label: "Levels", type: "levels" }, { key: "showLabels", label: "Labels", type: "bool" }],
    draw: (c, p, d) => {
      c.ctx.save();
      c.ctx.setLineDash([3, 3]);
      c.ctx.strokeStyle = "#787b86";
      for (let i = 0; i + 1 < p.length; i++) line(c.ctx, p[i], p[i + 1]);
      c.ctx.restore();
      if (!d.points[2]) return;
      const [ia, ib, ic] = d.points.map((x) => c.indexOf(x.time));
      if (ia == null || ib == null || ic == null) return;
      verticals(c, d, ic, ib - ia, visible(d));
    },
    hit: segHit,
  },
  {
    id: "fib_speed_fan",
    name: "Fib speed resistance fan",
    group: "fib",
    icon: '<path d="M4 24L24 4M4 24L24 10M4 24L24 16M4 24L18 4M4 24L12 4"/>',
    points: 2,
    defaults: { levels: levels([0, 0.25, 0.382, 0.5, 0.618, 0.75, 1]), fill: true, width: 1 },
    fields: FIELDS,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const ls = visible(d);
      // Price fan: from A through levels on B's vertical; time fan: through levels on B's horizontal.
      const priceRays = ls.map((l) => ({ l, end: ray(a, { x: b.x, y: b.y + (a.y - b.y) * l.value }) }));
      const timeRays = ls.map((l) => ({ l, end: ray(a, { x: b.x + (a.x - b.x) * l.value, y: b.y }) }));
      if (d.props.fill)
        for (let i = 0; i + 1 < priceRays.length; i++) {
          c.ctx.fillStyle = withAlpha(priceRays[i + 1].l.color, 0.08);
          poly(c.ctx, [a, priceRays[i].end, priceRays[i + 1].end], true);
          c.ctx.fill();
        }
      for (const r of [...priceRays, ...timeRays]) {
        stroke(c.ctx, { ...d.props, color: r.l.color }, c.active);
        line(c.ctx, a, r.end);
      }
      c.ctx.save();
      c.ctx.strokeStyle = withAlpha("#787b86", 0.5);
      c.ctx.lineWidth = 1;
      c.ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      c.ctx.restore();
      if (d.props.showLabels) for (const r of priceRays) label(c.ctx, String(r.l.value), b.x + 4, b.y + (a.y - b.y) * r.l.value, { color: r.l.color, font: tiny });
    },
    hit: (_c, p, d, x, y) => {
      if (!p[1]) return Infinity;
      const [a, b] = p;
      return Math.min(...visible(d).map((l) => distToSeg({ x, y }, a, ray(a, { x: b.x, y: b.y + (a.y - b.y) * l.value }))));
    },
  },
  {
    id: "fib_circles",
    name: "Fib circles",
    group: "fib",
    icon: '<circle cx="14" cy="14" r="4"/><circle cx="14" cy="14" r="7"/><circle cx="14" cy="14" r="11"/>',
    points: 2,
    defaults: { levels: levels([0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236], [2.618, 3.618, 4.236]), width: 1, fill: true },
    fields: FIELDS,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const ctr = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const R = Math.hypot(b.x - a.x, b.y - a.y) / 2;
      const ls = visible(d);
      ls.forEach((l, i) => {
        c.ctx.beginPath();
        c.ctx.arc(ctr.x, ctr.y, R * l.value, 0, Math.PI * 2);
        if (d.props.fill) {
          c.ctx.fillStyle = withAlpha(l.color, 0.05 + 0.01 * (ls.length - i));
          c.ctx.fill();
        }
        stroke(c.ctx, { ...d.props, color: l.color }, c.active);
        c.ctx.stroke();
      });
      c.ctx.setLineDash([3, 3]);
      line(c.ctx, a, b);
    },
    hit: (_c, p, d, x, y) => {
      if (!p[1]) return Infinity;
      const ctr = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 },
        R = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) / 2;
      const dist = Math.hypot(x - ctr.x, y - ctr.y);
      return Math.min(...visible(d).map((l) => Math.abs(dist - R * l.value)));
    },
  },
  {
    id: "fib_spiral",
    name: "Fib spiral",
    group: "fib",
    icon: '<path d="M14 14a2 2 0 0 1 2 2a4 4 0 0 1-4 4a6 6 0 0 1-6-6a9 9 0 0 1 9-9a12 12 0 0 1 12 12"/>',
    points: 2,
    defaults: { color: "#f23645", width: 1 },
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      // Golden spiral around A: the radius grows by φ every quarter turn, passing through B.
      const r0 = Math.hypot(b.x - a.x, b.y - a.y),
        th0 = Math.atan2(b.y - a.y, b.x - a.x);
      const k = Math.log(1.618034) / (Math.PI / 2);
      stroke(c.ctx, d.props, c.active);
      c.ctx.beginPath();
      for (let t = -6 * Math.PI; t <= 2 * Math.PI; t += 0.05) {
        const r = r0 * Math.exp(k * t);
        const x = a.x + r * Math.cos(th0 + t),
          y = a.y + r * Math.sin(th0 + t);
        if (t === -6 * Math.PI) c.ctx.moveTo(x, y);
        else c.ctx.lineTo(x, y);
        if (r > FAR / 50) break;
      }
      c.ctx.stroke();
      c.ctx.setLineDash([3, 3]);
      line(c.ctx, a, b);
    },
    hit: segHit,
  },
  {
    id: "fib_speed_arcs",
    name: "Fib speed resistance arcs",
    group: "fib",
    icon: '<path d="M4 24a8 8 0 0 1 8-8M4 24a14 14 0 0 1 14-14M4 24a20 20 0 0 1 20-20"/>',
    points: 2,
    defaults: { levels: levels([0.236, 0.382, 0.5, 0.618, 0.786, 1]), width: 1, fill: true },
    fields: FIELDS,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const R = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(a.y - b.y, a.x - b.x);
      for (const l of visible(d)) {
        c.ctx.beginPath();
        c.ctx.arc(b.x, b.y, R * l.value, ang - Math.PI / 2, ang + Math.PI / 2);
        stroke(c.ctx, { ...d.props, color: l.color }, c.active);
        c.ctx.stroke();
        if (d.props.showLabels) label(c.ctx, String(l.value), b.x + Math.cos(ang) * R * l.value, b.y + Math.sin(ang) * R * l.value, { color: l.color, font: tiny });
      }
      c.ctx.setLineDash([3, 3]);
      line(c.ctx, a, b);
    },
    hit: (_c, p, d, x, y) => {
      if (!p[1]) return Infinity;
      const R = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y),
        dist = Math.hypot(x - p[1].x, y - p[1].y);
      return Math.min(distToSeg({ x, y }, p[0], p[1]), ...visible(d).map((l) => Math.abs(dist - R * l.value)));
    },
  },
  {
    id: "fib_wedge",
    name: "Fib wedge",
    group: "fib",
    icon: '<path d="M4 24L24 6M4 24L24 20"/><path d="M14 15a10 10 0 0 0 0 5" />',
    points: 3,
    defaults: { levels: levels([0.236, 0.382, 0.5, 0.618, 0.786, 1]), width: 1, fill: true },
    fields: FIELDS,
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, a, b);
      if (!q) return;
      line(c.ctx, a, q);
      const R = Math.hypot(b.x - a.x, b.y - a.y);
      const t1 = Math.atan2(b.y - a.y, b.x - a.x),
        t2 = Math.atan2(q.y - a.y, q.x - a.x);
      const ccw = ((t2 - t1 + 2 * Math.PI) % (2 * Math.PI)) > Math.PI;
      const ls = visible(d);
      ls.forEach((l, i) => {
        c.ctx.beginPath();
        c.ctx.arc(a.x, a.y, R * l.value, t1, t2, ccw);
        if (d.props.fill) {
          const prev = i ? R * ls[i - 1].value : 0;
          c.ctx.arc(a.x, a.y, prev, t2, t1, !ccw);
          c.ctx.closePath();
          c.ctx.fillStyle = withAlpha(l.color, 0.1);
          c.ctx.fill();
          c.ctx.beginPath();
          c.ctx.arc(a.x, a.y, R * l.value, t1, t2, ccw);
        }
        stroke(c.ctx, { ...d.props, color: l.color }, c.active);
        c.ctx.stroke();
      });
    },
    hit: segHit,
  },
  {
    id: "pitchfan",
    name: "Pitchfan",
    group: "fib",
    icon: '<path d="M4 24L24 6M4 24L24 13M4 24L24 20"/><path d="M24 4v18" stroke-dasharray="2 2"/>',
    points: 3,
    defaults: { levels: levels([0, 0.25, 0.382, 0.5, 0.618, 0.75, 1], [0.25, 0.75]), width: 1, fill: true },
    fields: FIELDS,
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      if (!q) {
        stroke(c.ctx, d.props, c.active);
        line(c.ctx, a, b);
        return;
      }
      const ls = visible(d);
      const ends = ls.map((l) => ({ l, end: ray(a, { x: b.x + (q.x - b.x) * l.value, y: b.y + (q.y - b.y) * l.value }) }));
      if (d.props.fill)
        for (let i = 0; i + 1 < ends.length; i++) {
          c.ctx.fillStyle = withAlpha(ends[i + 1].l.color, 0.08);
          poly(c.ctx, [a, ends[i].end, ends[i + 1].end], true);
          c.ctx.fill();
        }
      for (const e of ends) {
        stroke(c.ctx, { ...d.props, color: e.l.color }, c.active);
        line(c.ctx, a, e.end);
      }
      c.ctx.setLineDash([3, 3]);
      line(c.ctx, b, q);
    },
    hit: segHit,
  },
  {
    id: "gann_box",
    name: "Gann box",
    group: "fib",
    icon: '<rect x="4" y="4" width="20" height="20"/><path d="M4 11h20M4 17h20M11 4v20M17 4v20" stroke-dasharray="2 2"/>',
    points: 2,
    defaults: { levels: levels([0, 0.25, 0.382, 0.5, 0.618, 0.75, 1]), fill: true, width: 1, showAngles: false },
    fields: [...(FIELDS || []), { key: "showAngles", label: "Angles", type: "bool" }],
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const ls = visible(d);
      for (let i = 0; i + 1 < ls.length && d.props.fill; i++) {
        const y1 = a.y + (b.y - a.y) * ls[i].value,
          y2 = a.y + (b.y - a.y) * ls[i + 1].value;
        c.ctx.fillStyle = withAlpha(ls[i + 1].color, 0.08);
        c.ctx.fillRect(Math.min(a.x, b.x), Math.min(y1, y2), Math.abs(b.x - a.x), Math.abs(y2 - y1));
      }
      for (const l of ls) {
        const y = a.y + (b.y - a.y) * l.value,
          x = a.x + (b.x - a.x) * l.value;
        stroke(c.ctx, { ...d.props, color: l.color }, c.active);
        line(c.ctx, { x: a.x, y }, { x: b.x, y });
        line(c.ctx, { x, y: a.y }, { x, y: b.y });
        if (d.props.showLabels) {
          label(c.ctx, String(l.value), Math.min(a.x, b.x) - 4, y, { align: "right", color: l.color, font: tiny });
          label(c.ctx, String(l.value), x, Math.max(a.y, b.y) + 10, { align: "center", color: l.color, font: tiny });
        }
      }
      if (d.props.showAngles) {
        stroke(c.ctx, { ...d.props, width: 1 }, false);
        line(c.ctx, a, b);
        line(c.ctx, { x: a.x, y: b.y }, { x: b.x, y: a.y });
      }
    },
    hit: (_c, p, _d, x, y) => (p[1] ? Math.min(distToSeg({ x, y }, p[0], { x: p[1].x, y: p[0].y }), distToSeg({ x, y }, p[0], { x: p[0].x, y: p[1].y }), distToSeg({ x, y }, p[1], { x: p[1].x, y: p[0].y }), distToSeg({ x, y }, p[1], { x: p[0].x, y: p[1].y })) : Infinity),
  },
  {
    id: "gann_square_fixed",
    name: "Gann square fixed",
    group: "fib",
    icon: '<rect x="4" y="4" width="20" height="20"/><path d="M4 24L24 4M4 4l20 20M4 14h20M14 4v20"/>',
    points: 2,
    defaults: { width: 1, color: "#787b86", fill: true, fillColor: "rgba(41,98,255,0.06)" },
    draw: (c, p, d) => gannSquare(c, p, d, true),
    hit: segHit,
  },
  {
    id: "gann_square",
    name: "Gann square",
    group: "fib",
    icon: '<rect x="4" y="4" width="20" height="20"/><path d="M4 24L24 4M4 24L24 14M4 24L14 4"/>',
    points: 2,
    defaults: { width: 1, color: "#787b86", fill: true, fillColor: "rgba(41,98,255,0.06)" },
    draw: (c, p, d) => gannSquare(c, p, d, false),
    hit: segHit,
  },
  {
    id: "gann_fan",
    name: "Gann fan",
    group: "fib",
    icon: '<path d="M4 24L24 4M4 24L24 10M4 24L24 16M4 24L18 4M4 24L10 4"/>',
    points: 2,
    defaults: { width: 1, showLabels: true, fill: true },
    fields: [{ key: "fill", label: "Background", type: "bool" }, { key: "showLabels", label: "Labels", type: "bool" }],
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      // 1x1 passes through B; the others are steeper (2x1, 3x1...) or flatter (1x2, 1x3...).
      const ratios: [string, number, string][] = [
        ["1/8", 8, "#ff9800"], ["1/4", 4, "#4caf50"], ["1/3", 3, "#089981"], ["1/2", 2, "#00bcd4"], ["1/1", 1, "#2962ff"],
        ["2/1", 1 / 2, "#9c27b0"], ["3/1", 1 / 3, "#e91e63"], ["4/1", 1 / 4, "#f23645"], ["8/1", 1 / 8, "#795548"],
      ];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const ends = ratios.map(([name, r, color]) => ({ name, color, end: ray(a, { x: a.x + dx, y: a.y + dy / r }) }));
      if (d.props.fill)
        for (let i = 0; i + 1 < ends.length; i++) {
          c.ctx.fillStyle = withAlpha(ends[i].color, 0.07);
          poly(c.ctx, [a, ends[i].end, ends[i + 1].end], true);
          c.ctx.fill();
        }
      for (const e of ends) {
        stroke(c.ctx, { ...d.props, color: e.color }, c.active);
        line(c.ctx, a, e.end);
        if (d.props.showLabels) {
          const t = Math.min(1, 200 / Math.hypot(e.end.x - a.x, e.end.y - a.y));
          label(c.ctx, e.name, a.x + (e.end.x - a.x) * t, a.y + (e.end.y - a.y) * t, { color: e.color, font: tiny });
        }
      }
    },
    hit: segHit,
  },
];

function gannSquare(c: RenderCtx, p: XY[], d: Drawing, fixed: boolean) {
  const [a, b0] = p;
  if (!b0) return;
  // Fixed: the box is kept square on screen.
  const side = Math.max(Math.abs(b0.x - a.x), Math.abs(b0.y - a.y));
  const b = fixed ? { x: a.x + Math.sign(b0.x - a.x || 1) * side, y: a.y + Math.sign(b0.y - a.y || 1) * side } : b0;
  const x1 = Math.min(a.x, b.x),
    y1 = Math.min(a.y, b.y),
    w = Math.abs(b.x - a.x),
    h = Math.abs(b.y - a.y);
  if (d.props.fill) {
    c.ctx.fillStyle = d.props.fillColor;
    c.ctx.fillRect(x1, y1, w, h);
  }
  stroke(c.ctx, d.props, c.active);
  c.ctx.strokeRect(x1, y1, w, h);
  for (const k of [0.25, 0.5, 0.75]) {
    c.ctx.globalAlpha = 0.6;
    line(c.ctx, { x: x1 + w * k, y: y1 }, { x: x1 + w * k, y: y1 + h });
    line(c.ctx, { x: x1, y: y1 + h * k }, { x: x1 + w, y: y1 + h * k });
    c.ctx.globalAlpha = 1;
  }
  // Angles from the first corner: 1x1 diagonal plus 1x2 and 2x1.
  const fans: XY[] = [b, { x: b.x, y: a.y + (b.y - a.y) / 2 }, { x: a.x + (b.x - a.x) / 2, y: b.y }];
  for (const f of fans) line(c.ctx, a, f);
  line(c.ctx, { x: a.x, y: b.y }, { x: b.x, y: a.y });
  // Arc of the square's side around the first corner, kept inside the box.
  c.ctx.save();
  c.ctx.beginPath();
  c.ctx.rect(x1, y1, w, h);
  c.ctx.clip();
  c.ctx.beginPath();
  c.ctx.arc(a.x, a.y, Math.min(w, h), 0, Math.PI * 2);
  c.ctx.globalAlpha = 0.4;
  c.ctx.stroke();
  c.ctx.restore();
}
