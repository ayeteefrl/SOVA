// Everything an indicator draws besides its lines: fills between outputs or levels, background
// colour per bar, boxes, line segments, labels and a table. One primitive per indicator, attached to
// a series in that indicator's pane so prices map to the right scale.
import type { IChartApi, ISeriesApi, SeriesType, SeriesAttachedParameter, Time, IPrimitivePaneView } from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { FillDef, IndicatorResult, Table } from "../indicators/types";

export type OverlayHost = {
  chart: IChartApi;
  logicalOf: (utc: number) => number | null;
  barCount: () => number;
  fmt: (v: number) => string;
};

type Resolved = { fill: FillDef; a: number[] | number; b: number[] | number };

export class IndicatorOverlay {
  private series: ISeriesApi<SeriesType> | null = null;
  private view: IPrimitivePaneView;
  private bgView: IPrimitivePaneView;

  constructor(
    private host: OverlayHost,
    private res: IndicatorResult,
    private fills: Resolved[],
    private drawBg: boolean,
  ) {
    const fg = { draw: (t: CanvasRenderingTarget2D) => t.useMediaCoordinateSpace(({ context, mediaSize }) => this.draw(context, mediaSize.width, mediaSize.height)) };
    const bg = { draw: (t: CanvasRenderingTarget2D) => t.useMediaCoordinateSpace(({ context, mediaSize }) => this.drawBackground(context, mediaSize.width, mediaSize.height)) };
    this.view = { zOrder: () => "normal", renderer: () => fg };
    this.bgView = { zOrder: () => "bottom", renderer: () => bg };
  }

  // A fill is on unless hidden by default; the user's settings (visible, colour) override that.
  static resolveFills(fills: FillDef[] | undefined, res: IndicatorResult, overrides: Record<string, { visible?: boolean; color?: string; upColor?: string; downColor?: string }> = {}): Resolved[] {
    const val = (ref: string) => (ref.startsWith("level:") ? Number(ref.slice(6)) : (res[ref] as number[] | undefined));
    return (fills || [])
      .filter((f) => overrides[f.id]?.visible ?? !f.hiddenByDefault)
      .map((f) => {
        const o = overrides[f.id];
        let fill = f;
        if (f.upColor && f.downColor) {
          // Two-sided fills (the Ichimoku cloud: green above, red below) keep both colours; each is set on its own.
          if (o?.upColor || o?.downColor) fill = { ...f, upColor: o.upColor ?? f.upColor, downColor: o.downColor ?? f.downColor };
        } else if (o?.color) fill = { ...f, color: o.color, upColor: undefined, downColor: undefined, gradient: undefined };
        return { fill, a: val(f.from), b: val(f.to) };
      })
      .filter((r): r is Resolved => r.a != null && r.b != null);
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.series = p.series as ISeriesApi<SeriesType>;
  }
  detached() {
    this.series = null;
  }
  updateAllViews() {}
  paneViews() {
    return this.drawBg ? [this.bgView, this.view] : [this.view];
  }

  private xOf(i: number): number | null {
    return this.host.chart.timeScale().logicalToCoordinate(i as never);
  }
  private yOf(v: number): number | null {
    return Number.isFinite(v) ? this.series?.priceToCoordinate(v) ?? null : null;
  }
  private range() {
    const r = this.host.chart.timeScale().getVisibleLogicalRange();
    if (!r) return null;
    return { from: Math.max(0, Math.floor(r.from) - 1), to: Math.ceil(r.to) + 1 };
  }

