'use client';

import { useEffect, useRef, useCallback } from 'react';

/* ─── Types ────────────────────────────────────────────────────── */
interface FallingObj {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angleVel: number;
  symbol: string;
  color: string;
  type: 'note' | 'chip';
  size: number;
  opacity: number;
  catchFlash: number;
  big: boolean;
}

interface Jar {
  x: number;
  targetX: number;
  label: string;
  prevLabel: string;
  labelAlpha: number;
  prevLabelAlpha: number;
  catchPulse: number;
}

/* ─── Data ─────────────────────────────────────────────────────── */
const NOTES = [
  { symbol: '₹', color: '#D4AF37' },
  { symbol: '$', color: '#4edea3' },
  { symbol: '€', color: '#adc6ff' },
  { symbol: '£', color: '#c084fc' },
  { symbol: '¥', color: '#fb923c' },
];

const CHIPS = [
  { symbol: 'EQ', color: '#4d8eff' },
  { symbol: 'MF', color: '#4edea3' },
  { symbol: '₿',  color: '#F7931A' },
  { symbol: 'Au', color: '#D4AF37' },
  { symbol: 'ETF', color: '#c084fc' },
];

const CATCH_LABELS = ['Equity', 'Mutual Funds', 'Crypto', 'Bonds', 'Gold', 'Forex', 'ETF'];

// Total 7 objects: ids 0-3 are big notes, ids 4-6 are small chips
const BIG_COUNT   = 4;
const SMALL_COUNT = 3;
const TOTAL       = BIG_COUNT + SMALL_COUNT;

/* ─── Helpers ──────────────────────────────────────────────────── */
function makeObj(id: number, width: number, stagger = false): FallingObj {
  const isBig = id < BIG_COUNT;
  const src = isBig
    ? NOTES[Math.floor(Math.random() * NOTES.length)]
    : CHIPS[Math.floor(Math.random() * CHIPS.length)];

  return {
    id,
    big: isBig,
    x: 80 + Math.random() * (width - 160),
    y: stagger ? -(Math.random() * 1000) : -(60 + Math.random() * 120),
    vx: (Math.random() - 0.5) * 0.12,
    vy: isBig
      ? 0.025 + Math.random() * 0.03   // big: very slow drift
      : 0.02  + Math.random() * 0.025, // small: similar gentle pace
    angle: Math.random() * Math.PI * 2,
    angleVel: (Math.random() - 0.5) * (isBig ? 0.003 : 0.005),
    symbol: src.symbol,
    color: src.color,
    type: isBig ? 'note' : 'chip',
    size: isBig
      ? 80 + Math.random() * 20   // big notes: 80-100px wide
      : 18 + Math.random() * 10,  // small chips: 18-28px radius (more visible)
    opacity: isBig
      ? 0.52 + Math.random() * 0.22
      : 0.38 + Math.random() * 0.22,
    catchFlash: 0,
  };
}

