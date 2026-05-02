'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkline } from '@/components/charts/Sparkline';
import { DeltaChip, Chip } from '@/components/ui/Chip';
import { cn, formatINR, formatNumber } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────────── */
type SearchResult = {
  symbol: string;
  shortName: string;
  longName: string;
  exchange: string;
  quoteType: string;
};

type StockDetail = {
  symbol: string;
  shortName: string;
  longName: string;
  exchange: string;
  currency: string;
  quoteType: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  open: number | null;
  volume: number | null;
  avgVolume: number | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  eps: number | null;
  dividendYield: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  sector: string;
  industry: string;
  sparkline: number[];
};

/* ─── Toast ──────────────────────────────────────────────────── */
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-surface-container border border-outline-variant/30 rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest text-on-surface shadow-elevated backdrop-blur-lg"
    >
      {message}
    </motion.div>
  );
}

/* ─── Stat row ───────────────────────────────────────────────── */
function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-outline">{label}</p>
      <p className="text-sm font-black text-on-surface">{value ?? '—'}</p>
    </div>
  );
}

/* ─── Loading skeleton ───────────────────────────────────────── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded bg-surface-container-highest/50 animate-pulse',
        className,
      )}
    />
  );
}

/* ─── Main modal ─────────────────────────────────────────────── */
type Props = { open: boolean; onClose: () => void };

