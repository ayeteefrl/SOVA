'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

type TickerEntry = { symbol: string; price: number; change: number };

const FALLBACK: TickerEntry[] = [
  { symbol: 'NIFTY 50',       price: 22147.20, change:  0.85 },
  { symbol: 'SENSEX',         price: 73088.33, change:  0.72 },
  { symbol: 'NIFTY MIDCAP',   price: 47312.15, change:  1.10 },
  { symbol: 'NIFTY SMALLCAP', price: 16823.40, change: -0.35 },
  { symbol: 'S&P 500',        price:  5243.30, change:  0.28 },
  { symbol: 'DOW JONES',      price: 39112.60, change:  0.14 },
  { symbol: 'NASDAQ',         price: 16340.87, change:  0.52 },
  { symbol: 'NIKKEI 225',     price: 38905.00, change: -0.43 },
  { symbol: 'FTSE 100',       price:  7987.40, change:  0.18 },
  { symbol: 'HANG SENG',      price: 17453.10, change: -0.61 },
  { symbol: 'BRENT CRUDE',    price:    87.42, change: -0.72 },
  { symbol: 'GOLD',           price:  2342.10, change:  0.31 },
  { symbol: 'USD/INR',        price:    83.42, change:  0.05 },
  { symbol: 'BITCOIN',        price: 62430.00, change:  1.84 },
];

function fmt(price: number, symbol: string) {
  if (symbol === 'USD/INR') return price.toFixed(2);
  if (symbol === 'BITCOIN') return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price > 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return price.toFixed(2);
}

export function MarketTicker() {
  const [tickers, setTickers] = useState<TickerEntry[]>(FALLBACK);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const baseX = useRef(0);
  const isAnimating = useRef(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/market', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) setTickers(data);
    } catch {
      // keep current data on error
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, []);

  // Double list — animation uses -50% which equals exactly one copy width
  const items = [...tickers, ...tickers];

  // Read current CSS-animated translateX from computed style
  const getCurrentX = useCallback((): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    return new DOMMatrix(t).m41;
  }, []);

  // Freeze element at its current animated position, removing the animation
  const freeze = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const x = getCurrentX();
    baseX.current = x;
    el.style.animation = 'none';
    el.style.transform = `translateX(${x}px)`;
    isAnimating.current = false;
  }, [getCurrentX]);

  // Resume animation from a given pixel offset, using negative animation-delay
  const resumeFromX = useCallback((x: number) => {
    const el = trackRef.current;
    if (!el) return;
    const halfWidth = el.scrollWidth / 2;
    if (halfWidth === 0) return;
    // Normalize x into [-halfWidth, 0]
    let norm = x % halfWidth;
    if (norm > 0) norm -= halfWidth;
    const delaySec = (norm / halfWidth) * 60; // always <= 0
    // Set animation BEFORE clearing inline transform so the browser renders
    // both changes atomically — prevents a single-frame jump to position 0.
    el.style.animation = `ticker 60s linear ${delaySec}s infinite`;
    el.style.transform = '';
    isAnimating.current = true;
  }, []);

  // Mouse drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!trackRef.current) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    freeze();
  }, [freeze]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !trackRef.current) return;
    const delta = e.clientX - dragStartX.current;
    const newX = baseX.current + delta;
    trackRef.current.style.transform = `translateX(${newX}px)`;
  }, []);

  const onMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !trackRef.current) return;
    isDragging.current = false;
    const delta = e.clientX - dragStartX.current;
    const newX = baseX.current + delta;
    baseX.current = newX; // persist so onMouseLeave doesn't revert
    resumeFromX(newX);
  }, [resumeFromX]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // Wheel scroll handler
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const el = trackRef.current;
    if (!el) return;
    const currentX = isAnimating.current ? getCurrentX() : baseX.current;
    const delta = -(e.deltaX || e.deltaY) * 1.5;
    resumeFromX(currentX + delta);
  }, [getCurrentX, resumeFromX]);

  // Hover pause/resume (but not while dragging)
  const onMouseEnter = useCallback(() => {
    if (isDragging.current || !trackRef.current) return;
    freeze();
  }, [freeze]);

  const onMouseLeave = useCallback(() => {
    if (isDragging.current || !trackRef.current) return;
    setHoveredSymbol(null);
    resumeFromX(baseX.current);
  }, [resumeFromX]);

  return (
    <div
      className="w-full bg-surface-container-lowest border-b border-outline-variant/10 py-2 overflow-hidden z-50 select-none cursor-grab active:cursor-grabbing"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onWheel={onWheel}
    >
      <div
        ref={trackRef}
        className="flex gap-12 items-center text-[10px] uppercase tracking-widest font-bold whitespace-nowrap will-change-transform animate-ticker"
      >
        {items.map((t, i) => {
          const isHov = hoveredSymbol === t.symbol;
          return (
            <span
              key={`${t.symbol}-${i < tickers.length ? 'a' : 'b'}`}
              onMouseEnter={() => setHoveredSymbol(t.symbol)}
              className={cn(
                'flex items-center gap-2 shrink-0 px-2 py-0.5 rounded-lg transition-all duration-200 cursor-inherit',
                isHov && 'bg-surface-container-high/40 ring-1 ring-gold/25',
              )}
            >
              <span
                className="transition-all duration-200"
                style={isHov
                  ? { color: '#D4AF37', filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.85))' }
                  : { color: 'rgba(140,144,159,0.6)' }}
              >
                ◆
              </span>

              <span className={cn('transition-colors duration-200', isHov ? 'text-on-surface' : 'text-on-surface-variant/80')}>
                {t.symbol}
              </span>

              <span className={cn('font-black tabular-nums', t.change >= 0 ? 'text-secondary' : 'text-tertiary')}>
                {fmt(t.price, t.symbol)}
              </span>

              <span className={cn(
                'text-[9px] font-semibold tabular-nums',
                t.change >= 0 ? 'text-secondary/70' : 'text-tertiary/70',
              )}>
                ({t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%)
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