function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawNote(ctx: CanvasRenderingContext2D, obj: FallingObj) {
  const w = obj.size;
  const h = w * 0.46;
  ctx.save();
  ctx.globalAlpha = obj.opacity * (1 - obj.catchFlash * 0.85);
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.angle);
  rRect(ctx, -w / 2, -h / 2, w, h, 4);
  ctx.fillStyle = 'rgba(10,16,32,0.84)';
  ctx.fill();
  ctx.strokeStyle = obj.color + '50';
  ctx.lineWidth = 1;
  ctx.stroke();
  rRect(ctx, -w / 2, -h / 2, 3, h, 2);
  ctx.fillStyle = obj.color + 'cc';
  ctx.fill();
  ctx.fillStyle = obj.color;
  ctx.font = `bold ${h * 0.65}px Manrope, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(obj.symbol, w * 0.06, 0);
  ctx.restore();
}

function drawChip(ctx: CanvasRenderingContext2D, obj: FallingObj) {
  const r = obj.size;
  ctx.save();
  ctx.globalAlpha = obj.opacity * (1 - obj.catchFlash * 0.85);
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.angle * 0.3);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
  g.addColorStop(0, obj.color + 'cc');
  g.addColorStop(1, obj.color + '44');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = obj.color + '88';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${r * 0.68}px Manrope, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(obj.symbol, 0, 0);
  ctx.restore();
}

function drawMasonJar(ctx: CanvasRenderingContext2D, jar: Jar, cw: number, ch: number) {
  const jx = jar.x;
  const baseY = ch - 22;

  const bodyW    = 70;
  const bodyH    = 68;
  const shoulderH = 18;
  const neckW    = 40;
  const neckH    = 20;
  const rimW     = 46;
  const rimH     = 10;

  const bodyTopY = baseY - bodyH;
  const shTopY   = bodyTopY - shoulderH;
  const neckTopY = shTopY - neckH;
  const rimTopY  = neckTopY - rimH;

  ctx.save();
  ctx.translate(jx, 0);

  // Base
  const baseW2 = bodyW + 8;
  rRect(ctx, -baseW2 / 2, baseY - 7, baseW2, 7, 3);
  const bg = ctx.createLinearGradient(-baseW2 / 2, 0, baseW2 / 2, 0);
  bg.addColorStop(0, 'rgba(8,15,40,0.95)');
  bg.addColorStop(0.4, 'rgba(77,142,255,0.22)');
  bg.addColorStop(0.6, 'rgba(77,142,255,0.18)');
  bg.addColorStop(1, 'rgba(8,15,40,0.95)');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = `rgba(173,198,255,${0.2 + jar.catchPulse * 0.2})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Body
  const bTopW = bodyW - 6;
  ctx.beginPath();
  ctx.moveTo(-bodyW / 2, baseY - 7);
  ctx.lineTo(-bodyW / 2, bodyTopY + 5);
  ctx.quadraticCurveTo(-bodyW / 2, bodyTopY, -bTopW / 2, bodyTopY);
  ctx.lineTo(bTopW / 2, bodyTopY);
  ctx.quadraticCurveTo(bodyW / 2, bodyTopY, bodyW / 2, bodyTopY + 5);
  ctx.lineTo(bodyW / 2, baseY - 7);
  ctx.closePath();

  const bodyG = ctx.createLinearGradient(-bodyW / 2, 0, bodyW / 2, 0);
  bodyG.addColorStop(0,    'rgba(5,12,30,0.95)');
  bodyG.addColorStop(0.08, 'rgba(15,35,80,0.82)');
  bodyG.addColorStop(0.45, 'rgba(40,90,160,0.11)');
  bodyG.addColorStop(0.92, 'rgba(15,35,80,0.78)');
  bodyG.addColorStop(1,    'rgba(5,12,30,0.95)');
  ctx.fillStyle = bodyG;
  ctx.fill();
  ctx.strokeStyle = `rgba(100,162,255,${0.28 + jar.catchPulse * 0.28})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Shine
  ctx.beginPath();
  ctx.moveTo(-bodyW / 2 + 9, bodyTopY + 8);
  ctx.lineTo(-bodyW / 2 + 9, baseY - 22);
  ctx.strokeStyle = 'rgba(200,225,255,0.16)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-bodyW / 2 + 13, bodyTopY + 13, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();

  // Shoulder
  ctx.beginPath();
  ctx.moveTo(-bTopW / 2 + 1, bodyTopY);
  ctx.bezierCurveTo(-bTopW / 2 + 1, bodyTopY - 8, -neckW / 2, shTopY + 6, -neckW / 2, shTopY);
  ctx.lineTo(neckW / 2, shTopY);
  ctx.bezierCurveTo(neckW / 2, shTopY + 6, bTopW / 2 - 1, bodyTopY - 8, bTopW / 2 - 1, bodyTopY);
  ctx.closePath();

  const shG = ctx.createLinearGradient(-bodyW / 2, 0, bodyW / 2, 0);
  shG.addColorStop(0,   'rgba(5,12,30,0.92)');
  shG.addColorStop(0.5, 'rgba(40,90,160,0.14)');
  shG.addColorStop(1,   'rgba(5,12,30,0.92)');
  ctx.fillStyle = shG;
  ctx.fill();
  ctx.strokeStyle = `rgba(100,162,255,${0.2 + jar.catchPulse * 0.22})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Neck
  ctx.beginPath();
  ctx.rect(-neckW / 2, neckTopY, neckW, neckH);
  const nG = ctx.createLinearGradient(-neckW / 2, 0, neckW / 2, 0);
  nG.addColorStop(0,   'rgba(5,12,30,0.97)');
  nG.addColorStop(0.5, 'rgba(40,90,160,0.2)');
  nG.addColorStop(1,   'rgba(5,12,30,0.97)');
  ctx.fillStyle = nG;
  ctx.fill();
  ctx.strokeStyle = `rgba(100,162,255,${0.18 + jar.catchPulse * 0.2})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Thread rings
  for (let i = 0; i < 4; i++) {
    const ty = shTopY - 3 - i * 4.5;
    ctx.beginPath();
    ctx.moveTo(-neckW / 2 - 1, ty);
    ctx.lineTo(neckW / 2 + 1, ty);
    ctx.strokeStyle = 'rgba(173,198,255,0.13)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Rim
  rRect(ctx, -rimW / 2, rimTopY, rimW, rimH, 3);
  const rimG = ctx.createLinearGradient(-rimW / 2, 0, rimW / 2, 0);
  rimG.addColorStop(0,    `rgba(20,45,100,${0.9 + jar.catchPulse * 0.08})`);
  rimG.addColorStop(0.35, `rgba(77,142,255,${0.38 + jar.catchPulse * 0.22})`);
  rimG.addColorStop(0.65, `rgba(77,142,255,${0.32 + jar.catchPulse * 0.22})`);
  rimG.addColorStop(1,    `rgba(20,45,100,${0.9 + jar.catchPulse * 0.08})`);
  ctx.fillStyle = rimG;
  ctx.fill();
  ctx.strokeStyle = `rgba(173,198,255,${0.5 + jar.catchPulse * 0.3})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Rim highlight
  ctx.beginPath();
  ctx.moveTo(-rimW / 2 + 4, rimTopY + 2);
  ctx.lineTo(rimW / 2 - 4, rimTopY + 2);
  ctx.strokeStyle = `rgba(255,255,255,${0.45 + jar.catchPulse * 0.3})`;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Label above rim
  const labelY = rimTopY - 11;

  if (jar.prevLabelAlpha > 0) {
    ctx.globalAlpha = jar.prevLabelAlpha * 0.85;
    ctx.fillStyle = '#adc6ff';
    ctx.font = 'bold 10px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(jar.prevLabel.toUpperCase(), 0, labelY);
  }

  ctx.globalAlpha = jar.labelAlpha;
  ctx.fillStyle = jar.catchPulse > 0.4 ? '#4edea3' : '#adc6ff';
  ctx.font = 'bold 10px Manrope, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(jar.label.toUpperCase(), 0, labelY);

  ctx.restore();
}

