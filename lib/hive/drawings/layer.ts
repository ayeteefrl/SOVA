// Draws every drawing on the price pane (a Lightweight Charts series primitive) and answers
// "which drawing / which anchor is under the mouse".
import type { ISeriesApi, SeriesType, IPrimitivePaneView, IPrimitivePaneRenderer, SeriesAttachedParameter, Time } from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { Drawing, Pt, RenderCtx, XY } from "./types";
import { TOOL_BY_ID } from "./registry";
import { distToSeg, handle } from "./geom";

export type LayerHost = {
  toXY: (p: Pt) => XY | null;
  toPt: (xy: XY) => Pt | null;
  fmtPrice: (v: number) => string;
  fmtTime: (t: number) => string;
  barsBetween: (a: number, b: number) => number;
  volumeBetween: (a: number, b: number) => number | null;
  bars: () => RenderCtx["bars"];
  indexOf: RenderCtx["indexOf"];
  timeAt: RenderCtx["timeAt"];
  xAt: RenderCtx["xAt"];
  yAt: RenderCtx["yAt"];
  priceAt: RenderCtx["priceAt"];
  tf: () => string;
};

export class DrawingLayer {
  items: Drawing[] = [];
  temp: Drawing | null = null;
  selectedId: string | null = null;
  hoverId: string | null = null;
  hideAll = false;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private size = { w: 0, h: 0 };
  private view: IPrimitivePaneView;

  constructor(private host: LayerHost) {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target: CanvasRenderingTarget2D) =>
        target.useMediaCoordinateSpace(({ context, mediaSize }) => this.draw(context, mediaSize.width, mediaSize.height)),
    };
    this.view = { zOrder: () => "top", renderer: () => renderer };
  }

  // ISeriesPrimitive
  attached(p: SeriesAttachedParameter<Time>) {
    this.series = p.series as ISeriesApi<SeriesType>;
    this.requestUpdate = p.requestUpdate;
  }
  detached() {
    this.series = null;
  }
  updateAllViews() {}
  paneViews() {
    return [this.view];
  }
  update() {
    this.requestUpdate?.();
  }

  get selected() {
    return this.items.find((d) => d.id === this.selectedId) || null;
  }

  private visible(d: Drawing) {
    return !d.hidden && !this.hideAll && !(d.hideOn || []).includes(this.host.tf());
  }

  private ctx(context: CanvasRenderingContext2D, active: boolean): RenderCtx {
    const h = this.host;
    return {
      ctx: context,
      w: this.size.w,
      h: this.size.h,
      toXY: h.toXY,
      toPt: h.toPt,
      fmtPrice: h.fmtPrice,
      fmtTime: h.fmtTime,
      barsBetween: h.barsBetween,
      volumeBetween: h.volumeBetween,
      bars: h.bars(),
      indexOf: h.indexOf,
      timeAt: h.timeAt,
      xAt: h.xAt,
      yAt: h.yAt,
      priceAt: h.priceAt,
      active,
    };
  }

  private project(d: Drawing) {
    const pts = d.points.map((p) => this.host.toXY(p));
    return pts.every(Boolean) ? (pts as XY[]) : null;
  }

  private draw(context: CanvasRenderingContext2D, w: number, h: number) {
    this.size = { w, h };
    if (!this.series) return;
    const all = [...this.items, ...(this.temp ? [this.temp] : [])];
    for (const d of all) {
      if (!this.visible(d) && d !== this.temp) continue;
      const def = TOOL_BY_ID[d.tool];
      const pts = this.project(d);
      if (!def || !pts) continue;
      const active = d.id === this.selectedId || d === this.temp;
      context.save();
      try {
        def.draw(this.ctx(context, active), pts, d);
      } catch {
        /* a half-placed drawing can be off-screen */
      }
      context.restore();
      // Freehand strokes have hundreds of points; only their ends get handles.
      const shown = def.points === 0 ? [pts[0], pts[pts.length - 1]] : pts;
      if ((active || d.id === this.hoverId) && d !== this.temp) for (const p of shown) handle(this.ctx(context, true), p, d.props.color);
      else if (d === this.temp && def.points !== 0) for (const p of pts) handle(this.ctx(context, true), p, d.props.color);
    }
  }

  // Nearest drawing within `tol` pixels, topmost first.
  hitTest(x: number, y: number, tol = 6): Drawing | null {
    let best: Drawing | null = null,
      bestD = tol;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const d = this.items[i];
      if (!this.visible(d)) continue;
      const def = TOOL_BY_ID[d.tool];
      const pts = this.project(d);
      if (!def || !pts) continue;
      let dist: number;
      if (def.hit) dist = def.hit(this.ctx(null as unknown as CanvasRenderingContext2D, false), pts, d, x, y);
      else {
        dist = Infinity;
        for (let k = 0; k + 1 < pts.length; k++) dist = Math.min(dist, distToSeg({ x, y }, pts[k], pts[k + 1]));
      }
      // An anchor always grabs its drawing, even where the shape doesn't pass through it (ellipse corners).
      if (def.points !== 0) for (const p of pts) dist = Math.min(dist, Math.hypot(p.x - x, p.y - y));
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  // Index of the anchor of drawing `d` under (x, y), or -1.
  anchorAt(d: Drawing, x: number, y: number, tol = 8) {
    if (TOOL_BY_ID[d.tool]?.points === 0) return -1; // freehand: move only
    const pts = this.project(d);
    if (!pts) return -1;
    let idx = -1,
      bestD = tol;
    pts.forEach((p, i) => {
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < bestD) {
        bestD = dist;
        idx = i;
      }
    });
    return idx;
  }
}
