// Forecasting and measurement: long and short position, price range, date range, date and price range.
import type { Drawing, Pt, RenderCtx, ToolDef, XY } from "../types";
import { inRect, label, line, pct, signed, stroke, withAlpha } from "../geom";

// Anchors: [entry (left edge), target (right edge), stop (right edge)].
function position(dir: 1 | -1): ToolDef {
  return {
    id: dir > 0 ? "long_position" : "short_position",
    name: dir > 0 ? "Long position" : "Short position",
    group: "forecast",
    icon:
      dir > 0
        ? '<rect x="5" y="5" width="18" height="9" fill="currentColor" fill-opacity=".25"/><rect x="5" y="14" width="18" height="8" fill="currentColor" fill-opacity=".1"/><path d="M5 14h18"/>'
        : '<rect x="5" y="6" width="18" height="8" fill="currentColor" fill-opacity=".1"/><rect x="5" y="14" width="18" height="9" fill="currentColor" fill-opacity=".25"/><path d="M5 14h18"/>',
    points: 3,
    defaults: { color: "#787b86", width: 1, qty: 1, accountSize: 100000, risk: 1 },
    fields: [
      { key: "targetColor", label: "Profit background", type: "color" },
      { key: "stopColor", label: "Stop background", type: "color" },
      { key: "accountSize", label: "Account size", type: "number", min: 0 },
      { key: "risk", label: "Risk %", type: "number", min: 0, step: 0.1 },
      { key: "showLabels", label: "Labels", type: "bool" },
    ],
    init: (e, bar) => [e, { time: e.time + 20 * bar, price: e.price * (1 + dir * 0.03) }, { time: e.time + 20 * bar, price: e.price * (1 - dir * 0.015) }],
    constrain: (pts, moved) => {
      const [e, t, s] = pts.map((p) => ({ ...p }));
      if (moved === 1) s.time = t.time;
      if (moved === 2) t.time = s.time;
      // target stays on the profit side and stop on the loss side of entry
      if ((t.price - e.price) * dir < 0) t.price = e.price;
      if ((s.price - e.price) * dir > 0) s.price = e.price;
      return [e, t, s];
    },
    draw: (c, p, d) => {
      const [e, t, s] = p;
      if (!t || !s) return;
      const [pe, pt, ps] = d.points;
      const x1 = Math.min(e.x, t.x),
        w = Math.max(4, Math.abs(t.x - e.x));
      c.ctx.fillStyle = d.props.targetColor;
      c.ctx.fillRect(x1, Math.min(e.y, t.y), w, Math.abs(t.y - e.y));
      c.ctx.fillStyle = d.props.stopColor;
      c.ctx.fillRect(x1, Math.min(e.y, s.y), w, Math.abs(s.y - e.y));
      stroke(c.ctx, d.props, false);
      line(c.ctx, { x: x1, y: e.y }, { x: x1 + w, y: e.y });
      if (!d.props.showLabels) return;
      const reward = Math.abs(pt.price - pe.price),
        risk = Math.abs(pe.price - ps.price);
      const acct = Number(d.props.accountSize) || 0,
        riskPct = Number(d.props.risk) || 0;
      const qty = risk ? Math.floor((acct * riskPct) / 100 / risk) : 0;
      const cx = x1 + w / 2;
      const f = "11px Inter, sans-serif";
      label(c.ctx, `Target: ${c.fmtPrice(pt.price)} (${pct(pe.price, pt.price).toFixed(2)}%) ${c.fmtPrice(reward)}${qty ? `, Amount: ${c.fmtPrice(reward * qty)}` : ""}`, cx, t.y + (t.y < e.y ? -12 : 12), {
        align: "center",
        color: "#fff",
        bg: "rgba(8,153,129,0.9)",
        font: f,
      });
      label(c.ctx, `Stop: ${c.fmtPrice(ps.price)} (${pct(pe.price, ps.price).toFixed(2)}%) ${c.fmtPrice(risk)}${qty ? `, Amount: ${c.fmtPrice(risk * qty)}` : ""}`, cx, s.y + (s.y > e.y ? 12 : -12), {
        align: "center",
        color: "#fff",
        bg: "rgba(242,54,69,0.9)",
        font: f,
      });
      label(c.ctx, `Risk/reward ratio: ${risk ? (reward / risk).toFixed(2) : "—"}${qty ? `\nQty: ${qty}` : ""}`, cx, e.y + (dir > 0 ? 16 : -16), {
        align: "center",
        color: "#fff",
        bg: withAlpha(d.props.color, 0.9),
        font: f,
      });
    },
    hit: (_c, p, _d, x, y) => {
      const [e, t, s] = p;
      if (!t || !s) return Infinity;
      return inRect({ x, y }, { x: e.x, y: t.y }, { x: t.x, y: s.y }) ? 2 : Infinity;
    },
  };
}

