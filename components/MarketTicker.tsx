'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    // Refresh every 30 seconds — Yahoo Finance rate-limits faster polling
    intervalRef.current = setInterval(fetchData, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Triple the list so even on wide screens the strip is full before the loop point
  const items = [...tickers, ...tickers, ...tickers];

  return (
    <div
      className="w-full bg-surface-container-lowest border-b border-outline-variant/10 py-2 overflow-hidden z-50 select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => { setIsPaused(false); setHoveredIdx(null); }}
    >
      <div
        className="flex gap-12 items-center text-[10px] uppercase tracking-widest font-bold whitespace-nowrap will-change-transform animate-ticker"
        style={{ animationPlayState: isPaused ? 'paused' : 'running' }}
      >
        {items.map((t, i) => {
          const isHov = hoveredIdx === i;
          return (
            <span
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              className={cn(
                'flex items-center gap-2 shrink-0 px-2 py-0.5 rounded-lg transition-all duration-200 cursor-default',
                isHov && 'bg-surface-container-high/40 ring-1 ring-gold/25',
              )}
            >
              {/* Diamond — glows gold on hover */}
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

              <span className={cn('font-black', t.change >= 0 ? 'text-secondary' : 'text-tertiary')}>
                {fmt(t.price, t.symbol)}
              </span>

              <span className={cn(
                'text-[9px] font-semibold',
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
