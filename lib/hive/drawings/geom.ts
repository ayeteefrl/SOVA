// Canvas helpers shared by every drawing tool.
import type { DrawingProps, RenderCtx, XY } from "./types";

export const FAR = 1e5;

export function stroke(ctx: CanvasRenderingContext2D, p: DrawingProps, active = false) {
  ctx.strokeStyle = p.color;
  ctx.lineWidth = Math.max(1, p.width) + (active ? 0.5 : 0);
  ctx.setLineDash(p.style === 1 ? [6, 4] : p.style === 2 ? [2, 3] : []);
  ctx.lineCap = "round";
}

export function line(ctx: CanvasRenderingContext2D, a: XY, b: XY) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function poly(ctx: CanvasRenderingContext2D, pts: XY[], close = false) {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  if (close) ctx.closePath();
}

// The segment a->b extended past a and/or b to the edge of the world.
export function extended(a: XY, b: XY, left: boolean, right: boolean): [XY, XY] {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy);
  if (!len) return [a, b];
  const ux = dx / len,
    uy = dy / len;
  return [left ? { x: a.x - ux * FAR, y: a.y - uy * FAR } : a, right ? { x: b.x + ux * FAR, y: b.y + uy * FAR } : b];
}

export function distToSeg(p: XY, a: XY, b: XY) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToPoly(p: XY, pts: XY[], close = false) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, distToSeg(p, pts[i], pts[i + 1]));
  if (close && pts.length > 2) best = Math.min(best, distToSeg(p, pts[pts.length - 1], pts[0]));
  return best;
}

export function inRect(p: XY, a: XY, b: XY, pad = 0) {
  return (
    p.x >= Math.min(a.x, b.x) - pad &&
    p.x <= Math.max(a.x, b.x) + pad &&
    p.y >= Math.min(a.y, b.y) - pad &&
    p.y <= Math.max(a.y, b.y) + pad
  );
}

export function font(p: Pick<DrawingProps, "fontSize" | "bold" | "italic">, size = p.fontSize) {
  return `${p.italic ? "italic " : ""}${p.bold ? "600 " : ""}${size}px Inter, system-ui, sans-serif`;
}

// A text label, optionally on a rounded background. Returns its box.
export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { align?: CanvasTextAlign; base?: CanvasTextBaseline; color?: string; bg?: string; font?: string; pad?: number } = {},
) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.font = opts.font || "12px Inter, system-ui, sans-serif";
  ctx.textAlign = opts.align || "left";
  ctx.textBaseline = opts.base || "middle";
  const lines = text.split("\n");
  const lh = parseInt(ctx.font.match(/(\d+)px/)?.[1] || "12") * 1.3;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const h = lh * lines.length;
  const pad = opts.pad ?? 5;
  const left = opts.align === "center" ? x - w / 2 : opts.align === "right" ? x - w : x;
  const top = opts.base === "top" ? y : opts.base === "bottom" ? y - h : y - h / 2;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    roundRect(ctx, left - pad, top - pad / 2, w + pad * 2, h + pad, 3);
    ctx.fill();
  }
  ctx.fillStyle = opts.color || "#d1d4dc";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, x, top + lh * i + lh / 2));
  ctx.restore();
  return { x: left - pad, y: top - pad / 2, w: w + pad * 2, h: h + pad };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function withAlpha(color: string, alpha: number) {
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4 ? color.slice(1).split("").map((c) => c + c).join("") : color.slice(1);
    const n = parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (m) {
    const [r, g, b] = m[1].split(",").map((s) => s.trim());
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

export function handle(c: RenderCtx, p: XY, color: string) {
  const { ctx } = c;
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = "#131722";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export const pct = (a: number, b: number) => ((b - a) / a) * 100;
export const signed = (v: number, s: string) => `${v >= 0 ? "+" : ""}${s}`;