export function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* focus input on open */
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setDetail(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  /* Escape closes */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /* Debounced search */
  const handleQuery = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setSelected(null); setDetail(null); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.quotes ?? []);
        if (selected) setSelected(null);
        setDetail(null);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 320);
  }, [selected]);

  /* Fetch detail when result is selected */
  const handleSelect = useCallback(async (r: SearchResult) => {
    setSelected(r);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(r.symbol)}`);
      const data = await res.json();
      if (data.stock) setDetail(data.stock);
    } catch {
      /* leave detail null */
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  /* Helpers */
  const fmtPrice = (v: number | null) => v == null ? '—' : formatINR(v, { decimals: 2 });
  const fmtCr = (v: number | null) => {
    if (v == null) return '—';
    if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)} T`;
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    return formatINR(v, { compact: true });
  };
  const fmtVol = (v: number | null) => v == null ? '—' : formatNumber(v);
  const exchange52Range = (detail: StockDetail) => {
    if (!detail.fiftyTwoWeekLow && !detail.fiftyTwoWeekHigh) return null;
    return `${fmtPrice(detail.fiftyTwoWeekLow)} – ${fmtPrice(detail.fiftyTwoWeekHigh)}`;
  };

  const qTypeColor: Record<string, string> = {
    EQUITY: 'primary',
    INDEX: 'neutral',
    ETF: 'positive',
    MUTUALFUND: 'gold',
  };

  /* Avoid SSR mismatch — portal only on client */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  /* Render at document.body level so position:fixed escapes
     any backdrop-filter / transform ancestor (e.g. sticky TopBar). */
  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-start pt-[10vh] px-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-surface-container-lowest/80 backdrop-blur-xl"
              onClick={onClose}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="relative w-full max-w-2xl bg-surface-container rounded-2xl shadow-elevated ghost-border overflow-hidden z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/15">
                <span className="material-symbols-outlined text-outline text-xl shrink-0">search</span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleQuery(e.target.value)}
                  placeholder="Search stocks, indices, ETFs — NSE · BSE…"
                  className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-outline/60 outline-none font-semibold"
                />
                {searching && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-outline animate-pulse shrink-0">
                    Searching…
                  </span>
                )}
                <kbd className="hidden md:block text-[9px] font-black uppercase tracking-widest text-outline bg-surface-container-highest/50 px-2 py-1 rounded shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Results + Detail */}
              <div className="flex divide-x divide-outline-variant/10 max-h-[60vh]">
                {/* Left: results list */}
                <div className={cn('overflow-y-auto scrollbar-thin', selected ? 'w-1/2' : 'w-full')}>
                  {results.length === 0 && !searching && query.length > 0 && (
                    <div className="px-5 py-10 text-center">
                      <p className="text-xs font-bold text-outline uppercase tracking-widest">
                        No results found
                      </p>
                      <p className="text-[10px] text-outline/60 mt-1">Try NSE ticker or company name</p>
                    </div>
                  )}

                  {results.length === 0 && !query && (
                    <div className="px-5 py-8 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-outline">
                        Quick Search
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['HDFCBANK.NS', 'TCS.NS', 'RELIANCE.NS', 'INFY.NS', 'NIFTY 50', 'GOLDBEES.NS'].map(
                          (t) => (
                            <button
                              key={t}
                              onClick={() => handleQuery(t.split('.')[0])}
                              className="px-3 py-1.5 rounded-pill text-[10px] font-black uppercase tracking-widest bg-surface-container-highest/40 text-outline hover:text-primary-fixed-dim transition-colors"
                            >
                              {t.split('.')[0]}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {results.map((r) => {
                    const isActive = selected?.symbol === r.symbol;
                    return (
                      <button
                        key={r.symbol}
                        onClick={() => handleSelect(r)}
                        className={cn(
                          'w-full flex items-center gap-4 px-5 py-4 text-left transition-colors border-b border-outline-variant/5 last:border-none',
                          isActive
                            ? 'bg-surface-container-highest/50'
                            : 'hover:bg-surface-container-highest/30',
                        )}
                      >
                        <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-black text-primary-fixed-dim uppercase">
                            {r.symbol.replace(/\.[A-Z]+$/, '').slice(0, 3)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-on-surface truncate">{r.shortName}</p>
                          <p className="text-[9px] font-bold text-outline uppercase tracking-widest mt-0.5">
                            {r.symbol} · {r.exchange}
                          </p>
                        </div>
                        <Chip
                          variant={(qTypeColor[r.quoteType] ?? 'neutral') as any}
                          size="sm"
                        >
                          {r.quoteType === 'MUTUALFUND' ? 'MF' : r.quoteType}
                        </Chip>
                      </button>
                    );
                  })}
                </div>

                {/* Right: detail panel */}
                {selected && (
                  <div className="w-1/2 overflow-y-auto scrollbar-thin p-6 flex flex-col gap-5">
                    {loadingDetail ? (
                      <div className="space-y-4">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-10 w-1/2" />
                        <Skeleton className="h-24 w-full" />
                        <div className="grid grid-cols-2 gap-3">
                          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                        </div>
                      </div>
                    ) : detail ? (
                      <>
                        {/* Header */}
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-outline">
                            {detail.symbol} · {detail.exchange}
                          </p>
                          <p className="text-sm font-black text-on-surface mt-0.5 leading-tight">
                            {detail.longName || detail.shortName}
                          </p>
                          {detail.sector && (
                            <p className="text-[9px] text-outline font-semibold mt-1">
                              {detail.sector} · {detail.industry}
                            </p>
                          )}
                        </div>

                        {/* Price + delta */}
                        <div className="flex items-end gap-3">
                          <p className="text-3xl font-black tracking-tight text-on-surface">
                            {fmtPrice(detail.price)}
                          </p>
                          {detail.changePercent != null && (
                            <DeltaChip value={detail.changePercent} size="md" />
                          )}
                        </div>

                        {/* Sparkline */}
                        {detail.sparkline.length > 1 && (
                          <div className="h-14 -mx-1">
                            <Sparkline
                              data={detail.sparkline}
                              color={(detail.changePercent ?? 0) >= 0 ? '#4edea3' : '#ffb2b7'}
                              height={56}
                            />
                          </div>
                        )}

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <Stat label="Day High" value={fmtPrice(detail.dayHigh)} />
                          <Stat label="Day Low" value={fmtPrice(detail.dayLow)} />
                          <Stat label="Open" value={fmtPrice(detail.open)} />
                          <Stat label="Prev Close" value={fmtPrice(detail.previousClose)} />
                          <Stat label="Market Cap" value={fmtCr(detail.marketCap)} />
                          <Stat label="Volume" value={fmtVol(detail.volume)} />
                          <Stat label="P/E (TTM)" value={detail.trailingPE?.toFixed(1) ?? null} />
                          <Stat label="EPS" value={detail.eps?.toFixed(2) ?? null} />
                          <Stat label="Div Yield" value={detail.dividendYield ? `${detail.dividendYield.toFixed(2)}%` : null} />
                          <Stat label="Beta" value={detail.beta?.toFixed(2) ?? null} />
                        </div>

                        {/* 52W range bar */}
                        {detail.fiftyTwoWeekHigh && detail.fiftyTwoWeekLow && detail.price && (
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-outline">52W Range</span>
                              <span className="text-[9px] font-bold text-outline">{exchange52Range(detail)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface-container-highest/50 overflow-hidden relative">
                              <div
                                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-primary-container to-primary"
                                style={{
                                  width: `${Math.max(2, Math.min(100, ((detail.price - detail.fiftyTwoWeekLow) / (detail.fiftyTwoWeekHigh - detail.fiftyTwoWeekLow)) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 pt-2">
                          <button
                            onClick={() => setToast(`${detail.symbol} added to Watchlist`)}
                            className="w-full h-10 rounded-lg text-[10px] font-black uppercase tracking-widest bg-surface-container-highest/50 text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-base">bookmark_add</span>
                            Add to Watchlist
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setToast(`Buy order initiated for ${detail.symbol}`)}
                              className="h-10 rounded-lg text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-glow"
                            >
                              <span className="material-symbols-outlined text-sm">trending_up</span>
                              Buy
                            </button>
                            <button
                              onClick={() => setToast(`Sell order initiated for ${detail.symbol}`)}
                              className="h-10 rounded-lg text-[10px] font-black uppercase tracking-widest bg-tertiary/15 text-tertiary hover:bg-tertiary/25 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-sm">trending_down</span>
                              Sell
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-10">
                        <span className="material-symbols-outlined text-4xl text-outline/40">monitoring</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-outline">
                          Data unavailable
                        </p>
                        <p className="text-[9px] text-outline/60">
                          Market may be closed or symbol not found
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-2.5 border-t border-outline-variant/10 flex items-center gap-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-outline">
                  Data via Yahoo Finance · NSE · BSE
                </p>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-outline">
                    ↑↓ navigate
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-outline">
                    ↵ select
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-outline">
                    esc close
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={`✓ ${toast}`} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </>,
    document.body,
  );
}
