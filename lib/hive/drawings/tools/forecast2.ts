// Forecasting and measurement tools that read the chart's bars: anchored VWAP, fixed-range and
// anchored volume profiles, bars pattern, ghost feed; plus position forecast and sector.
import type { ChartBar, Drawing, RenderCtx, ToolDef, XY } from "../types";
import { distToPoly, distToSeg, label, line, poly, stroke, withAlpha } from "../geom";

const segHit = (_c: RenderCtx, p: XY[], _d: Drawing, x: number, y: number) => distToPoly({ x, y }, p);

function barRange(c: RenderCtx, t1: number, t2: number) {
  const a = c.indexOf(Math.min(t1, t2)),
    b = c.indexOf(Math.max(t1, t2));
  if (a == null || b == null) return null;
  const from = Math.max(0, Math.ceil(a - 1e-6)),
    to = Math.min(c.bars.length - 1, Math.floor(b + 1e-6));
  return to >= from ? { from, to } : null;
}

// Volume per price row for bars[from..to], with point of control and 70% value area.
function profile(bars: ChartBar[], from: number, to: number, rows: number) {
  let hi = -Infinity,
    lo = Infinity;
  for (let i = from; i <= to; i++) (hi = Math.max(hi, bars[i].high)), (lo = Math.min(lo, bars[i].low));
  if (!(hi > lo)) return null;
  const step = (hi - lo) / rows;
  const up = new Array(rows).fill(0),
    dn = new Array(rows).fill(0);
  for (let i = from; i <= to; i++) {
    const b = bars[i],
      v = b.volume || 0;
    if (!v) continue;
    const a = Math.min(rows - 1, Math.floor((b.low - lo) / step)),
      z = Math.min(rows - 1, Math.floor((b.high - lo) / step));
    for (let k = a; k <= z; k++) (b.close >= b.open ? up : dn)[k] += v / (z - a + 1);
  }
  const tot = up.map((u, k) => u + dn[k]);
  const sum = tot.reduce((s, x) => s + x, 0);
  if (!sum) return null;
  let poc = 0;
  tot.forEach((t, k) => t > tot[poc] && (poc = k));
  let inside = tot[poc],
    va = poc,
    vb = poc;
  while (inside < sum * 0.7 && (va > 0 || vb < rows - 1)) {
    const below = va > 0 ? tot[va - 1] : -1,
      above = vb < rows - 1 ? tot[vb + 1] : -1;
    if (above >= below) inside += tot[++vb];
    else inside += tot[--va];
  }
  return { lo, step, up, dn, tot, poc, va, vb, max: Math.max(...tot) };
}

function drawProfile(c: RenderCtx, d: Drawing, from: number, to: number, x0: number, width: number) {
  const prof = profile(c.bars, from, to, Math.max(4, Math.min(500, Number(d.props.rows) || 24)));
  if (!prof) return;
  for (let k = 0; k < prof.tot.length; k++) {
    const yTop = c.yAt(prof.lo + (k + 1) * prof.step),
      yBot = c.yAt(prof.lo + k * prof.step);
    if (yTop == null || yBot == null) continue;
    const inVa = k >= prof.va && k <= prof.vb;
    const h = Math.max(1, yBot - yTop - 1);
    const uw = (prof.up[k] / prof.max) * width,
      dw = (prof.dn[k] / prof.max) * width;
    c.ctx.fillStyle = inVa ? "rgba(41,98,255,0.7)" : "rgba(41,98,255,0.25)";
    c.ctx.fillRect(x0, yTop, uw, h);
    c.ctx.fillStyle = inVa ? "rgba(251,192,45,0.7)" : "rgba(251,192,45,0.25)";
    c.ctx.fillRect(x0 + uw, yTop, dw, h);
  }
  const yPoc = c.yAt(prof.lo + (prof.poc + 0.5) * prof.step);
  const xEnd = c.xAt(to);
  if (yPoc != null && xEnd != null) {
    c.ctx.strokeStyle = "#f44336";
    c.ctx.lineWidth = 2;
    c.ctx.setLineDash([]);
    line(c.ctx, { x: x0, y: yPoc }, { x: Math.max(xEnd, x0 + width), y: yPoc });
  }
}

