// More trend line tools: regression trend, flat top/bottom, disjoint channel and the pitchforks.
import type { Drawing, Level, RenderCtx, ToolDef, XY } from "../types";
import { distToSeg, extended, line, poly, stroke, withAlpha } from "../geom";

const lv = (value: number, color: string, visible = true): Level => ({ value, color, visible });
const FILL_FIELDS: ToolDef["fields"] = [
  { key: "fill", label: "Background", type: "bool" },
  { key: "fillColor", label: "Background colour", type: "color" },
  { key: "extendLeft", label: "Extend left", type: "bool" },
  { key: "extendRight", label: "Extend right", type: "bool" },
];

// Least-squares line through the closes between two times, with ±deviation bands.
function regression(c: RenderCtx, d: Drawing) {
  const [a, b] = d.points;
  const i1 = c.indexOf(Math.min(a.time, b.time)),
    i2 = c.indexOf(Math.max(a.time, b.time));
  if (i1 == null || i2 == null) return null;
  const from = Math.max(0, Math.ceil(i1)),
    to = Math.min(c.bars.length - 1, Math.floor(i2));
  const n = to - from + 1;
  if (n < 2) return null;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (let k = 0; k < n; k++) {
    const y = c.bars[from + k].close;
    sx += k;
    sy += y;
    sxx += k * k;
    sxy += k * y;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1),
    icpt = (sy - slope * sx) / n;
  let dev = 0;
  for (let k = 0; k < n; k++) dev = Math.max(dev, Math.abs(c.bars[from + k].close - (icpt + slope * k)));
  let sd = 0;
  for (let k = 0; k < n; k++) sd += (c.bars[from + k].close - (icpt + slope * k)) ** 2;
  sd = Math.sqrt(sd / n);
  return { from, to, y1: icpt, y2: icpt + slope * (n - 1), dev: Number(d.props.useMaxDev) ? dev : sd * Number(d.props.deviation ?? 2) };
}

// Pitchfork: median line from the (adjusted) first point through the middle of B and C, with
// parallel lines through B and C and optional extra levels between and beyond them.
function pitchfork(variant: "original" | "schiff" | "modified" | "inside"): ToolDef["draw"] {
  return (c, p, d) => {
    const [A0, B, C] = p;
    if (!B) return;
    if (!C) {
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, A0, B);
      return;
    }
    let A = A0;
    if (variant === "schiff") A = { x: A0.x, y: (A0.y + B.y) / 2 };
    if (variant === "modified") A = { x: (A0.x + B.x) / 2, y: (A0.y + B.y) / 2 };
    const M = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
    const start = variant === "inside" ? { x: (A0.x + C.x) / 2, y: (A0.y + C.y) / 2 } : A;
    const dir = { x: M.x - start.x, y: M.y - start.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const u = { x: (dir.x / len) * 1e5, y: (dir.y / len) * 1e5 };
    // Offset of a level k (1 = through B or C) from the median, measured at M.
    const half = { x: (C.x - B.x) / 2, y: (C.y - B.y) / 2 };
    const at = (k: number) => ({ x: M.x + half.x * k, y: M.y + half.y * k });
    const levels = d.props.levels.filter((l) => l.visible).sort((a, b) => a.value - b.value);
    const all = [...levels.map((l) => ({ k: -l.value, l })), { k: 0, l: lv(0, d.props.color) }, ...levels.map((l) => ({ k: l.value, l }))].sort((a, b) => a.k - b.k);
    if (d.props.fill)
      for (let i = 0; i + 1 < all.length; i++) {
        const p1 = at(all[i].k),
          p2 = at(all[i + 1].k);
        c.ctx.fillStyle = withAlpha(all[i + 1].k > 0 ? all[i + 1].l.color : all[i].l.color, 0.1);
        poly(c.ctx, [p1, { x: p1.x + u.x, y: p1.y + u.y }, { x: p2.x + u.x, y: p2.y + u.y }, p2], true);
        c.ctx.fill();
      }
    for (const { k, l } of all) {
      const q = at(k);
      stroke(c.ctx, { ...d.props, color: k === 0 ? d.props.color : l.color }, c.active);
      line(c.ctx, q, { x: q.x + u.x, y: q.y + u.y });
    }
    stroke(c.ctx, { ...d.props, width: 1 }, false);
    line(c.ctx, start, M);
    line(c.ctx, B, C);
  };
}

const PITCH_LEVELS = [lv(0.25, "#ffb74d", false), lv(0.382, "#81c784", false), lv(0.5, "#4caf50", true), lv(0.618, "#009688", false), lv(0.75, "#64b5f6", false), lv(1, "#2962ff", true), lv(1.5, "#9575cd", false), lv(1.75, "#ba68c8", false), lv(2, "#f06292", false)];
const PITCH: Partial<ToolDef> = {
  points: 3,
  group: "lines",
  defaults: { levels: PITCH_LEVELS, fill: true, color: "#f23645" },
  fields: [
    { key: "levels", label: "Levels", type: "levels" },
    { key: "fill", label: "Background", type: "bool" },
  ],
  hit: (_c, p, _d, x, y) => {
    let best = Infinity;
    for (let i = 0; i + 1 < p.length; i++) best = Math.min(best, distToSeg({ x, y }, p[i], p[i + 1]));
    if (p.length === 3) {
      const M = { x: (p[1].x + p[2].x) / 2, y: (p[1].y + p[2].y) / 2 };
      const [, far] = extended(p[0], M, false, true);
      best = Math.min(best, distToSeg({ x, y }, p[0], far));
    }
    return best;
  },
};

