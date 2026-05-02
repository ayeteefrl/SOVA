'use client';

import { useEffect, useRef, useState } from 'react';

type TickerEntry = { symbol: string; price: number; change: number };

const FALLBACK: TickerEntry[] = [
  { symbol: 'NIFTY 50',      price: 22147.20, change:  0.85 },
  { symbol: 'SENSEX',        price: 73088.33, change:  0.72 },
  { symbol: 'NIFTY MIDCAP',  price: 47312.15, change:  1.10 },
  { symbol: 'NIFTY SMALLCAP',price: 16823.40, change: -0.35 },
  { symbol: 'S&P 500',       price:  5243.30, change:  0.28 },
  { symbol: 'DOW JONES',     price: 39112.60, change:  0.14 },
  { symbol: 'NASDAQ',        price: 16340.87, change:  0.52 },
  { symbol: 'NIKKEI 225',    price: 38905.00, change: -0.43 },
  { symbol: 'FTSE 100',      price:  7987.40, change:  0.18 },
  { symbol: 'HANG SENG',     price: 17453.10, change: -0.61 },
  { symbol: 'BRENT CRUDE',   price:    87.42, change: -0.72 },
  { symbol: 'GOLD',          price:  2342.10, change:  0.31 },
  { symbol: 'USD/INR',       price:    83.42, change:  0.05 },
  { symbol: 'BITCOIN',       price: 62430.00, change:  1.84 },
];

function fmt(price: number, symbol: string) {
  if (symbol === 'USD/INR') return price.toFixed(2);
  if (symbol === 'BITCOIN') return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price > 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return price.toFixed(2);
}

export function MarketTicker() {
  const [tickers, setTickers] = useState<TickerEntry[]>(FALLBACK);
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
    intervalRef.current = setInterval(fetchData, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Double the list — animation goes from 0 to -50%, landing exactly at the start
  // of the second copy, which is identical to the first. This makes a seamless loop.
  const items = [...tickers, ...tickers];

  return (
    <div className="w-full bg-surface-container-lowest border-b border-outline-variant/10 py-2 overflow-hidden ticker-wrap z-50">
      <div
        className="flex gap-12 items-center text-[10px] uppercase tracking-widest font-bold whitespace-nowrap will-change-transform animate-ticker"
      >
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-2 shrink-0">
            <span className="text-outline/60">◆</span>
            <span className="text-on-surface-variant/80">{t.symbol}</span>
            <span className={t.change >= 0 ? 'text-secondary' : 'text-tertiary'}>
              {fmt(t.price, t.symbol)}
            </span>
            <span className={`text-[9px] font-semibold ${t.change >= 0 ? 'text-secondary/70' : 'text-tertiary/70'}`}>
              ({t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
