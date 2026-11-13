// Volume profile for the visible range (TradingView's VRVP) and per session (SVP). Volume per price
// row for the bars in view, split into up and down volume, with the point of control (busiest row),
// the value area (rows around it holding valueArea% of the volume) and its high/low lines.
// Options follow TradingView: rows, volume (Up/Down, Total, Delta), placement, width, colours.
const DEFAULTS = {
  rows: 24,
  width: 30,
  valueArea: 70,
  volume: "Up/Down",
  style: "Bars",
  placement: "Right",
  upColor: "rgba(41,98,255,0.25)",
  downColor: "rgba(251,192,45,0.25)",
  vaUpColor: "rgba(41,98,255,0.7)",
  vaDownColor: "rgba(251,192,45,0.7)",
  pocColor: "#f44336",
  showPoc: true,
  vahColor: "#2962ff",
  showVa: false,
};

export class VolumeProfile {
  constructor(pane, params = {}) {
    this.pane = pane;
    this.p = { ...DEFAULTS, ...params };
    this._view = {
      // "normal" sits above the chart's grid lines ("bottom" is under them, which made the grid show through the profile).
      zOrder: () => "normal",
      renderer: () => ({
        draw: (target) => target.useMediaCoordinateSpace(({ context, mediaSize }) => this.draw(context, mediaSize)),
      }),
    };
  }

  attached({ series, requestUpdate }) {
    this.series = series;
    this.requestUpdate = requestUpdate;
  }
  detached() {
    this.series = null;
  }
  updateAllViews() {}
  paneViews() {
    return [this._view];
  }

  // Rows of { lo, hi, up, down } plus poc and value-area indexes.
  static profile(bars, rows, valueAreaPct) {
    let hi = -Infinity,
      lo = Infinity;
    for (const b of bars) {
      hi = Math.max(hi, b.high);
      lo = Math.min(lo, b.low);
    }
    if (!Number.isFinite(hi) || hi <= lo) return null;
    const step = (hi - lo) / rows;
    const up = new Array(rows).fill(0),
      down = new Array(rows).fill(0);
    for (const b of bars) {
      const v = b.volume || 0;
      if (!v) continue;
      const a = Math.min(rows - 1, Math.floor((b.low - lo) / step));
      const z = Math.min(rows - 1, Math.floor((b.high - lo) / step));
      const share = v / (z - a + 1);
      for (let k = a; k <= z; k++) (b.close >= b.open ? up : down)[k] += share;
    }
    const total = up.map((u, k) => u + down[k]);
    const sum = total.reduce((s, x) => s + x, 0);
    if (!sum) return null;
    let poc = 0;
    total.forEach((t, k) => {
      if (t > total[poc]) poc = k;
    });
    let inside = total[poc],
      a = poc,
      z = poc;
    while (inside < (sum * valueAreaPct) / 100 && (a > 0 || z < rows - 1)) {
      const below = a > 0 ? total[a - 1] : -1,
        above = z < rows - 1 ? total[z + 1] : -1;
      if (above >= below) inside += total[++z];
      else inside += total[--a];
    }
    return { lo, step, up, down, total, poc, vaLow: a, vaHigh: z, max: Math.max(...total), maxDelta: Math.max(...up.map((u, k) => Math.abs(u - down[k]))) };
  }