  private drawBackground(ctx: CanvasRenderingContext2D, _w: number, h: number) {
    const bg = this.res.bg;
    const r = this.range();
    if (!bg || !r) return;
    const spacing = this.host.chart.timeScale().options().barSpacing;
    for (let i = r.from; i <= Math.min(r.to, bg.length - 1); i++) {
      const c = bg[i];
      const x = this.xOf(i);
      if (!c || x == null) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x - spacing / 2, 0, spacing + 0.5, h);
    }
  }

  private draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.series) return;
    const r = this.range();
    if (r) for (const f of this.fills) this.drawFill(ctx, f, r, h);
    for (const b of this.res.boxes || []) {
      const l1 = this.host.logicalOf(b.t1),
        l2 = this.host.logicalOf(b.t2);
      const x1 = l1 == null ? null : this.xOf(l1);
      const x2 = b.extendRight ? w : l2 == null ? null : this.xOf(l2);
      const y1 = this.yOf(b.top),
        y2 = this.yOf(b.bottom);
      if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      if (b.border) {
        ctx.strokeStyle = b.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }
      if (b.text) {
        ctx.fillStyle = b.textColor || "#d1d4dc";
        ctx.font = "11px Inter, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(b.text, x1 + 4, (y1 + y2) / 2);
      }
    }
    for (const s of this.res.segments || []) {
      const l1 = this.host.logicalOf(s.t1),
        l2 = this.host.logicalOf(s.t2);
      if (l1 == null || l2 == null) continue;
      let x1 = this.xOf(l1),
        x2 = this.xOf(l2);
      let y1 = this.yOf(s.p1),
        y2 = this.yOf(s.p2);
      if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
      if (s.extendRight && x2 !== x1) {
        const k = (y2 - y1) / (x2 - x1);
        y2 = y2 + k * (w - x2);
        x2 = w;
      }
      if (s.extendLeft && x2 !== x1) {
        const k = (y2 - y1) / (x2 - x1);
        y1 = y1 - k * x1;
        x1 = 0;
      }
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width || 1;
      ctx.setLineDash(s.style === 1 ? [6, 4] : s.style === 2 ? [2, 3] : []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (s.label) {
        ctx.fillStyle = s.color;
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(s.label, Math.min(w - 4, x2), y2 - 2);
        ctx.textAlign = "left";
      }
    }
    for (const l of this.res.labels || []) {
      const li = this.host.logicalOf(l.time);
      const x = li == null ? null : this.xOf(li);
      const y = this.yOf(l.price);
      if (x == null || y == null) continue;
      ctx.font = `${l.size || 11}px Inter, sans-serif`;
      const tw = ctx.measureText(l.text).width + 10;
      const bh = (l.size || 11) + 8;
      const top = l.position === "above" ? y - bh - 6 : l.position === "below" ? y + 6 : y - bh / 2;
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.roundRect(x - tw / 2, top, tw, bh, 3);
      ctx.fill();
      ctx.fillStyle = l.textColor || "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(l.text, x, top + bh / 2);
      ctx.textAlign = "left";
    }
    if (this.res.table) this.drawTable(ctx, this.res.table, w, h);
  }

  private drawFill(ctx: CanvasRenderingContext2D, r: Resolved, range: { from: number; to: number }, h: number) {
    const { fill } = r;
    const n = Math.max(Array.isArray(r.a) ? r.a.length : 0, Array.isArray(r.b) ? r.b.length : 0, this.host.barCount());
    const at = (v: number[] | number, i: number) => (Array.isArray(v) ? v[i] : v);
    let grad: CanvasGradient | null = null;
    if (fill.gradient) {
      const yt = this.yOf(fill.gradient.top),
        yb = this.yOf(fill.gradient.bottom);
      if (yt != null && yb != null) {
        grad = ctx.createLinearGradient(0, yt, 0, yb);
        grad.addColorStop(0, fill.gradient.topColor);
        grad.addColorStop(1, fill.gradient.bottomColor);
      }
    }
    for (let i = range.from; i < Math.min(range.to, n - 1); i++) {
      let a0 = at(r.a, i),
        a1 = at(r.a, i + 1),
        b0 = at(r.b, i),
        b1 = at(r.b, i + 1);
      if (![a0, a1, b0, b1].every(Number.isFinite)) continue;
      if (fill.clip === "above") {
        if (a0 <= b0 && a1 <= b1) continue;
        a0 = Math.max(a0, b0);
        a1 = Math.max(a1, b1);
      } else if (fill.clip === "below") {
        if (a0 >= b0 && a1 >= b1) continue;
        a0 = Math.min(a0, b0);
        a1 = Math.min(a1, b1);
      }
      const x0 = this.xOf(i),
        x1 = this.xOf(i + 1);
      const ya0 = this.yOf(a0),
        ya1 = this.yOf(a1),
        yb0 = this.yOf(b0),
        yb1 = this.yOf(b1);
      if (x0 == null || x1 == null || ya0 == null || ya1 == null || yb0 == null || yb1 == null) continue;
      ctx.fillStyle = grad || (fill.upColor && fill.downColor ? (a0 + a1 >= b0 + b1 ? fill.upColor : fill.downColor) : fill.color || "rgba(41,98,255,0.1)");
      ctx.beginPath();
      ctx.moveTo(x0, ya0);
      ctx.lineTo(x1, ya1);
      ctx.lineTo(x1, yb1);
      ctx.lineTo(x0, yb0);
      ctx.closePath();
      ctx.fill();
    }
    void h;
  }

  private drawTable(ctx: CanvasRenderingContext2D, t: Table, w: number, h: number) {
    const size = t.size || 11;
    ctx.font = `${size}px Inter, sans-serif`;
    const cols = Math.max(...t.rows.map((r) => r.length));
    const cell = (c: Table["rows"][number][number]) => (typeof c === "string" ? { text: c } : c);
    const widths = Array.from({ length: cols }, (_, j) => Math.max(...t.rows.map((r) => (r[j] ? ctx.measureText(cell(r[j]).text).width : 0))) + 14);
    const rh = size + 10;
    const tw = widths.reduce((a, b) => a + b, 0),
      th = rh * t.rows.length;
    const x0 = t.position.endsWith("left") ? 8 : w - tw - 64;
    const y0 = t.position.startsWith("top") ? 8 : t.position.startsWith("middle") ? (h - th) / 2 : h - th - 8;
    ctx.fillStyle = "rgba(19,23,34,0.85)";
    ctx.fillRect(x0, y0, tw, th);
    t.rows.forEach((row, i) => {
      let x = x0;
      row.forEach((c, j) => {
        const cc = cell(c);
        if (cc.bg) {
          ctx.fillStyle = cc.bg;
          ctx.fillRect(x, y0 + i * rh, widths[j], rh);
        }
        ctx.fillStyle = cc.color || "#d1d4dc";
        ctx.textBaseline = "middle";
        ctx.fillText(cc.text, x + 7, y0 + i * rh + rh / 2);
        x += widths[j];
      });
    });
    ctx.strokeStyle = "rgba(120,123,134,0.35)";
    ctx.strokeRect(x0, y0, tw, th);
  }
}
