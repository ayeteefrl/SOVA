// Chart patterns: harmonic (XABCD, cypher, ABCD, three drives), head and shoulders, triangle,
// Elliott waves, cyclic lines, time cycles and the sine line.
import type { Drawing, RenderCtx, ToolDef, XY } from "../types";
import { distToPoly, label, line, poly, stroke, withAlpha } from "../geom";

const FIELDS: ToolDef["fields"] = [
  { key: "fill", label: "Background", type: "bool" },
  { key: "fillColor", label: "Background colour", type: "color" },
  { key: "showLabels", label: "Labels", type: "bool" },
];
const polyHit = (_c: RenderCtx, p: XY[], _d: Drawing, x: number, y: number) => distToPoly({ x, y }, p);

// A point label goes above a peak and below a trough.
function pointLabel(c: RenderCtx, p: XY[], i: number, text: string, color: string, bg?: string) {
  const prev = p[i - 1] ?? p[i + 1],
    next = p[i + 1] ?? p[i - 1];
  const peak = !prev || !next ? true : p[i].y <= Math.min(prev.y, next.y) || (p[i].y < prev.y && p[i].y < next.y);
  label(c.ctx, text, p[i].x, p[i].y + (peak ? -12 : 12), { align: "center", color: bg ? "#fff" : color, bg, font: "600 12px Inter, sans-serif", pad: 4 });
}

function ratio(c: RenderCtx, a: XY, b: XY, text: string, color: string) {
  c.ctx.save();
  c.ctx.setLineDash([4, 4]);
  c.ctx.strokeStyle = withAlpha(color, 0.8);
  c.ctx.lineWidth = 1;
  line(c.ctx, a, b);
  c.ctx.restore();
  label(c.ctx, text, (a.x + b.x) / 2, (a.y + b.y) / 2, { align: "center", color: "#fff", bg: withAlpha(color, 0.85), font: "11px Inter, sans-serif", pad: 3 });
}

const r = (num: number, den: number) => (den ? Math.abs(num / den).toFixed(3) : "—");

function harmonic(id: string, name: string, names: string[], icon: string): ToolDef {
  return {
    id,
    name,
    group: "patterns",
    icon,
    points: names.length,
    defaults: { color: "#2962ff", fill: true, fillColor: "rgba(41,98,255,0.2)", width: 2 },
    fields: FIELDS,
    draw: (c, p, d) => {
      const pr = d.points.map((x) => x.price);
      if (d.props.fill)
        for (let i = 0; i + 2 < p.length; i += 2) {
          c.ctx.fillStyle = d.props.fillColor;
          poly(c.ctx, [p[i], p[i + 1], p[i + 2]], true);
          c.ctx.fill();
        }
      stroke(c.ctx, d.props, c.active);
      poly(c.ctx, p);
      c.ctx.stroke();
      // Retracement ratios of each leg against the one before it.
      if (p.length >= 3) ratio(c, p[0], p[2], r(pr[2] - pr[1], pr[1] - pr[0]), d.props.color);
      if (p.length >= 4) ratio(c, p[1], p[3], r(pr[3] - pr[2], pr[2] - pr[1]), d.props.color);
      if (p.length >= 5) {
        ratio(c, p[2], p[4], r(pr[4] - pr[3], pr[3] - pr[2]), d.props.color);
        if (names.length === 5) ratio(c, p[0], p[4], r(pr[4] - pr[1], pr[1] - pr[0]), d.props.color);
      }
      if (d.props.showLabels) p.forEach((_, i) => names[i] && pointLabel(c, p, i, names[i], d.props.color, d.props.color));
    },
    hit: polyHit,
  };
}

function wave(id: string, name: string, names: string[], color: string, icon: string): ToolDef {
  return {
    id,
    name,
    group: "patterns",
    icon,
    points: names.length,
    defaults: { color, width: 2 },
    fields: [{ key: "showLabels", label: "Labels", type: "bool" }],
    draw: (c, p, d) => {
      stroke(c.ctx, d.props, c.active);
      poly(c.ctx, p);
      c.ctx.stroke();
      if (d.props.showLabels) p.forEach((_, i) => names[i] && pointLabel(c, p, i, names[i], d.props.color));
    },
    hit: polyHit,
  };
}

const ZIG = (n: number) => '<path d="' + Array.from({ length: n }, (_, i) => `${i ? "L" : "M"}${4 + (i * 20) / (n - 1)} ${i % 2 ? 8 : 20}`).join("") + '"/>';

