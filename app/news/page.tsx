'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Chip } from '@/components/ui/Chip';
import { useHoldings } from '@/components/HoldingsContext';
import { newsFeed as mockNews } from '@/lib/data';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────── */
type Article = {
  id: string;
  headline: string;
  source: string;
  category: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  tickers: string[];
  time: string;
  url?: string;
  publishedAt?: string;
};

/* ─── Regional (India-focused) source names ─────────────────── */
const INDIAN_SOURCES = [
  'Economic Times', 'ET Markets', 'ET MF', 'Mint', 'Business Standard',
  'Moneycontrol', 'NDTV Profit', 'LiveMint', 'The Hindu BusinessLine',
  'CNBC TV18', 'Bloomberg Quint', 'Financial Express',
];

/* ─── News source list (for footer disclosure) ──────────────── */
const SOURCES = [
  'Economic Times', 'Mint', 'Business Standard', 'Moneycontrol',
  'Bloomberg Quint', 'Reuters', 'CNBC TV18', 'Financial Express',
  'LiveMint', 'The Hindu BusinessLine', 'Morningstar', 'Seeking Alpha',
  'MarketWatch', 'Bloomberg', 'Financial Times', 'WSJ Markets',
];

const CATS = ['ALL', 'MARKETS', 'EQUITY', 'MACRO', 'GLOBAL', 'EARNINGS', 'POLICY', 'SECTOR'] as const;
type Cat = (typeof CATS)[number];

/* ─── View tabs ──────────────────────────────────────────────── */
type NewsView = 'global' | 'regional' | 'portfolio';

/* ─── Date helpers ───────────────────────────────────────────── */
function buildDateTabs() {
  const tabs = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    tabs.push({
      label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      date: d.toISOString().split('T')[0], // YYYY-MM-DD
    });
  }
  return tabs;
}

function isSameDate(publishedAt: string | undefined, targetDate: string): boolean {
  if (!publishedAt) return false;
  try {
    return new Date(publishedAt).toISOString().split('T')[0] === targetDate;
  } catch {
    return false;
  }
}

/* ─── Sub-components ─────────────────────────────────────────── */
function SentimentChip({ s }: { s: Article['sentiment'] }) {
  if (s === 'bullish') return <Chip variant="positive">Bullish</Chip>;
  if (s === 'bearish') return <Chip variant="negative">Bearish</Chip>;
  return <Chip variant="neutral">Neutral</Chip>;
}

function SkeletonCard() {
  return (
    <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/5 space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-pill bg-surface-container-highest/60" />
        <div className="h-5 w-12 rounded-pill bg-surface-container-highest/60" />
      </div>
      <div className="h-5 w-full rounded bg-surface-container-highest/50" />
      <div className="h-5 w-4/5 rounded bg-surface-container-highest/50" />
      <div className="h-4 w-2/3 rounded bg-surface-container-highest/30" />
    </div>
  );
}

