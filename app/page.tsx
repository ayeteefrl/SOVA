'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import { SectorBars } from '@/components/charts/SectorBars';
import { TradeList } from '@/components/TradeList';
import { formatINR } from '@/lib/utils';
import Link from 'next/link';

const staggerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

interface PortfolioSummary {
  netWorth: number;
  dayChange: number;
  dayChangePct: number;
  allTimeGain: number;
  equityValue: number;
  mfValue: number;
}

export default function HomePage() {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function fetchPortfolio() {
    setIsLoading(true);
    fetch('/api/kite/portfolio')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) setPortfolioSummary(data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    fetchPortfolio();
    window.addEventListener('sova:refresh', fetchPortfolio);
    return () => window.removeEventListener('sova:refresh', fetchPortfolio);
  }, []);

  const s = portfolioSummary;
  const isPositiveDay = (s?.dayChange ?? 0) >= 0;

  return (
    <div className="p-8 space-y-8 pb-16 relative">
      {/* Hero banner */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-low p-8 shadow-elevated noise-bg"
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-80 h-80 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-gold mb-3">
              ⟡ Sova Ledger · Morning Brief
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.02] text-on-surface">
              Good morning, <span className="gradient-text-gold">Advik</span>.
            </h1>
            {s ? (
              <p className="text-sm text-on-surface-variant font-medium mt-3 max-w-lg">
                Your book is{' '}
                <span className={`font-bold ${isPositiveDay ? 'text-secondary' : 'text-tertiary'}`}>
                  {isPositiveDay ? 'up' : 'down'} {Math.abs(s.dayChangePct).toFixed(2)}%
                </span>{' '}
                on the day — {formatINR(Math.abs(s.dayChange), { compact: true })} net movement.
              </p>
            ) : (
              <p className="text-sm text-on-surface-variant font-medium mt-3 max-w-lg">
                {isLoading ? 'Loading your portfolio...' : 'Connect Zerodha to see live data.'}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="px-5 h-11 flex items-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-surface-container-highest/60 text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-base">analytics</span>
              Analytics
            </Link>
            <button className="px-5 h-11 flex items-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow hover:scale-[1.02] transition-transform">
              <span className="material-symbols-outlined text-base">bolt</span>
              Rebalance Now
            </button>
          </div>
        </div>
      </motion.section>

      {/* Executive Summary Row */}
      <motion.div
        variants={staggerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        <KPICard label="Net Worth" value={s?.netWorth ?? 0} format="inr" icon="diamond" />
        <KPICard
          label="Day Change"
          value={s?.dayChange ?? 0}
          format="inr"
          accent={isPositiveDay ? 'positive' : 'negative'}
          delta={s?.dayChangePct}
          icon="trending_up"
        />
        <KPICard
          label="All-Time Gain"
          value={s?.allTimeGain ?? 0}
          format="inr"
          icon="insights"
        />
        <KPICard
          label="Equity Value"
          value={s?.equityValue ?? 0}
          format="inr"
          accent="gold"
          icon="savings"
        />
      </motion.div>

      {/* Performance chart */}
      <Card tier="low" className="overflow-hidden">
        <PerformanceChart />
      </Card>

      {/* Allocation + Sector */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card tier="low" className="p-8 lg:col-span-3">
          <AllocationDonut />
        </Card>
        <Card tier="low" className="p-8 lg:col-span-2">
          <SectionHeader
            title="Sector Exposure"
            subtitle="% of equity sleeve"
            className="mb-6"
          />
          <SectorBars />
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card tier="low" className="p-8">
          <SectionHeader
            overline="Signal"
            title="Top Movers Today"
            subtitle="Positions with largest intraday movement"
            className="mb-6"
          />
          <TopMovers />
        </Card>

        <Card tier="low" className="p-8">
          <SectionHeader
            title="Recent Trades & Activity"
            right={
              <Link
                href="/activity"
                className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary-fixed-dim transition-colors"
              >
                View Ledger →
              </Link>
            }
            className="mb-6"
          />
          <TradeList limit={4} />
        </Card>
      </div>

      {/* Footer strip */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center pt-6"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-outline">
          ⟡ Sova Terminal ·{' '}
          {s ? `${formatINR(s.netWorth, { compact: true })} under management` : 'Connect Zerodha to load portfolio'}{' '}
          · Powered by Kite Connect
        </p>
      </motion.div>
    </div>
  );
}

// Shows top gainers/losers from live holdings
function TopMovers() {
  const [movers, setMovers] = useState<{ name: string; ticker: string; daily: number }[]>([]);

  function fetchMovers() {
    fetch('/api/kite/holdings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.holdings) return;
        const sorted = [...data.holdings].sort((a: any, b: any) => Math.abs(b.daily) - Math.abs(a.daily));
        setMovers(sorted.slice(0, 5).map((h: any) => ({ name: h.name, ticker: h.ticker, daily: h.daily })));
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetchMovers();
    window.addEventListener('sova:refresh', fetchMovers);
    return () => window.removeEventListener('sova:refresh', fetchMovers);
  }, []);

  if (!movers.length) {
    return (
      <p className="text-[11px] text-outline italic">
        No holdings data — connect Zerodha to see movers.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {movers.map((m) => (
        <div
          key={m.ticker}
          className="flex items-center justify-between p-4 rounded-lg bg-surface-container-highest/20 hover:bg-surface-container-highest/40 transition-colors"
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-on-surface">{m.ticker}</p>
            <p className="text-[9px] text-outline font-bold uppercase tracking-widest mt-0.5">{m.name}</p>
          </div>
          <span className={`text-xs font-black ${m.daily >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
            {m.daily >= 0 ? '+' : ''}{m.daily.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}