const VP_FIELDS: ToolDef["fields"] = [
  { key: "rows", label: "Rows", type: "number", min: 4, max: 500 },
  { key: "widthPct", label: "Width (% of range)", type: "number", min: 5, max: 100 },
];

export const FORECAST_TOOLS_2: ToolDef[] = [
  {
    id: "position_forecast",
    name: "Position forecast",
    group: "forecast",
    icon: '<circle cx="6" cy="20" r="2"/><path d="M8 19L22 8M22 8h-5M22 8v5"/>',
    points: 2,
    defaults: { color: "#2962ff", width: 2 },
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const [pa, pb] = d.points;
      const up = pb.price >= pa.price;
      const col = up ? "#089981" : "#f23645";
      stroke(c.ctx, { ...d.props, color: col }, c.active);
      line(c.ctx, a, b);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      c.ctx.fillStyle = col;
      c.ctx.beginPath();
      c.ctx.moveTo(b.x, b.y);
      c.ctx.lineTo(b.x - 10 * Math.cos(ang - 0.4), b.y - 10 * Math.sin(ang - 0.4));
      c.ctx.lineTo(b.x - 10 * Math.cos(ang + 0.4), b.y - 10 * Math.sin(ang + 0.4));
      c.ctx.fill();
      c.ctx.beginPath();
      c.ctx.arc(a.x, a.y, 4, 0, Math.PI * 2);
      c.ctx.fill();
      const diff = pb.price - pa.price;
      label(c.ctx, `${diff >= 0 ? "+" : ""}${c.fmtPrice(diff)} (${((diff / pa.price) * 100).toFixed(2)}%)\n${c.barsBetween(pa.time, pb.time)} bars, ${c.fmtTime(pb.time)}`, b.x + 10, b.y, {
        color: "#fff",
        bg: col,
        font: "11px Inter, sans-serif",
      });
    },
    hit: (_c, p, _d, x, y) => (p[1] ? distToSeg({ x, y }, p[0], p[1]) : Infinity),
  },
  {
    id: "bars_pattern",
    name: "Bars pattern",
    group: "forecast",
    icon: '<path d="M5 8v10M9 6v8M13 10v10" /><path d="M17 8v10M21 6v8M25 10v10" stroke-dasharray="2 2"/>',
    points: 2,
    defaults: { color: "#2962ff", mode: "OHLC", mirror: false, flip: false },
    fields: [
      { key: "mode", label: "Mode", type: "select", options: [{ value: "OHLC", label: "Bars (OHLC)" }, { value: "HL", label: "High-low bars" }, { value: "Line", label: "Line (close)" }] },
      { key: "mirror", label: "Mirrored", type: "bool" },
      { key: "flip", label: "Flipped", type: "bool" },
    ],
    draw: (c, p, d) => {
      // The bars between the two points, copied forward from the second point.
      const [a, b] = p;
      if (!b) return;
      const r = barRange(c, d.points[0].time, d.points[1].time);
      stroke(c.ctx, { ...d.props, width: 1 }, false);
      c.ctx.setLineDash([3, 3]);
      line(c.ctx, a, b);
      if (!r) return;
      const src = c.bars.slice(r.from, r.to + 1);
      if (d.props.mirror) src.reverse();
      const base = src[0].open,
        target = d.points[1].price;
      const startIdx = c.indexOf(d.points[1].time);
      if (startIdx == null) return;
      const map = (v: number) => target + (d.props.flip ? base - v : v - base);
      c.ctx.setLineDash([]);
      c.ctx.strokeStyle = withAlpha(d.props.color, 0.8);
      c.ctx.lineWidth = 1;
      const pts: XY[] = [];
      src.forEach((bar, k) => {
        const x = c.xAt(startIdx + k);
        if (x == null) return;
        const y = (v: number) => c.yAt(map(v));
        const [o, h, l, cl] = [y(bar.open), y(bar.high), y(bar.low), y(bar.close)];
        if (o == null || h == null || l == null || cl == null) return;
        if (d.props.mode === "Line") return pts.push({ x, y: cl });
        line(c.ctx, { x, y: h }, { x, y: l });
        if (d.props.mode === "OHLC") {
          line(c.ctx, { x: x - 3, y: o }, { x, y: o });
          line(c.ctx, { x, y: cl }, { x: x + 3, y: cl });
        }
      });
      if (pts.length) {
        poly(c.ctx, pts);
        c.ctx.stroke();
      }
    },
    hit: (_c, p, _d, x, y) => (p[1] ? distToSeg({ x, y }, p[0], p[1]) : Infinity),
  },
  {
    id: "ghost_feed",
    name: "Ghost feed",
    group: "forecast",
    icon: '<path d="M5 18v6M9 12v8M13 14v6M17 8v8M21 6v6" stroke-dasharray="2 1"/>',
    points: -1,
    defaults: { color: "#787b86", barsPerLeg: 5 },
    fields: [{ key: "barsPerLeg", label: "Bars between clicks", type: "number", min: 1, max: 50 }],
    draw: (c, p, d) => {
      // Candles drawn along the path you click, a few bars per leg.
      stroke(c.ctx, { ...d.props, width: 1 }, false);
      c.ctx.setLineDash([2, 3]);
      poly(c.ctx, p);
      c.ctx.stroke();
      c.ctx.setLineDash([]);
      const n = Math.max(1, Number(d.props.barsPerLeg) || 5);
      for (let i = 0; i + 1 < p.length; i++) {
        const a = p[i],
          b = p[i + 1];
        for (let k = 0; k < n; k++) {
          const t0 = k / n,
            t1 = (k + 1) / n;
          const x = a.x + (b.x - a.x) * ((t0 + t1) / 2);
          const yo = a.y + (b.y - a.y) * t0,
            yc = a.y + (b.y - a.y) * t1;
          const wig = Math.abs(yc - yo) * 0.6 + 2;
          const w = Math.max(2, (Math.abs(b.x - a.x) / n) * 0.6);
          c.ctx.fillStyle = yc < yo ? "rgba(8,153,129,0.5)" : "rgba(242,54,69,0.5)";
          c.ctx.strokeStyle = c.ctx.fillStyle;
          line(c.ctx, { x, y: Math.min(yo, yc) - wig }, { x, y: Math.max(yo, yc) + wig });
          c.ctx.fillRect(x - w / 2, Math.min(yo, yc), w, Math.max(1, Math.abs(yc - yo)));
        }
      }
    },
    hit: segHit,
  },
  {
    id: "sector",
    name: "Sector",
    group: "forecast",
    icon: '<path d="M6 22L24 12A20 20 0 0 0 16 4z"/>',
    points: 3,
    defaults: { color: "#2962ff", fill: true, fillColor: "rgba(41,98,255,0.15)" },
    fields: [{ key: "fill", label: "Background", type: "bool" }, { key: "fillColor", label: "Background colour", type: "color" }],
    draw: (c, p, d) => {
      const [a, b, q] = p;
      if (!b) return;
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, a, b);
      if (!q) return;
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      const t1 = Math.atan2(b.y - a.y, b.x - a.x),
        t2 = Math.atan2(q.y - a.y, q.x - a.x);
      c.ctx.beginPath();
      c.ctx.moveTo(a.x, a.y);
      c.ctx.arc(a.x, a.y, r, t1, t2, ((t2 - t1 + 2 * Math.PI) % (2 * Math.PI)) > Math.PI);
      c.ctx.closePath();
      if (d.props.fill) {
        c.ctx.fillStyle = d.props.fillColor;
        c.ctx.fill();
      }
      c.ctx.stroke();
    },
    hit: segHit,
  },
  {
    id: "anchored_vwap",
    name: "Anchored VWAP",
    group: "forecast",
    icon: '<path d="M4 20c4-2 6-10 10-10s6 6 10 2"/><circle cx="4" cy="20" r="2"/>',
    points: 1,
    defaults: { color: "#2962ff", width: 2, bands: false, mult: 1 },
    fields: [
      { key: "bands", label: "Standard deviation bands", type: "bool" },
      { key: "mult", label: "Band multiplier", type: "number", min: 0.1, step: 0.1 },
    ],
    draw: (c, p, d) => {
      const r = barRange(c, d.points[0].time, Infinity);
      if (!r) return;
      let pv = 0,
        vol = 0,
        pv2 = 0;
      const mid: XY[] = [],
        up: XY[] = [],
        dn: XY[] = [];
      for (let i = r.from; i < c.bars.length; i++) {
        const b = c.bars[i];
        const tp = (b.high + b.low + b.close) / 3,
          v = b.volume || 1;
        pv += tp * v;
        vol += v;
        pv2 += tp * tp * v;
        const vwap = pv / vol;
        const sd = Math.sqrt(Math.max(0, pv2 / vol - vwap * vwap)) * Number(d.props.mult || 1);
        const x = c.xAt(i),
          y = c.yAt(vwap);
        if (x == null || y == null) continue;
        mid.push({ x, y });
        if (d.props.bands) {
          up.push({ x, y: c.yAt(vwap + sd) ?? y });
          dn.push({ x, y: c.yAt(vwap - sd) ?? y });
        }
      }
      stroke(c.ctx, d.props, c.active);
      poly(c.ctx, mid);
      c.ctx.stroke();
      if (d.props.bands) {
        c.ctx.lineWidth = 1;
        c.ctx.strokeStyle = withAlpha(d.props.color, 0.6);
        poly(c.ctx, up);
        c.ctx.stroke();
        poly(c.ctx, dn);
        c.ctx.stroke();
      }
      (d as { _path?: XY[] })._path = mid;
    },
    hit: (_c, p, d, x, y) => Math.min(Math.hypot(x - p[0].x, y - p[0].y), distToPoly({ x, y }, (d as { _path?: XY[] })._path || [])),
  },
  {
    id: "fixed_range_vp",
    name: "Fixed range volume profile",
    group: "forecast",
    icon: '<path d="M4 4v20M24 4v20"/><path d="M4 8h8M4 12h14M4 16h10M4 20h6"/>',
    points: 2,
    defaults: { rows: 24, widthPct: 40 },
    fields: VP_FIELDS,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      c.ctx.fillStyle = "rgba(41,98,255,0.05)";
      c.ctx.fillRect(Math.min(a.x, b.x), 0, Math.abs(b.x - a.x), c.h);
      const r = barRange(c, d.points[0].time, d.points[1].time);
      if (!r) return;
      drawProfile(c, d, r.from, r.to, Math.min(a.x, b.x), (Math.abs(b.x - a.x) * Number(d.props.widthPct || 40)) / 100);
    },
    // Anywhere inside the range selects it.
    hit: (_c, p, _d, x) => (p[1] && x >= Math.min(p[0].x, p[1].x) && x <= Math.max(p[0].x, p[1].x) ? 3 : Infinity),
  },
  {
    id: "anchored_vp",
    name: "Anchored volume profile",
    group: "forecast",
    icon: '<path d="M4 4v20"/><path d="M4 8h8M4 12h14M4 16h10M4 20h6"/><circle cx="4" cy="24" r="2"/>',
    points: 1,
    defaults: { rows: 24, widthPct: 30 },
    fields: VP_FIELDS,
    draw: (c, p, d) => {
      const r = barRange(c, d.points[0].time, Infinity);
      if (!r) return;
      const xEnd = c.xAt(r.to);
      if (xEnd == null) return;
      stroke(c.ctx, { ...d.props, width: 1, color: "#2962ff" }, c.active);
      line(c.ctx, { x: p[0].x, y: 0 }, { x: p[0].x, y: c.h });
      drawProfile(c, d, r.from, r.to, p[0].x, (Math.max(20, xEnd - p[0].x) * Number(d.props.widthPct || 30)) / 100);
    },
    hit: (_c, p, _d, x) => Math.abs(x - p[0].x),
  },
];