function catIcon(cat: string) {
  const icons: Record<string, string> = {
    Policy: 'gavel', Earnings: 'assessment', Global: 'public',
    Sector: 'category', Macro: 'monitoring', Markets: 'candlestick_chart', Equity: 'show_chart',
  };
  return icons[cat] ?? 'article';
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingLive, setUsingLive] = useState(false);
  const [cat, setCat] = useState<Cat>('ALL');
  const [dateTab, setDateTab] = useState(0);
  const [customDate, setCustomDate] = useState('');
  const [newsView, setNewsView] = useState<NewsView>('global');
  const dateInputRef = useRef<HTMLInputElement>(null);

  const dateTabs = buildDateTabs();
  const { equityHoldings } = useHoldings();

  // Build dynamic portfolio tickers from real holdings
  const portfolioTickers = useMemo(() => {
    const tickers = equityHoldings
      .map((h) => h.ticker?.toUpperCase())
      .filter(Boolean) as string[];
    // Fallback known names if no Zerodha holdings yet
    return tickers.length > 0
      ? tickers
      : ['RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'ICICIBANK', 'BAJFINANCE'];
  }, [equityHoldings]);

  const fetchNews = useCallback(async (cancelled = { value: false }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (cancelled.value) return;
      if (data.articles?.length) {
        setArticles(data.articles);
        setUsingLive(true);
      } else throw new Error('empty');
    } catch {
      if (!cancelled.value) {
        const shaped: Article[] = mockNews.map((n) => ({
          id: n.id, headline: n.headline, source: n.source,
          category: n.category, summary: n.summary, sentiment: n.sentiment,
          tickers: n.tickers ?? [], time: n.time, url: undefined,
          publishedAt: new Date().toISOString(), // mock = today
        }));
        setArticles(shaped);
        setUsingLive(false);
      }
    } finally {
      if (!cancelled.value) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancelled = { value: false };
    fetchNews(cancelled);
    const interval = setInterval(() => fetchNews(cancelled), 5 * 60 * 1000);
    return () => { cancelled.value = true; clearInterval(interval); };
  }, [fetchNews]);

  // Determine which date string we're filtering on
  const activeDateStr = customDate || dateTabs[dateTab]?.date || dateTabs[0].date;

  const filtered = useMemo(() => {
    let result = articles;

    // Date filter — today (dateTab === 0 and no custom date) shows all
    if (dateTab > 0 || customDate) {
      result = result.filter((a) => isSameDate(a.publishedAt, activeDateStr));
    }

    // View filter
    if (newsView === 'regional') {
      result = result.filter((a) => INDIAN_SOURCES.includes(a.source));
    } else if (newsView === 'portfolio') {
      result = result.filter((a) =>
        a.tickers.some((t) => portfolioTickers.includes(t)) ||
        portfolioTickers.some((pt) => a.headline.includes(pt) || a.summary.includes(pt)),
      );
    }

    // Category filter
    if (cat !== 'ALL') {
      result = result.filter((a) => a.category.toUpperCase() === cat);
    }

    return result;
  }, [articles, cat, newsView, dateTab, customDate, activeDateStr, portfolioTickers]);

  const [featured, ...rest] = filtered;

  function handleCustomDate(val: string) {
    setCustomDate(val);
    setDateTab(-1); // deselect standard tabs
  }

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-6 pb-16">

      {/* ── Control bar ── */}
      <div className="pb-8 border-b border-outline-variant/10 space-y-5">

        {/* Row 1: View tabs + refresh */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1 bg-surface-container-highest/30 p-1 rounded-xl shrink-0">
            {([
              { id: 'global',    label: 'Global Feed',  icon: 'public'                },
              { id: 'regional',  label: 'Regional Feed', icon: 'flag'                  },
              { id: 'portfolio', label: 'My Portfolio',  icon: 'account_balance_wallet' },
            ] as { id: NewsView; label: string; icon: string }[]).map((v) => (
              <button
                key={v.id}
                onClick={() => setNewsView(v.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                  newsView === v.id
                    ? 'bg-surface-container-low text-gold shadow-inner-glint'
                    : 'text-outline hover:text-on-surface',
                )}
              >
                <span className="material-symbols-outlined text-sm">{v.icon}</span>
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', usingLive ? 'bg-secondary animate-pulse' : 'bg-outline')} />
            <p className="text-[9px] font-bold uppercase tracking-widest text-outline whitespace-nowrap">
              {loading ? 'Fetching…' : usingLive ? 'Live · auto-refreshes every 5m' : 'Demo data'}
            </p>
            {!loading && (
              <button onClick={() => fetchNews()} className="text-outline hover:text-primary-fixed-dim transition-colors ml-1 shrink-0" title="Refresh">
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Date tabs + calendar picker */}
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
          <span className="text-[9px] font-black uppercase tracking-widest text-outline shrink-0">Date:</span>
          {dateTabs.map((tab, i) => (
            <button
              key={tab.date}
              onClick={() => { setDateTab(i); setCustomDate(''); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap shrink-0 transition-all',
                dateTab === i && !customDate
                  ? 'bg-primary/15 text-primary-fixed-dim ring-1 ring-primary/30'
                  : 'bg-surface-container-highest/30 text-outline hover:text-on-surface',
              )}
            >
              {tab.label}
            </button>
          ))}

          {/* Calendar picker */}
          <div className="relative shrink-0 ml-1">
            <button
              onClick={() => dateInputRef.current?.showPicker?.()}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all',
                customDate
                  ? 'bg-gold/15 text-gold ring-1 ring-gold/30'
                  : 'bg-surface-container-highest/30 text-outline hover:text-on-surface',
              )}
            >
              <span className="material-symbols-outlined text-xs">calendar_month</span>
              {customDate ? new Date(customDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Pick Date'}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={customDate}
              max={dateTabs[0].date}
              onChange={(e) => handleCustomDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
              style={{ pointerEvents: 'none' }}
            />
          </div>
          {customDate && (
            <button onClick={() => { setCustomDate(''); setDateTab(0); }} className="text-[9px] font-black uppercase tracking-widest text-outline hover:text-tertiary transition-colors shrink-0">✕ Clear</button>
          )}
        </div>

        {/* Row 3: Category filters */}
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                'px-4 h-9 rounded-pill text-[10px] font-black uppercase tracking-widest transition-all',
                cat === c
                  ? 'bg-primary/15 text-primary-fixed-dim ring-1 ring-primary/30'
                  : 'bg-surface-container-highest/30 text-outline hover:text-on-surface',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio intelligence banner */}
      {newsView === 'portfolio' && !loading && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gold/8 ring-1 ring-gold/20 flex items-center gap-3"
        >
          <span className="material-symbols-outlined text-gold text-base">account_balance_wallet</span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gold">Portfolio Intelligence</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              Filtering news for: {portfolioTickers.slice(0, 6).join(', ')}{portfolioTickers.length > 6 ? ' and more' : ''}.
            </p>
          </div>
        </motion.div>
      )}

      {/* Regional banner */}
      {newsView === 'regional' && !loading && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-primary/8 ring-1 ring-primary/20 flex items-center gap-3"
        >
          <span className="material-symbols-outlined text-primary-fixed-dim text-base">flag</span>
          <p className="text-[10px] text-on-surface-variant">
            <span className="font-black text-primary-fixed-dim uppercase tracking-widest">Regional Feed</span>
            {' '}— India-focused sources: ET, Mint, Business Standard, Moneycontrol, NDTV Profit.
          </p>
        </motion.div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-6">
          <div className="rounded-xl overflow-hidden border border-outline-variant/5 bg-surface-container-low p-10 animate-pulse">
            <div className="h-4 w-24 rounded bg-surface-container-highest/60 mb-4" />
            <div className="h-8 w-3/4 rounded bg-surface-container-highest/50 mb-3" />
            <div className="h-4 w-full rounded bg-surface-container-highest/40 mb-2" />
            <div className="h-4 w-2/3 rounded bg-surface-container-highest/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="py-24 text-center">
          <span className="material-symbols-outlined text-5xl text-outline/40">
            {newsView === 'portfolio' ? 'account_balance_wallet' : 'article'}
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-outline mt-4">
            {(dateTab > 0 || customDate)
              ? `No articles found for ${customDate ? new Date(customDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : dateTabs[dateTab]?.label ?? 'this date'}`
              : newsView === 'portfolio' ? 'No portfolio news for this filter' : 'No articles in this category'}
          </p>
          {(dateTab > 0 || customDate) && (
            <p className="text-[10px] text-outline/70 mt-2 max-w-xs mx-auto">
              RSS feeds only carry recent articles — past dates may have no coverage.
            </p>
          )}
          <button
            onClick={() => { setDateTab(0); setCustomDate(''); setCat('ALL'); }}
            className="mt-4 text-[9px] font-black uppercase tracking-widest text-primary-fixed-dim hover:underline"
          >
            Reset to Today
          </button>
        </div>
      )}

      {/* Featured hero */}
      <AnimatePresence mode="wait">
        {!loading && featured && (
          <motion.div
            key={`${featured.id}-${dateTab}-${newsView}-${customDate}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <a href={featured.url ?? '#'} target={featured.url ? '_blank' : '_self'} rel="noreferrer" className="block">
              <Card tier="low" animate={false} className="p-10 relative overflow-hidden noise-bg hover:-translate-y-0.5 transition-transform">
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <Chip variant="gold">Featured</Chip>
                      <Chip variant="primary">{featured.category}</Chip>
                      <SentimentChip s={featured.sentiment} />
                      {usingLive && <Chip variant="neutral">Live</Chip>}
                      {newsView === 'portfolio' && <Chip variant="gold">Portfolio</Chip>}
                      {newsView === 'regional' && <Chip variant="primary">Regional</Chip>}
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-on-surface leading-[1.1]">
                      {featured.headline}
                    </h2>
                    <p className="mt-4 text-sm text-on-surface-variant leading-relaxed max-w-xl">
                      {featured.summary}
                    </p>
                    <div className="mt-6 flex items-center gap-4 flex-wrap">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
                        {featured.source} · {featured.time}
                      </p>
                      {featured.tickers.length > 0 && (
                        <div className="flex gap-2">
                          {featured.tickers.map((t) => <Chip key={t} variant="neutral">{t}</Chip>)}
                        </div>
                      )}
                      {featured.url && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary-fixed-dim flex items-center gap-1">
                          Read Full Story
                          <span className="material-symbols-outlined text-xs">open_in_new</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hidden lg:flex items-center justify-center">
                    <div className="relative w-56 h-56">
                      <div className="absolute inset-0 rounded-full border border-outline-variant/20 animate-pulse_glow" />
                      <div className="absolute inset-4 rounded-full border border-outline-variant/20" />
                      <div className="absolute inset-8 rounded-full bg-gradient-to-br from-primary/20 to-gold/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-6xl text-primary-fixed-dim">
                          {catIcon(featured.category)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed grid */}
      {!loading && rest.length > 0 && (
        <>
          <SectionHeader
            overline={newsView === 'portfolio' ? 'Your Portfolio' : newsView === 'regional' ? 'India' : 'Feed'}
            title={
              newsView === 'portfolio' ? 'Portfolio-Relevant Intelligence'
              : newsView === 'regional' ? 'Indian Market Intelligence'
              : 'Latest Intelligence'
            }
            subtitle={
              usingLive
                ? `${rest.length} live articles · auto-refreshes every 5m`
                : `Demo articles · ${customDate ? new Date(customDate + 'T00:00:00').toLocaleDateString('en-IN') : dateTabs[dateTab]?.label ?? ''}`
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {rest.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <a href={n.url ?? '#'} target={n.url ? '_blank' : '_self'} rel="noreferrer" className="block h-full">
                  <Card tier="low" animate={false} className="p-6 hover:-translate-y-1 transition-transform cursor-pointer group h-full">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Chip variant="primary">{n.category}</Chip>
                      <SentimentChip s={n.sentiment} />
                    </div>
                    <h3 className="text-base font-black tracking-tight text-on-surface leading-snug group-hover:text-primary-fixed-dim transition-colors">
                      {n.headline}
                    </h3>
                    <p className="mt-3 text-xs text-on-surface-variant leading-relaxed line-clamp-3">{n.summary}</p>
                    <div className="mt-5 flex items-center justify-between pt-4 border-t border-outline-variant/10 flex-wrap gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
                        {n.source} · {n.time}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {n.tickers.slice(0, 2).map((t) => <Chip key={t} variant="neutral">{t}</Chip>)}
                        {n.url && (
                          <span className="material-symbols-outlined text-outline group-hover:text-primary-fixed-dim transition-colors text-sm">
                            open_in_new
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </a>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Sources disclosure */}
      {!loading && (
        <div className="pt-6 border-t border-outline-variant/10">
          <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-3">
            Monitored Sources ({SOURCES.length}+)
          </p>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <span key={s} className="text-[8px] font-bold text-outline/70 bg-surface-container-highest/20 px-2 py-1 rounded uppercase tracking-widest">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
