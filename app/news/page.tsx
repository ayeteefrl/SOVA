'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  image?: string;
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
  const [newsView, setNewsView] = useState<NewsView>('global');

  const dateTabs = buildDateTabs();
  const { equityHoldings } = useHoldings();

  const activeDateStr = dateTabs[dateTab]?.date ?? dateTabs[0].date;
  const isToday = dateTab === 0;

  // Build portfolio match terms from real holdings — tickers AND names.
  const portfolioTerms = useMemo(() => {
    const terms = new Set<string>();
    for (const h of equityHoldings) {
      if (h.ticker) terms.add(h.ticker.toUpperCase());
      if (h.name) terms.add(h.name.toUpperCase());
    }
    return [...terms];
  }, [equityHoldings]);

  // Short, human labels for the "filtering for" line — prefer tickers.
  const portfolioLabels = useMemo(() => {
    const labels = equityHoldings
      .map((h) => h.ticker?.toUpperCase() || h.name?.toUpperCase())
      .filter(Boolean) as string[];
    return [...new Set(labels)];
  }, [equityHoldings]);

  const fetchNews = useCallback(async (date: string, today: boolean, cancelled = { value: false }) => {
    setLoading(true);
    try {
      const res = await fetch(today ? '/api/news' : `/api/news?date=${date}`);
      const data = await res.json();
      if (cancelled.value) return;
      if (data.articles?.length) {
        setArticles(data.articles);
        setUsingLive(true);
      } else {
        // Past date with no stored history → show empty, not mock.
        if (today) throw new Error('empty');
        setArticles([]);
        setUsingLive(true);
      }
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
    fetchNews(activeDateStr, isToday, cancelled);
    // Only the live (today) view auto-refreshes.
    const interval = isToday
      ? setInterval(() => fetchNews(activeDateStr, true, cancelled), 5 * 60 * 1000)
      : undefined;
    return () => { cancelled.value = true; if (interval) clearInterval(interval); };
  }, [fetchNews, activeDateStr, isToday]);

  const filtered = useMemo(() => {
    let result = articles;

    // View filter
    if (newsView === 'regional') {
      result = result.filter((a) => INDIAN_SOURCES.includes(a.source));
    } else if (newsView === 'portfolio') {
      result = result.filter((a) => {
        const haystack = (a.headline + ' ' + a.summary).toUpperCase();
        return (
          a.tickers.some((t) => portfolioTerms.includes(t.toUpperCase())) ||
          portfolioTerms.some((term) => haystack.includes(term))
        );
      });
    }

    // Category filter
    if (cat !== 'ALL') {
      result = result.filter((a) => a.category.toUpperCase() === cat);
    }

    return result;
  }, [articles, cat, newsView, portfolioTerms]);

  const [featured, ...rest] = filtered;

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
              <button onClick={() => fetchNews(activeDateStr, isToday)} className="text-outline hover:text-primary-fixed-dim transition-colors ml-1 shrink-0" title="Refresh">
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Date tabs (7-day history) */}
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
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
              {portfolioLabels.length > 0
                ? <>Filtering news for: {portfolioLabels.slice(0, 6).join(', ')}{portfolioLabels.length > 6 ? ' and more' : ''}.</>
                : 'Filtering news for your portfolio. Connect a broker or import holdings to personalise this feed.'}
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
            {!isToday
              ? `No articles found for ${dateTabs[dateTab]?.label ?? 'this date'}`
              : newsView === 'portfolio' ? 'No portfolio news for this filter' : 'No articles in this category'}
          </p>
          {!isToday && (
            <p className="text-[10px] text-outline/70 mt-2 max-w-xs mx-auto">
              History starts the day SOVA first captured news — earlier dates may have no coverage.
            </p>
          )}
          <button
            onClick={() => { setDateTab(0); setCat('ALL'); }}
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
                    {featured.image ? (
                      <div className="relative w-full h-56 rounded-2xl overflow-hidden ring-1 ring-outline-variant/15">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={featured.image}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-surface/40 to-transparent pointer-events-none" />
                      </div>
                    ) : (
                      <div className="relative w-56 h-56">
                        <div className="absolute inset-0 rounded-full border border-outline-variant/20 animate-pulse_glow" />
                        <div className="absolute inset-4 rounded-full border border-outline-variant/20" />
                        <div className="absolute inset-8 rounded-full bg-gradient-to-br from-primary/20 to-gold/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-6xl text-primary-fixed-dim">
                            {catIcon(featured.category)}
                          </span>
                        </div>
                      </div>
                    )}
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
              !isToday
                ? `${rest.length} articles from ${dateTabs[dateTab]?.label ?? ''}`
                : usingLive
                ? `${rest.length} live articles · auto-refreshes every 5m`
                : `Demo articles · ${dateTabs[dateTab]?.label ?? ''}`
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
                    {n.image && (
                      <div className="-mx-6 -mt-6 mb-4 h-40 overflow-hidden rounded-t-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={n.image}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
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
