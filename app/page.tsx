'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import { SectorBars } from '@/components/charts/SectorBars';
import { TradeList } from '@/components/TradeList';
import { useUser } from '@/components/UserContext';
import { useHoldings } from '@/components/HoldingsContext';
import { formatINR } from '@/lib/utils';
import Link from 'next/link';

const PORTFOLIO_CACHE_KEY = 'sova_portfolio_summary';

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

/* ─── Rebalance Modal ─────────────────────────────────────────── */
function RebalanceModal({ onClose }: { onClose: () => void }) {
  const { equityHoldings, mutualFundHoldings, etfHoldings } = useHoldings();

  const eqVal  = equityHoldings.reduce((s, h) => s + (h.value ?? 0), 0);
  const mfVal  = mutualFundHoldings.reduce((s, h) => s + (h.value ?? 0), 0);
  const etfVal = etfHoldings.reduce((s, h) => s + (h.value ?? 0), 0);
  const total  = eqVal + mfVal + etfVal || 1;

  const current = {
    Equity:       Math.round((eqVal  / total) * 100),
    'Mutual Fund': Math.round((mfVal  / total) * 100),
    ETF:           Math.round((etfVal / total) * 100),
  };

  const [targets, setTargets] = useState<Record<string, number>>({ ...current });

  const fieldStyle = { background: '#1a2035', border: '1px solid #2f3445' };
  const labelCls   = 'block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-1.5';
  const inputCls   = 'w-full rounded-lg px-3 py-2 text-sm text-[#dde2f8] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-elevated"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2f3445]/60">
          <h2 className="text-base font-black tracking-tight text-[#dde2f8] flex items-center gap-2">
            <span className="material-symbols-outlined text-gold">balance</span>
            Quick Rebalance
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current vs Target table */}
          <div className="grid grid-cols-3 gap-3 text-center text-[9px] font-black uppercase tracking-widest text-[#8c909f] mb-1">
            <span>Asset Class</span><span>Current</span><span>Target %</span>
          </div>

          {(Object.entries(current) as [string, number][]).map(([label, pct]) => {
            const diff = (targets[label] ?? pct) - pct;
            return (
              <div key={label} className="grid grid-cols-3 gap-3 items-center">
                <span className="text-[11px] font-black text-[#dde2f8]">{label}</span>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-black text-[#adc6ff]">{pct}%</span>
                  {/* Mini bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#1e2538] overflow-hidden">
                    <div className="h-full rounded-full bg-[#4d8eff]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={targets[label] ?? pct}
                    onChange={(e) => setTargets((p) => ({ ...p, [label]: Number(e.target.value) }))}
                    className={inputCls}
                    style={fieldStyle}
                  />
                  <span className={`text-[10px] font-black w-10 text-right shrink-0 ${diff > 0 ? 'text-[#4edea3]' : diff < 0 ? 'text-[#ffb2b7]' : 'text-[#8c909f]'}`}>
                    {diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : '—'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Net movement summary */}
          <div className="pt-3 border-t border-[#2f3445]/60 space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#8c909f]">Net Movement Required</p>
            {(Object.entries(current) as [string, number][]).map(([label, pct]) => {
              const diff = (targets[label] ?? pct) - pct;
              if (diff === 0) return null;
              const amt = Math.round((Math.abs(diff) / 100) * total);
              return (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#dde2f8]">{label}</span>
                  <span className={`text-[11px] font-black ${diff > 0 ? 'text-[#4edea3]' : 'text-[#ffb2b7]'}`}>
                    {diff > 0 ? 'Buy' : 'Sell'} ₹{amt.toLocaleString('en-IN')}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}
            >
              Close
            </button>
            <Link
              href="/dashboard"
              onClick={onClose}
              className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.2)' }}
            >
              <span className="material-symbols-outlined text-sm">analytics</span>
              View Dashboard
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function HomePage() {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRebalance, setShowRebalance] = useState(false);
  const { firstName } = useUser();

  function fetchPortfolio() {
    setIsLoading(true);
    fetch('/api/kite/portfolio')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setPortfolioSummary(data);
          // Cache last-known data
          try { localStorage.setItem(PORTFOLIO_CACHE_KEY, JSON.stringify(data)); } catch {}
        } else {
          // Show last known data when Kite is disconnected
          try {
            const cached = localStorage.getItem(PORTFOLIO_CACHE_KEY);
            if (cached) setPortfolioSummary({ ...JSON.parse(cached), _stale: true } as PortfolioSummary);
          } catch {}
        }
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(PORTFOLIO_CACHE_KEY);
          if (cached) setPortfolioSummary({ ...JSON.parse(cached), _stale: true } as PortfolioSummary);
        } catch {}
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    fetchPortfolio();
    window.addEventListener('sova:refresh', fetchPortfolio);
    return () => window.removeEventListener('sova:refresh', fetchPortfolio);
  }, []);

  const s = portfolioSummary;
  const isStale = (s as any)?._stale === true;
  const isPositiveDay = (s?.dayChange ?? 0) >= 0;

  return (
    <div className="p-8 space-y-8 pb-16 relative">

      {/* Stale data banner */}
      <AnimatePresence>
        {isStale && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-5 py-3 rounded-xl bg-tertiary/10 ring-1 ring-tertiary/25"
          >
            <span className="material-symbols-outlined text-tertiary text-base shrink-0">wifi_off</span>
            <p className="text-[10px] font-bold text-on-surface-variant">
              Zerodha is disconnected — showing last known portfolio data.{' '}
              <Link href="/settings" className="text-primary-fixed-dim hover:underline">Reconnect →</Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
              ⟡ SOVA Ledger · Morning Brief
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.02] text-on-surface">
              Good morning, <span className="gradient-text-gold">{firstName}</span>.
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
                {isLoading ? 'Loading your portfolio…' : 'Connect Zerodha to see live data.'}
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
            <button
              onClick={() => setShowRebalance(true)}
              className="px-5 h-11 flex items-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow hover:scale-[1.02] transition-transform"
            >
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
        <KPICard label="Net Worth"     value={s?.netWorth ?? 0}    format="inr" icon="diamond" />
        <KPICard
          label="Day Change"
          value={s?.dayChange ?? 0}
          format="inr"
          accent={isPositiveDay ? 'positive' : 'negative'}
          delta={s?.dayChangePct}
          icon="trending_up"
        />
        <KPICard label="All-Time Gain" value={s?.allTimeGain ?? 0} format="inr" icon="insights" />
        <KPICard label="Equity Value"  value={s?.equityValue ?? 0} format="inr" accent="gold" icon="savings" />
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
          <SectionHeader title="Sector Exposure" subtitle="% of equity sleeve" className="mb-6" />
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
          ⟡ SOVA Terminal ·{' '}
          {s ? `${formatINR(s.netWorth, { compact: true })} under management` : 'Connect Zerodha to load portfolio'}{' '}
          · Powered by Kite Connect
        </p>
      </motion.div>

      {/* Rebalance modal */}
      <AnimatePresence>
        {showRebalance && <RebalanceModal onClose={() => setShowRebalance(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ─── Top Movers ──────────────────────────────────────────────── */
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