export const LINE_TOOLS_2: ToolDef[] = [
  {
    id: "regression_trend",
    name: "Regression trend",
    group: "lines",
    icon: '<path d="M4 20L24 8M4 15L24 3M4 25L24 13" /><circle cx="4" cy="20" r="2"/><circle cx="24" cy="8" r="2"/>',
    points: 2,
    defaults: { fill: true, fillColor: "rgba(41,98,255,0.08)", deviation: 2, useMaxDev: false, extendRight: false },
    fields: [
      { key: "deviation", label: "Deviation (σ)", type: "number", min: 0, step: 0.5 },
      { key: "useMaxDev", label: "Use maximum deviation", type: "bool" },
      ...(FILL_FIELDS || []),
    ],
    draw: (c, p, d) => {
      const r = regression(c, d);
      if (!r || !p[1]) {
        stroke(c.ctx, d.props, c.active);
        if (p[1]) line(c.ctx, p[0], p[1]);
        return;
      }
      const x1 = c.xAt(r.from),
        x2 = c.xAt(r.to);
      if (x1 == null || x2 == null) return;
      const ys = [r.y1, r.y2, r.y1 + r.dev, r.y2 + r.dev, r.y1 - r.dev, r.y2 - r.dev].map((v) => c.yAt(v));
      if (ys.some((v) => v == null)) return;
      const [b1, b2, u1, u2, l1, l2] = ys as number[];
      const ext = (a: XY, b: XY) => extended(a, b, d.props.extendLeft, d.props.extendRight);
      const [U1, U2] = ext({ x: x1, y: u1 }, { x: x2, y: u2 });
      const [L1, L2] = ext({ x: x1, y: l1 }, { x: x2, y: l2 });
      if (d.props.fill) {
        c.ctx.fillStyle = d.props.fillColor;
        poly(c.ctx, [U1, U2, L2, L1], true);
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, U1, U2);
      line(c.ctx, L1, L2);
      c.ctx.setLineDash([5, 4]);
      const [B1, B2] = ext({ x: x1, y: b1 }, { x: x2, y: b2 });
      line(c.ctx, B1, B2);
    },
  },
  {
    id: "flat_top_bottom",
    name: "Flat top/bottom",
    group: "lines",
    icon: '<path d="M4 8h20M4 22L24 12"/><circle cx="4" cy="22" r="2"/><circle cx="24" cy="12" r="2"/>',
    points: 3,
    defaults: { fill: true, fillColor: "rgba(41,98,255,0.12)" },
    fields: FILL_FIELDS,
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      const flat = q ? q.y : a.y;
      const [l1, r1] = extended(a, b, d.props.extendLeft, d.props.extendRight);
      const l2 = { x: l1.x, y: flat },
        r2 = { x: r1.x, y: flat };
      if (d.props.fill && q) {
        c.ctx.fillStyle = d.props.fillColor;
        poly(c.ctx, [l1, r1, r2, l2], true);
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, l1, r1);
      if (q) line(c.ctx, l2, r2);
    },
  },
  {
    id: "disjoint_channel",
    name: "Disjoint channel",
    group: "lines",
    icon: '<path d="M4 6L24 14M4 22L24 14"/><circle cx="4" cy="6" r="2"/><circle cx="24" cy="14" r="2"/>',
    points: 3,
    defaults: { fill: true, fillColor: "rgba(41,98,255,0.12)" },
    fields: FILL_FIELDS,
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      // Second line starts below/above the first point and mirrors its slope.
      const off = q ? q.y - a.y : 0;
      const a2 = { x: a.x, y: a.y + off },
        b2 = { x: b.x, y: a.y + off - (b.y - a.y) };
      if (d.props.fill && q) {
        c.ctx.fillStyle = d.props.fillColor;
        poly(c.ctx, [a, b, b2, a2], true);
        c.ctx.fill();
      }
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, a, b);
      if (q) line(c.ctx, a2, b2);
    },
  },
  { ...PITCH, id: "pitchfork", name: "Pitchfork", icon: '<path d="M4 22L14 14M14 14L24 6M10 8l14 0M10 20l14 0"/><circle cx="4" cy="22" r="2"/>', draw: pitchfork("original") } as ToolDef,
  { ...PITCH, id: "schiff_pitchfork", name: "Schiff pitchfork", icon: '<path d="M4 16L14 14M14 14L24 6M10 8l14 0M10 20l14 0"/><circle cx="4" cy="16" r="2"/>', draw: pitchfork("schiff") } as ToolDef,
  { ...PITCH, id: "modified_schiff_pitchfork", name: "Modified Schiff pitchfork", icon: '<path d="M8 16L14 14M14 14L24 6M10 8l14 0M10 20l14 0"/><circle cx="8" cy="16" r="2"/>', draw: pitchfork("modified") } as ToolDef,
  { ...PITCH, id: "inside_pitchfork", name: "Inside pitchfork", icon: '<path d="M6 18L24 12M10 8l14 0M10 20l14 0"/><circle cx="6" cy="18" r="2"/>', draw: pitchfork("inside") } as ToolDef,
];

