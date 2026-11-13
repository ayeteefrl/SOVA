// Gann and Fibonacci tools.
import type { Level, RenderCtx, ToolDef, XY, Drawing } from "../types";
import { distToSeg, label, line, stroke, withAlpha } from "../geom";

const lv = (value: number, color: string, visible = true): Level => ({ value, color, visible });

// TradingView's default retracement levels and colours.
export const FIB_LEVELS: Level[] = [
  lv(0, "#787b86"),
  lv(0.236, "#f23645"),
  lv(0.382, "#ff9800"),
  lv(0.5, "#4caf50"),
  lv(0.618, "#089981"),
  lv(0.786, "#00bcd4"),
  lv(1, "#787b86"),
  lv(1.618, "#2962ff"),
  lv(2.618, "#f23645"),
  lv(3.618, "#9c27b0"),
  lv(4.236, "#e91e63"),
];
const EXT_LEVELS: Level[] = [
  lv(0, "#787b86"),
  lv(0.236, "#f23645"),
  lv(0.382, "#ff9800"),
  lv(0.5, "#4caf50"),
  lv(0.618, "#089981"),
  lv(0.786, "#00bcd4"),
  lv(1, "#787b86"),
  lv(1.272, "#e91e63", false),
  lv(1.414, "#9c27b0", false),
  lv(1.618, "#2962ff"),
  lv(2, "#f23645", false),
  lv(2.618, "#f23645"),
];

const FIELDS: ToolDef["fields"] = [
  { key: "levels", label: "Levels", type: "levels" },
  { key: "fill", label: "Background", type: "bool" },
  { key: "showLabels", label: "Labels", type: "bool" },
  { key: "showPrice", label: "Prices", type: "bool" },
  { key: "reverse", label: "Reverse", type: "bool" },
  { key: "extendLeft", label: "Extend left", type: "bool" },
  { key: "extendRight", label: "Extend right", type: "bool" },
];

// Horizontal levels between x1 and x2, priced from `base` and `range`: price = base + range * level.
function drawLevels(c: RenderCtx, d: Drawing, x1: number, x2: number, base: number, range: number) {
  const levels = d.props.levels.filter((l) => l.visible).sort((a, b) => a.value - b.value);
  const left = d.props.extendLeft ? 0 : Math.min(x1, x2);
  const right = d.props.extendRight ? c.w : Math.max(x1, x2);
  const ys: { y: number; l: Level; price: number }[] = [];
  for (const l of levels) {
    const price = base + range * l.value;
    const y = c.toXY({ time: d.points[0].time, price })?.y;
    if (y == null) continue;
    ys.push({ y, l, price });
  }
  if (d.props.fill)
    for (let i = 0; i + 1 < ys.length; i++) {
      c.ctx.fillStyle = withAlpha(ys[i + 1].l.color, 0.12);
      c.ctx.fillRect(left, ys[i].y, right - left, ys[i + 1].y - ys[i].y);
    }
  for (const { y, l, price } of ys) {
    stroke(c.ctx, { ...d.props, color: l.color, width: Math.max(1, d.props.width - 1) }, c.active);
    line(c.ctx, { x: left, y }, { x: right, y });
    const txt = [d.props.showLabels ? String(l.value) : "", d.props.showPrice ? `(${c.fmtPrice(price)})` : ""].filter(Boolean).join(" ");
    if (txt) label(c.ctx, txt, left - 4, y, { align: "right", color: l.color, font: "11px Inter, sans-serif" });
  }
}

export const FIB_TOOLS: ToolDef[] = [
  {
    id: "fib_retracement",
    name: "Fib retracement",
    group: "fib",
    icon: '<path d="M4 6h20M4 11h20M4 16h20M4 22h20" stroke-dasharray="2 2"/><path d="M5 22L23 6"/>',
    points: 2,
    hotkey: "Alt+F",
    defaults: { levels: FIB_LEVELS.map((l) => ({ ...l, visible: l.value <= 1 || l.value === 1.618 })), fill: true, width: 1, color: "#787b86" },
    fields: FIELDS,
    draw: (c, p, d) => {
      const [a, b] = d.points;
      if (!b || !p[1]) return;
      // 0 at the second point, 1 at the first, like TradingView (reverse flips it).
      const [from, to] = d.props.reverse ? [b, a] : [a, b];
      drawLevels(c, d, p[0].x, p[1].x, to.price, from.price - to.price);
      c.ctx.save();
      c.ctx.setLineDash([3, 3]);
      c.ctx.strokeStyle = withAlpha("#787b86", 0.8);
      c.ctx.lineWidth = 1;
      line(c.ctx, p[0], p[1]);
      c.ctx.restore();
    },
    hit: (c, p, d, x, y) => {
      if (!p[1]) return Infinity;
      const [a, b] = d.points;
      let best = distToSeg({ x, y }, p[0], p[1]);
      const left = d.props.extendLeft ? 0 : Math.min(p[0].x, p[1].x),
        right = d.props.extendRight ? c.w : Math.max(p[0].x, p[1].x);
      for (const l of d.props.levels) {
        if (!l.visible) continue;
        const yy = c.toXY({ time: a.time, price: b.price + (a.price - b.price) * l.value })?.y;
        if (yy != null) best = Math.min(best, distToSeg({ x, y }, { x: left, y: yy }, { x: right, y: yy }));
      }
      return best;
    },
  },
  {
    id: "trend_fib_extension",
    name: "Trend-based fib extension",
    group: "fib",
    icon: '<path d="M4 22L12 8L18 16"/><path d="M14 5h11M14 10h11M14 15h11" stroke-dasharray="2 2"/>',
    points: 3,
    defaults: { levels: EXT_LEVELS, fill: true, width: 1, color: "#787b86" },
    fields: FIELDS,
    draw: (c, p, d) => {
      const [a, b, q] = d.points;
      c.ctx.save();
      c.ctx.setLineDash([3, 3]);
      c.ctx.strokeStyle = withAlpha("#787b86", 0.8);
      c.ctx.lineWidth = 1;
      if (p[1]) line(c.ctx, p[0], p[1]);
      if (p[2]) line(c.ctx, p[1], p[2]);
      c.ctx.restore();
      if (!q || !p[2]) return;
      // Levels project the a->b move from the third point.
      const x2 = p[2].x + Math.max(60, Math.abs(p[1].x - p[0].x));
      drawLevels(c, d, p[2].x, x2, q.price, b.price - a.price);
    },
    hit: (_c, p, _d, x, y) => {
      let best = Infinity;
      for (let i = 0; i + 1 < p.length; i++) best = Math.min(best, distToSeg({ x, y }, p[i], p[i + 1]));
      return best;
    },
  },
];

export type { XY };