export const PATTERN_TOOLS: ToolDef[] = [
  harmonic("xabcd", "XABCD pattern", ["X", "A", "B", "C", "D"], ZIG(5)),
  harmonic("cypher", "Cypher pattern", ["X", "A", "B", "C", "D"], ZIG(5).replace("<path", '<path stroke-dasharray="3 1"')),
  {
    id: "head_shoulders",
    name: "Head and shoulders",
    group: "patterns",
    icon: '<path d="M3 20L7 12L10 17L14 5L18 17L21 12L25 20M5 17h20" />',
    points: 7,
    defaults: { color: "#089981", fill: true, fillColor: "rgba(8,153,129,0.2)", width: 2 },
    fields: FIELDS,
    draw: (c, p, d) => {
      if (d.props.fill)
        for (const [a, b, q] of [
          [0, 1, 2],
          [2, 3, 4],
          [4, 5, 6],
        ])
          if (p[q]) {
            c.ctx.fillStyle = d.props.fillColor;
            poly(c.ctx, [p[a], p[b], p[q]], true);
            c.ctx.fill();
          }
      stroke(c.ctx, d.props, c.active);
      poly(c.ctx, p);
      c.ctx.stroke();
      if (p[4]) {
        // Neckline through the two troughs, extended to both shoulders' bases.
        const [n1, n2] = [p[2], p[4]];
        const k = (n2.y - n1.y) / (n2.x - n1.x || 1);
        const left = p[0].x,
          right = (p[6] || p[4]).x;
        c.ctx.save();
        c.ctx.setLineDash([6, 4]);
        line(c.ctx, { x: left, y: n1.y + k * (left - n1.x) }, { x: right, y: n1.y + k * (right - n1.x) });
        c.ctx.restore();
      }
      if (d.props.showLabels) {
        if (p[1]) pointLabel(c, p, 1, "Left shoulder", d.props.color, d.props.color);
        if (p[3]) pointLabel(c, p, 3, "Head", d.props.color, d.props.color);
        if (p[5]) pointLabel(c, p, 5, "Right shoulder", d.props.color, d.props.color);
      }
    },
    hit: polyHit,
  },
  harmonic("abcd", "ABCD pattern", ["A", "B", "C", "D"], ZIG(4)),
  {
    id: "triangle_pattern",
    name: "Triangle pattern",
    group: "patterns",
    icon: '<path d="M4 6L10 22L16 9L22 18"/><path d="M4 6L24 13M10 22L24 15" stroke-dasharray="2 2"/>',
    points: 4,
    defaults: { color: "#9c27b0", fill: true, fillColor: "rgba(156,39,176,0.15)", width: 2 },
    fields: FIELDS,
    draw: (c, p, d) => {
      stroke(c.ctx, d.props, c.active);
      poly(c.ctx, p);
      c.ctx.stroke();
      if (p.length < 4) return;
      // Upper line through A and C, lower through B and D, run to where they meet.
      const [a, b, q, e] = p;
      const k1 = (q.y - a.y) / (q.x - a.x || 1),
        k2 = (e.y - b.y) / (e.x - b.x || 1);
      let xEnd = e.x + (e.x - a.x) * 0.5;
      if (k1 !== k2) {
        const xi = (b.y - a.y + k1 * a.x - k2 * b.x) / (k1 - k2);
        if (xi > e.x) xEnd = xi;
      }
      const up = { x: xEnd, y: a.y + k1 * (xEnd - a.x) },
        dn = { x: xEnd, y: b.y + k2 * (xEnd - b.x) };
      if (d.props.fill) {
        c.ctx.fillStyle = d.props.fillColor;
        poly(c.ctx, [a, up, dn, b], true);
        c.ctx.fill();
      }
      c.ctx.setLineDash([5, 4]);
      line(c.ctx, a, up);
      line(c.ctx, b, dn);
      if (d.props.showLabels) ["A", "B", "C", "D"].forEach((t, i) => pointLabel(c, p, i, t, d.props.color));
    },
    hit: polyHit,
  },
  harmonic("three_drives", "Three drives pattern", ["", "1", "A", "2", "B", "3", ""], ZIG(7)),
  wave("elliott_impulse", "Elliott impulse wave (1·2·3·4·5)", ["0", "(1)", "(2)", "(3)", "(4)", "(5)"], "#3d85c6", ZIG(6)),
  wave("elliott_correction", "Elliott correction wave (A·B·C)", ["0", "(A)", "(B)", "(C)"], "#3d85c6", ZIG(4)),
  wave("elliott_triangle", "Elliott triangle wave (A·B·C·D·E)", ["0", "(A)", "(B)", "(C)", "(D)", "(E)"], "#ff9800", ZIG(6)),
  wave("elliott_double_combo", "Elliott double combo wave (W·X·Y)", ["0", "(W)", "(X)", "(Y)"], "#6aa84f", ZIG(4)),
  wave("elliott_triple_combo", "Elliott triple combo wave (W·X·Y·X·Z)", ["0", "(W)", "(X)", "(Y)", "(X)", "(Z)"], "#6aa84f", ZIG(6)),
  {
    id: "cyclic_lines",
    name: "Cyclic lines",
    group: "patterns",
    icon: '<path d="M5 4v20M11 4v20M17 4v20M23 4v20" stroke-dasharray="3 2"/>',
    points: 2,
    defaults: { color: "#2962ff", width: 1 },
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const step = b.x - a.x;
      stroke(c.ctx, d.props, c.active);
      line(c.ctx, a, b);
      if (Math.abs(step) < 3) return;
      for (let x = a.x; x >= -step && x <= c.w + Math.abs(step); x += step) line(c.ctx, { x, y: 0 }, { x, y: c.h });
    },
    hit: (c, p, _d, x) => {
      if (!p[1]) return Infinity;
      const step = p[1].x - p[0].x;
      if (Math.abs(step) < 3) return Infinity;
      const k = (x - p[0].x) / step;
      return k < -0.5 ? Infinity : Math.abs(x - (p[0].x + Math.round(k) * step));
    },
  },
  {
    id: "time_cycles",
    name: "Time cycles",
    group: "patterns",
    icon: '<path d="M2 20a5 5 0 0 1 10 0a5 5 0 0 1 10 0"/>',
    points: 2,
    defaults: { color: "#ff9800", width: 1, fill: true, fillColor: "rgba(255,152,0,0.08)" },
    fields: FIELDS,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const dia = b.x - a.x,
        r = Math.abs(dia) / 2;
      if (r < 2) return;
      stroke(c.ctx, d.props, c.active);
      for (let x = Math.min(a.x, b.x); x <= c.w; x += Math.abs(dia)) {
        c.ctx.beginPath();
        c.ctx.arc(x + r, a.y, r, Math.PI, 2 * Math.PI);
        if (d.props.fill) {
          c.ctx.fillStyle = d.props.fillColor;
          c.ctx.fill();
        }
        c.ctx.stroke();
      }
    },
    hit: (_c, p, _d, x, y) => {
      if (!p[1]) return Infinity;
      const dia = Math.abs(p[1].x - p[0].x),
        r = dia / 2;
      if (r < 2 || x < Math.min(p[0].x, p[1].x)) return Infinity;
      const k = Math.floor((x - Math.min(p[0].x, p[1].x)) / dia);
      const cx = Math.min(p[0].x, p[1].x) + k * dia + r;
      return Math.abs(Math.hypot(x - cx, y - p[0].y) - r);
    },
  },
  {
    id: "sine_line",
    name: "Sine line",
    group: "patterns",
    icon: '<path d="M2 14c3-8 6-8 8 0s5 8 8 0s5-8 8 0"/>',
    points: 2,
    defaults: { color: "#2962ff", width: 2 },
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      // A is a peak, B the next trough: half a period apart.
      const half = b.x - a.x;
      if (Math.abs(half) < 2) return;
      const mid = (a.y + b.y) / 2,
        amp = (a.y - b.y) / 2;
      stroke(c.ctx, d.props, c.active);
      c.ctx.beginPath();
      for (let x = 0; x <= c.w; x += 2) {
        const y = mid + amp * Math.cos((Math.PI * (x - a.x)) / half);
        if (x === 0) c.ctx.moveTo(x, y);
        else c.ctx.lineTo(x, y);
      }
      c.ctx.stroke();
    },
    hit: (_c, p, _d, x, y) => {
      if (!p[1]) return Infinity;
      const half = p[1].x - p[0].x;
      if (Math.abs(half) < 2) return Infinity;
      const yy = (p[0].y + p[1].y) / 2 + ((p[0].y - p[1].y) / 2) * Math.cos((Math.PI * (x - p[0].x)) / half);
      return Math.abs(y - yy);
    },
  },
];