function rangeBox(c: RenderCtx, a: XY, b: XY, d: Drawing, up: boolean) {
  const col = up ? "#2962ff" : "#f23645";
  c.ctx.fillStyle = withAlpha(col, 0.15);
  c.ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  return col;
}

function arrowLine(c: RenderCtx, from: XY, to: XY, color: string) {
  c.ctx.save();
  c.ctx.strokeStyle = color;
  c.ctx.fillStyle = color;
  c.ctx.lineWidth = 1;
  c.ctx.setLineDash([]);
  line(c.ctx, from, to);
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  c.ctx.beginPath();
  c.ctx.moveTo(to.x, to.y);
  c.ctx.lineTo(to.x - 7 * Math.cos(ang - 0.4), to.y - 7 * Math.sin(ang - 0.4));
  c.ctx.lineTo(to.x - 7 * Math.cos(ang + 0.4), to.y - 7 * Math.sin(ang + 0.4));
  c.ctx.fill();
  c.ctx.restore();
}

const boxHit = (_c: RenderCtx, p: XY[], _d: Drawing, x: number, y: number) => (p[1] && inRect({ x, y }, p[0], p[1]) ? 2 : Infinity);

function rangeText(c: RenderCtx, a: Pt, b: Pt, what: { price?: boolean; date?: boolean }) {
  const parts: string[] = [];
  if (what.price) {
    const diff = b.price - a.price;
    parts.push(`${signed(diff, c.fmtPrice(diff))} (${signed(diff, pct(a.price, b.price).toFixed(2))}%)`);
  }
  if (what.date) {
    const bars = c.barsBetween(a.time, b.time);
    const secs = Math.abs(b.time - a.time);
    const span = secs >= 86400 ? `${Math.round(secs / 86400)}d` : secs >= 3600 ? `${Math.floor(secs / 3600)}h ${Math.round((secs % 3600) / 60)}m` : `${Math.round(secs / 60)}m`;
    parts.push(`${bars} bars, ${span}`);
  }
  const vol = c.volumeBetween(a.time, b.time);
  if (vol != null && what.date) parts.push(`Vol ${vol >= 1e6 ? (vol / 1e6).toFixed(2) + "M" : vol >= 1e3 ? (vol / 1e3).toFixed(1) + "K" : vol.toFixed(0)}`);
  return parts.join("\n");
}

export const FORECAST_TOOLS: ToolDef[] = [
  position(1),
  position(-1),
  {
    id: "price_range",
    name: "Price range",
    group: "forecast",
    icon: '<path d="M14 4v20M9 8l5-4 5 4M9 20l5 4 5-4M5 4h18M5 24h18"/>',
    points: 2,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const up = d.points[1].price >= d.points[0].price;
      const col = rangeBox(c, a, b, d, up);
      const cx = (a.x + b.x) / 2;
      arrowLine(c, { x: cx, y: a.y }, { x: cx, y: b.y }, col);
      label(c.ctx, rangeText(c, d.points[0], d.points[1], { price: true }), cx, b.y + (up ? -16 : 16), { align: "center", color: "#fff", bg: col, font: "11px Inter, sans-serif" });
    },
    hit: boxHit,
  },
  {
    id: "date_range",
    name: "Date range",
    group: "forecast",
    icon: '<path d="M4 14h20M8 9l-4 5 4 5M20 9l4 5-4 5M4 5v18M24 5v18"/>',
    points: 2,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const fwd = d.points[1].time >= d.points[0].time;
      const col = rangeBox(c, a, b, d, fwd);
      const cy = (a.y + b.y) / 2;
      arrowLine(c, { x: a.x, y: cy }, { x: b.x, y: cy }, col);
      label(c.ctx, rangeText(c, d.points[0], d.points[1], { date: true }), (a.x + b.x) / 2, Math.max(a.y, b.y) + 18, { align: "center", color: "#fff", bg: col, font: "11px Inter, sans-serif" });
    },
    hit: boxHit,
  },
  {
    id: "date_price_range",
    name: "Date and price range",
    group: "forecast",
    icon: '<rect x="5" y="5" width="18" height="18"/><path d="M14 5v18M5 14h18"/>',
    points: 2,
    draw: (c, p, d) => {
      const [a, b] = p;
      if (!b) return;
      const up = d.points[1].price >= d.points[0].price;
      const col = rangeBox(c, a, b, d, up);
      arrowLine(c, { x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }, col);
      arrowLine(c, { x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }, col);
      label(c.ctx, rangeText(c, d.points[0], d.points[1], { price: true, date: true }), (a.x + b.x) / 2, b.y + (up ? -24 : 24), { align: "center", color: "#fff", bg: col, font: "11px Inter, sans-serif" });
    },
    hit: boxHit,
  },
];