  // Draw one profile's rows from x0, growing right (dir 1) or left (dir -1), W pixels at the widest.
  // "Area" and "Line" styles: the profile as a smooth outline through each row's middle instead of separate bars.
  drawSmooth(ctx, prof, x0, W, dir) {
    const p = this.p;
    const n = prof.total.length;
    const ys = [];
    for (let k = 0; k < n; k++) {
      const y = this.series.priceToCoordinate(prof.lo + (k + 0.5) * prof.step);
      if (y == null) return;
      ys.push(y);
    }
    const zero = new Array(n).fill(0);
    const scale = (arr, max) => arr.map((v) => (v / (max || 1)) * W);
    let layers;
    if (p.volume === "Total") layers = [{ inner: zero, outer: scale(prof.total, prof.max), base: p.upColor, va: p.vaUpColor }];
    else if (p.volume === "Delta") {
      const d = prof.up.map((u, k) => u - prof.down[k]);
      layers = [
        { inner: zero, outer: scale(d.map((v) => Math.max(0, v)), prof.maxDelta), base: p.upColor, va: p.vaUpColor },
        { inner: zero, outer: scale(d.map((v) => Math.max(0, -v)), prof.maxDelta), base: p.downColor, va: p.vaDownColor },
      ];
    } else {
      const up = scale(prof.up, prof.max);
      const all = scale(prof.total, prof.max);
      layers = [
        { inner: zero, outer: up, base: p.upColor, va: p.vaUpColor },
        { inner: up, outer: all, base: p.downColor, va: p.vaDownColor },
      ];
    }
    const X = (w) => x0 + dir * w;
    const yTop = this.series.priceToCoordinate(prof.lo + (prof.vaHigh + 1) * prof.step);
    const yBot = this.series.priceToCoordinate(prof.lo + prof.vaLow * prof.step);
    for (const L of layers) {
      const outline = () => {
        ctx.beginPath();
        ctx.moveTo(X(L.outer[0]), ys[0]);
        for (let k = 1; k < n; k++) ctx.lineTo(X(L.outer[k]), ys[k]);
      };
      if (p.style === "Line") {
        outline();
        ctx.strokeStyle = L.va;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.stroke();
        continue;
      }
      const shape = () => {
        outline();
        for (let k = n - 1; k >= 0; k--) ctx.lineTo(X(L.inner[k]), ys[k]);
        ctx.closePath();
      };
      shape();
      ctx.fillStyle = L.base;
      ctx.fill();
      if (yTop != null && yBot != null) {
        // The value area is shaded stronger, like the bars version.
        ctx.save();
        ctx.beginPath();
        ctx.rect(-1e4, yTop, 2e4, yBot - yTop);
        ctx.clip();
        shape();
        ctx.fillStyle = L.va;
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawRows(ctx, prof, x0, W, dir) {
    const p = this.p;
    if (p.style === "Area" || p.style === "Line") return this.drawSmooth(ctx, prof, x0, W, dir);
    for (let k = 0; k < prof.total.length; k++) {
      const yTop = this.series.priceToCoordinate(prof.lo + (k + 1) * prof.step);
      const yBot = this.series.priceToCoordinate(prof.lo + k * prof.step);
      if (yTop == null || yBot == null) continue;
      const h = Math.max(1, yBot - yTop - (yBot - yTop > 3 ? 1 : 0));
      const inVa = k >= prof.vaLow && k <= prof.vaHigh;
      const upC = inVa ? p.vaUpColor : p.upColor,
        dnC = inVa ? p.vaDownColor : p.downColor;
      if (p.volume === "Total") {
        const tw = (prof.total[k] / prof.max) * W;
        ctx.fillStyle = upC;
        ctx.fillRect(dir > 0 ? x0 : x0 - tw, yTop, tw, h);
      } else if (p.volume === "Delta") {
        const d = prof.up[k] - prof.down[k];
        const dw = (Math.abs(d) / (prof.maxDelta || 1)) * W;
        ctx.fillStyle = d >= 0 ? upC : dnC;
        ctx.fillRect(dir > 0 ? x0 : x0 - dw, yTop, dw, h);
      } else {
        const uw = (prof.up[k] / prof.max) * W,
          dw = (prof.down[k] / prof.max) * W;
        ctx.fillStyle = upC;
        ctx.fillRect(dir > 0 ? x0 : x0 - uw, yTop, uw, h);
        ctx.fillStyle = dnC;
        ctx.fillRect(dir > 0 ? x0 + uw : x0 - uw - dw, yTop, dw, h);
      }
    }
  }

  hline(ctx, price, x1, x2, color, width = 1) {
    const y = this.series.priceToCoordinate(price);
    if (y == null) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  draw(ctx, size) {
    const pane = this.pane,
      bars = pane.shown;
    const range = pane.chart.timeScale().getVisibleLogicalRange();
    if (!bars?.length || !range || !this.series) return;
    const from = Math.max(0, Math.floor(range.from)),
      to = Math.min(bars.length - 1, Math.ceil(range.to));
    if (to <= from) return;
    const prof = VolumeProfile.profile(bars.slice(from, to + 1), Math.max(4, Math.min(2000, this.p.rows | 0)), this.p.valueArea);
    if (!prof) return;
    const W = (size.width * Math.max(5, Math.min(100, this.p.width))) / 100;
    const right = this.p.placement !== "Left";
    this.drawRows(ctx, prof, right ? size.width : 0, W, right ? -1 : 1);
    if (this.p.showPoc) this.hline(ctx, prof.lo + (prof.poc + 0.5) * prof.step, 0, size.width, this.p.pocColor, 2);
    if (this.p.showVa) {
      this.hline(ctx, prof.lo + (prof.vaHigh + 1) * prof.step, 0, size.width, this.p.vahColor);
      this.hline(ctx, prof.lo + prof.vaLow * prof.step, 0, size.width, this.p.vahColor);
    }
  }
}

// Session volume profile (TradingView's SVP): one profile per session drawn from its first bar.
// Sessions are days on intraday charts; on daily and slower charts "Auto" uses months, then years.
export class SessionVolumeProfile extends VolumeProfile {
  constructor(pane, params = {}) {
    super(pane, { period: "Auto", rows: 24, width: 70, ...params });
  }

  static periodFor(choice, tfSeconds) {
    if (choice && choice !== "Auto") return choice.toLowerCase();
    if (tfSeconds < 86400) return "day";
    if (tfSeconds < 7 * 86400) return "month";
    return "year";
  }

  static sessions(bars, period, keyOf) {
    const out = [];
    let key = null;
    bars.forEach((b, i) => {
      const k = keyOf(b.time, period);
      if (k !== key) {
        out.push({ from: i, to: i });
        key = k;
      } else out[out.length - 1].to = i;
    });
    return out;
  }

  draw(ctx) {
    const pane = this.pane,
      bars = pane.shown,
      ts = pane.chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!bars?.length || !range || !this.series || !this.keyOf) return;
    const period = SessionVolumeProfile.periodFor(this.p.period, this.tfSeconds || 86400);
    const rows = Math.max(4, Math.min(500, this.p.rows | 0));
    const spacing = ts.options().barSpacing || 6;
    for (const s of SessionVolumeProfile.sessions(bars, period, this.keyOf)) {
      if (s.to < range.from - 1 || s.from > range.to + 1) continue;
      const prof = VolumeProfile.profile(bars.slice(s.from, s.to + 1), rows, this.p.valueArea);
      const xa = ts.logicalToCoordinate(s.from),
        xz = ts.logicalToCoordinate(s.to);
      if (!prof || xa == null || xz == null) continue;
      const x0 = xa - spacing / 2,
        span = Math.max(spacing, xz - xa + spacing);
      this.drawRows(ctx, prof, x0, (span * Math.max(5, Math.min(100, this.p.width))) / 100, 1);
      if (this.p.showPoc) this.hline(ctx, prof.lo + (prof.poc + 0.5) * prof.step, x0, x0 + span, this.p.pocColor, 1.5);
      if (this.p.showVa) {
        this.hline(ctx, prof.lo + (prof.vaHigh + 1) * prof.step, x0, x0 + span, this.p.vahColor);
        this.hline(ctx, prof.lo + prof.vaLow * prof.step, x0, x0 + span, this.p.vahColor);
      }
    }
  }
}
