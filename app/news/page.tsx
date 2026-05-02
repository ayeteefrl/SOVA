'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Chip } from '@/components/ui/Chip';
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
};

/* ─── Portfolio tickers — shown in "My Portfolio" tab ─────────── */
const PORTFOLIO_TICKERS = [
  'RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'ICICIBANK', 'BAJFINANCE',
  'ASIANPAINT', 'LT', 'NIFTY', 'BANKNIFTY', 'GOLDBEES', 'BBETF33',
];

/* ─── News source diversity list (for display) ────────────────── */
const SOURCES = [
  'Economic Times', 'Mint', 'Business Standard', 'Moneycontrol',
  'Bloomberg Quint', 'Reuters', 'CNBC TV18', 'Financial Express',
  'LiveMint', 'The Hindu BusinessLine', 'Morningstar', 'Seeking Alpha',
  'MarketWatch', 'Bloomberg', 'Financial Times', 'WSJ Markets',
];

const CATS = ['ALL', 'MARKETS', 'EQUITY', 'MACRO', 'GLOBAL', 'EARNINGS', 'POLICY', 'SECTOR'] as const;
type Cat = (typeof CATS)[number];

/* ─── Date tabs — today + last 6 days ────────────────────────── */
function buildDateTabs() {
  const tabs = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    tabs.push({
      label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      date: d.toISOString().split('T')[0],
    });
  }
  return tabs;
}

/* ─── Sentiment chip ─────────────────────────────────────────── */
function SentimentChip({ s }: { s: Article['sentiment'] }) {
  if (s === 'bullish') return <Chip variant="positive">Bullish</Chip>;
  if (s === 'bearish') return <Chip variant="negative">Bearish</Chip>;
  return <Chip variant="neutral">Neutral</Chip>;
}

/* ─── Skeleton ───────────────────────────────────────────────── */
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

/* ─── Category icon ──────────────────────────────────────────── */
function catIcon(cat: string) {
  const icons: Record<string, string> = {
    Policy: 'gavel', Earnings: 'assessment', Global: 'public',
    Sector: 'category', Macro: 'monitoring', Markets: 'candlestick_chart', Equity: 'show_chart',
  };
  return icons[cat] ?? 'article';
}

/* ─── News view tabs ─────────────────────────────────────────── */
type NewsView = 'global' | 'portfolio';

/* ─── Page ───────────────────────────────────────────────────── */
export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [cat, setCat] = useState<Cat>('ALL');
  const [usingLive, setUsingLive] = useState(false);
  const [dateTab, setDateTab] = useState(0); // 0 = today
  const [newsView, setNewsView] = useState<NewsView>('global');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const dateTabs = buildDateTabs();

  const fetchNews = useCallback(async (cancelled = { value: false }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (cancelled.value) return;
      if (data.articles?.length) {
        setArticles(data.articles);
        setFetchedAt(data.fetchedAt);
        setUsingLive(true);
      } else throw new Error('empty');
    } catch {
      if (!cancelled.value) {
        const shaped: Article[] = mockNews.map((n) => ({
          id: n.id, headline: n.headline, source: n.source,
          category: n.category, summary: n.summary, sentiment: n.sentiment,
          tickers: n.tickers ?? [], time: n.time, url: undefined,
        }));
        setArticles(shaped);
        setUsingLive(false);
      }
    } finally {
      if (!cancelled.value) {
        setLoading(false);
        setLastRefresh(new Date());
      }
    }
  }, []);

  useEffect(() => {
    const cancelled = { value: false };
    fetchNews(cancelled);
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchNews(cancelled), 5 * 60 * 1000);
    return () => { cancelled.value = true; clearInterval(interval); };
  }, [fetchNews]);

  const filtered = useMemo(() => {
    let result = articles;

    // Portfolio filter: show only articles mentioning portfolio tickers
    if (newsView === 'portfolio') {
      result = result.filter((a) =>
        a.tickers.some((t) => PORTFOLIO_TICKERS.includes(t)) ||
        PORTFOLIO_TICKERS.some((pt) => a.headline.includes(pt) || a.summary.includes(pt)),
      );
    }

    if (cat !== 'ALL') {
      result = result.filter((a) => a.category.toUpperCase() === cat);
    }

    return result;
  }, [articles, cat, newsView]);

  const [featured, ...rest] = filtered;

  return (
    <div className="p-8 space-y-6 pb-16">

      {/* ── Top control bar ── */}
      <div className="pb-8 border-b border-outline-variant/10">

        {/* Row 1: News view toggle + refresh indicator */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1 bg-surface-container-highest/30 p-1 rounded-xl shrink-0">
            {([
              { id: 'global', label: 'Global Feed', icon: 'public' },
              { id: 'portfolio', label: 'My Portfolio', icon: 'account_balance_wallet' },
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

          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2 ml-auto">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', usingLive ? 'bg-secondary animate-pulse' : 'bg-outline')} />
            <p className="text-[9px] font-bold uppercase tracking-widest text-outline whitespace-nowrap">
              {loading ? 'Fetching…' : usingLive ? 'Live · auto-refreshes every 5m' : 'Demo data'}
            </p>
            {!loading && (
              <button
                onClick={() => fetchNews()}
                className="text-outline hover:text-primary-fixed-dim transition-colors ml-1 shrink-0"
                title="Refresh now"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mt-5 mb-5 border-t border-outline-variant/10" />

        {/* Row 2: Date tabs — scrollable strip */}
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <span className="text-[9px] font-black uppercase tracking-widest text-outline shrink-0">Date:</span>
          {dateTabs.map((tab, i) => (
            <button
              key={tab.date}
              onClick={() => setDateTab(i)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap shrink-0 transition-all',
                dateTab === i
                  ? 'bg-primary/15 text-primary-fixed-dim ring-1 ring-primary/30'
                  : 'bg-surface-container-highest/30 text-outline hover:text-on-surface',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Row 3: Category filters */}
        <div className="flex flex-wrap gap-2 mt-4">
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

      {/* Portfolio news context banner */}
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
              Showing news relevant to your holdings — {PORTFOLIO_TICKERS.slice(0, 6).join(', ')} and more.
            </p>
          </div>
        </motion.div>
      )}

      {/* Loading */}
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

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="py-24 text-center">
          <span className="material-symbols-outlined text-5xl text-outline/40">
            {newsView === 'portfolio' ? 'account_balance_wallet' : 'article'}
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-outline mt-4">
            {newsView === 'portfolio'
              ? 'No portfolio news for this filter'
              : 'No articles in this category'}
          </p>
          {dateTab > 0 && (
            <button onClick={() => setDateTab(0)} className="mt-3 text-[9px] font-black uppercase tracking-widest text-primary-fixed-dim hover:underline">
              Back to Today
            </button>
          )}
        </div>
      )}

      {/* Featured hero */}
      <AnimatePresence mode="wait">
        {!loading && featured && (
          <motion.div
            key={`${featured.id}-${dateTab}-${newsView}`}
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
                          {featured.tickers.map((t) => (
                            <Chip key={t} variant="neutral">{t}</Chip>
                          ))}
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
            overline={newsView === 'portfolio' ? 'Your Portfolio' : 'Feed'}
            title={newsView === 'portfolio' ? 'Portfolio-Relevant Intelligence' : 'Latest Intelligence'}
            subtitle={
              usingLive
                ? `${rest.length} live articles · ${SOURCES.length}+ sources · auto-refreshes every 5m`
                : `Demo articles · ${dateTabs[dateTab].label}`
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
                        {n.tickers.slice(0, 2).map((t) => (
                          <Chip key={t} variant="neutral">{t}</Chip>
                        ))}
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