/* ─── Component ─────────────────────────────────────────────────── */
export default function CurrencyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    objs: FallingObj[];
    jar: Jar;
    t: number;
    labelIdx: number;
    raf: number;
  } | null>(null);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const w = canvas.offsetWidth;
    const count = reduced ? 0 : TOTAL;
    const objs: FallingObj[] = Array.from({ length: count }, (_, i) => makeObj(i, w, true));
    const jar: Jar = {
      x: w / 2,
      targetX: w / 2,
      label: CATCH_LABELS[0],
      prevLabel: CATCH_LABELS[0],
      labelAlpha: 1,
      prevLabelAlpha: 0,
      catchPulse: 0,
    };
    stateRef.current = { objs, jar, t: 0, labelIdx: 0, raf: 0 };
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
    if (stateRef.current) {
      stateRef.current.jar.x = w / 2;
      stateRef.current.jar.targetX = w / 2;
    }
  }, []);

  const tick = useCallback(() => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    ctx.clearRect(0, 0, w, h);
    s.t++;

    const { jar } = s;

    // Organic wandering path
    const margin = 90;
    const range  = w * 0.5 - margin;
    const newTarget = w * 0.5
      + Math.sin(s.t * 0.0009) * range * 0.65
      + Math.sin(s.t * 0.0021 + 1.1) * range * 0.22
      + Math.sin(s.t * 0.0047 + 2.6) * range * 0.13;
    jar.targetX = Math.max(margin, Math.min(w - margin, newTarget));
    jar.x += (jar.targetX - jar.x) * 0.022;

    jar.catchPulse    *= 0.90;
    jar.labelAlpha     = Math.min(1, jar.labelAlpha    + 0.035);
    jar.prevLabelAlpha = Math.max(0, jar.prevLabelAlpha - 0.035);

    // Jar geometry for catch detection
    const jarBaseY  = h - 22;
    const rimTopY   = jarBaseY - 7 - 68 - 18 - 20 - 10;
    const mouthY    = rimTopY;
    const halfMouth = 23;

    for (const obj of s.objs) {
      // Very gentle gravity with terminal velocity cap
      obj.vy += 0.003;
      obj.vy = Math.min(obj.vy, 0.65);

      // Subtle horizontal drift
      obj.vx += Math.sin(s.t * 0.002 + obj.id * 1.3) * 0.0008;
      obj.vx *= 0.998;

      obj.x += obj.vx;
      obj.y += obj.vy;

      // Barely rotating
      obj.angle    += obj.angleVel;
      obj.angleVel += Math.sin(s.t * 0.001 + obj.id * 2.1) * 0.00008;
      obj.angleVel *= 0.998;

      obj.catchFlash *= 0.88;

      // Wall bounce
      if (obj.x < 30)     { obj.x = 30;     obj.vx =  Math.abs(obj.vx) * 0.6; }
      if (obj.x > w - 30) { obj.x = w - 30; obj.vx = -Math.abs(obj.vx) * 0.6; }

      // Catch check
      const bottomY = obj.y + (obj.type === 'note' ? obj.size * 0.23 : obj.size);
      if (
        bottomY > mouthY - 4 &&
        bottomY < mouthY + 28 &&
        Math.abs(obj.x - jar.x) < halfMouth + obj.size * 0.28
      ) {
        const nextIdx      = (s.labelIdx + 1) % CATCH_LABELS.length;
        jar.prevLabel      = jar.label;
        jar.prevLabelAlpha = jar.labelAlpha;
        jar.label          = CATCH_LABELS[nextIdx];
        jar.labelAlpha     = 0;
        s.labelIdx         = nextIdx;
        jar.catchPulse     = 1;
        obj.catchFlash     = 1;
        Object.assign(obj, makeObj(obj.id, w));
      }

      // Off-screen respawn
      if (obj.y > h + 80) Object.assign(obj, makeObj(obj.id, w));

      if (obj.type === 'note') drawNote(ctx, obj);
      else drawChip(ctx, obj);
    }

    drawMasonJar(ctx, jar, w, h);

    s.raf = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    init();
    resize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    window.addEventListener('resize', resize);
    const s = stateRef.current;
    if (s) s.raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('resize', resize);
      if (stateRef.current) cancelAnimationFrame(stateRef.current.raf);
    };
  }, [init, resize, tick]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
