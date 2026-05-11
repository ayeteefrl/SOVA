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
import { formatINR, cn } from '@/lib/utils';
import { computeRebalancePlan, formatRebalanceSuggestion } from '@/lib/rebalance';
import Link from 'next/link';

const staggerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

/* ─── Rebalance Modal ─────────────────────────────────────────── */
function RebalanceModal({ onClose }: { onClose: () => void }) {
  const { equityHoldings, mutualFundHoldings, etfHoldings } = useHoldings();

  const eqVal  = equityHoldings.reduce((s, h) => s + (h.value ?? 0), 0);
  const mfVal  = mutualFundHoldings.reduce((s, h) => s + (h.value ?? 0), 0);
  const etfVal = etfHoldings.reduce((s, h) => s + (h.value ?? 0), 0);
  const total  = eqVal + mfVal + etfVal || 1;

  const currentSlices = [
    { label: 'Equity', value: eqVal },
    { label: 'Mutual Fund', value: mfVal },
    { label: 'ETF', value: etfVal },
  ];

  const defaultTargets: Record<string, number> = {
    Equity: Math.round((eqVal / total) * 100),
    'Mutual Fund': Math.round((mfVal / total) * 100),
    ETF: Math.round((etfVal / total) * 100),
  };

  const [targets, setTargets] = useState<Record<string, number>>({ ...defaultTargets });

  const plan = computeRebalancePlan(currentSlices, targets);

  const fieldStyle = { background: '#1a2035', border: '1px solid #2f3445' };
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
          {/* Drift summary badge */}
          <div className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest',
            plan.needsAction
              ? 'bg-tertiary/10 text-tertiary'
              : 'bg-secondary/10 text-secondary',
          )}>
            <span className="material-symbols-outlined text-sm">{plan.needsAction ? 'warning' : 'check_circle'}</span>
            {plan.needsAction
              ? `Portfolio drift: ${plan.totalDrift.toFixed(1)}% — rebalancing recommended`
              : `Portfolio drift: ${plan.totalDrift.toFixed(1)}% — within tolerance`}
          </div>

          {/* Current vs Target table */}
          <div className="grid grid-cols-3 gap-3 text-center text-[9px] font-black uppercase tracking-widest text-[#8c909f] mb-1">
            <span>Asset Class</span><span>Current</span><span>Target %</span>
          </div>

          {plan.slices.map((slice) => (
            <div key={slice.label} className="grid grid-cols-3 gap-3 items-center">
              <span className="text-[11px] font-black text-[#dde2f8]">{slice.label}</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-black text-[#adc6ff]">{slice.currentPct.toFixed(1)}%</span>
                <div className="w-full h-1.5 rounded-full bg-[#1e2538] overflow-hidden">
                  <div className="h-full rounded-full bg-[#4d8eff]" style={{ width: `${Math.min(slice.currentPct, 100)}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={targets[slice.label] ?? Math.round(slice.currentPct)}
                  onChange={(e) => setTargets((p) => ({ ...p, [slice.label]: Number(e.target.value) }))}
                  className={inputCls}
                  style={fieldStyle}
                />
                <span className={cn('text-[10px] font-black w-10 text-right shrink-0',
                  slice.driftPct > 0 ? 'text-[#ffb2b7]' : slice.driftPct < 0 ? 'text-[#4edea3]' : 'text-[#8c909f]',
                )}>
                  {slice.driftPct > 0 ? `+${slice.driftPct.toFixed(1)}%` : slice.driftPct < 0 ? `${slice.driftPct.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          ))}

          {/* Trade suggestions */}
          <div className="pt-3 border-t border-[#2f3445]/60 space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#8c909f]">Suggested Actions</p>
            {plan.slices.map((slice) => {
              const suggestion = formatRebalanceSuggestion(slice);
              return (
                <div key={slice.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded',
                      slice.action === 'BUY' ? 'bg-[#4edea3]/15 text-[#4edea3]' :
                      slice.action === 'SELL' ? 'bg-[#ffb2b7]/15 text-[#ffb2b7]' :
                      'bg-[#8c909f]/15 text-[#8c909f]',
                    )}>
                      {slice.action}
                    </span>
                    <span className="text-[11px] font-bold text-[#dde2f8]">{slice.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#8c909f]">{suggestion}</span>
                </div>
              );
            })}
            {plan.slices.some((s) => s.taxImpact) && (
              <div className="mt-2 p-2.5 rounded-lg bg-gold/8 border border-gold/20">
                <p className="text-[9px] font-bold text-gold">
                  {plan.slices.filter((s) => s.taxImpact).map((s) => `${s.label}: ${s.taxImpact}`).join(' · ')}
                </p>
              </div>
            )}
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
  const [showRebalance, setShowRebalance] = useState(false);
  const { firstName } = useUser();
  const { equityHoldings, mutualFundHoldings, etfHoldings, isLoading, intradayReady, needsKiteReconnect } = useHoldings();

  // All KPI values derived directly from holdings context.
  // When Zerodha is connected, holdings are populated from Zerodha live data.
  // When disconnected, holdings use cached/custom data. Either way, this is the single source of truth.
  const equityValue    = equityHoldings.reduce((a, h) => a + h.value, 0);
  const mfValue        = mutualFundHoldings.reduce((a, h) => a + h.value, 0);
  const etfValue       = etfHoldings.reduce((a, h) => a + h.value, 0);
  const netWorth       = equityValue + mfValue + etfValue;
  const totalInvested  =
    equityHoldings.reduce((a, h) => a + h.units * h.avgCost, 0) +
    mutualFundHoldings.reduce((a, h) => a + h.units * h.avgCost, 0) +
    etfHoldings.reduce((a, h) => a + h.units * h.avgCost, 0);
  // Use dayAbs (exact INR change) if available; fall back to approximate formula
  const dayChange      = equityHoldings.reduce((a, h) => a + (h.dayAbs ?? (h.value * h.daily) / 100), 0);
  const dayChangePct   = netWorth > 0 ? (dayChange / netWorth) * 100 : 0;
  const allTimeGain    = netWorth - totalInvested;
  const isPositiveDay  = dayChange >= 0;

  // Sector breakdown for SectorBars
  const sectorMap = new Map<string, number>();
  for (const h of equityHoldings) {
    const sector = h.sector ?? 'Other';
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.value);
  }
  const sectorData = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      weight: equityValue > 0 ? (value / equityValue) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  // Listen to global refresh events (e.g. after logging a trade)
  useEffect(() => {
    const handler = () => {};
    window.addEventListener('sova:refresh', handler);
    return () => window.removeEventListener('sova:refresh', handler);
  }, []);

  return (
    <div className="p-8 space-y-8 pb-16 relative">

      {/* Disconnected banner */}
      <AnimatePresence>
        {needsKiteReconnect && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl bg-tertiary/10 ring-1 ring-tertiary/25"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary text-base shrink-0">wifi_off</span>
              <p className="text-[10px] font-bold text-on-surface-variant">
                Zerodha is disconnected — showing holdings from cache. Live day P&L unavailable.
              </p>
            </div>
            <a
              href="/api/auth/kite/login"
              className="shrink-0 flex items-center gap-1.5 px-4 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                color: '#001a42',
                boxShadow: '0 0 16px rgba(173,198,255,0.2)',
              }}
            >
              <span className="material-symbols-outlined text-sm">link</span>
              Reconnect
            </a>
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
              Good morning, <span className="gradient-text-gold" style={{ paddingRight: '0.1em' }}>{firstName}</span>.
            </h1>
            {netWorth > 0 ? (
              <p className="text-sm text-on-surface-variant font-medium mt-3 max-w-lg">
                Your book is{' '}
                <span className={`font-bold ${isPositiveDay ? 'text-secondary' : 'text-tertiary'}`}>
                  {isPositiveDay ? 'up' : 'down'} {Math.abs(dayChangePct).toFixed(2)}%
                </span>{' '}
                on the day — {formatINR(Math.abs(dayChange), { compact: true })} net movement.
                {needsKiteReconnect && (
                  <span className="text-outline"> (Cached data — reconnect Zerodha for live figures.)</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-on-surface-variant font-medium mt-3 max-w-lg">
                {isLoading ? 'Loading your portfolio…' : 'Add holdings or connect Zerodha to get started.'}
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
        <KPICard label="Net Worth"     value={netWorth}    format="inr" icon="diamond" loading={isLoading} />
        <KPICard
          label="Day Change"
          value={dayChange}
          format="inr"
          accent={isPositiveDay ? 'positive' : 'negative'}
          delta={dayChangePct}
          icon="trending_up"
          loading={isLoading || !intradayReady}
        />
        <KPICard label="All-Time Gain" value={allTimeGain} format="inr" icon="insights" accent={allTimeGain >= 0 ? 'positive' : 'negative'} loading={isLoading} />
        <KPICard label="Equity Value"  value={equityValue} format="inr" accent="gold" icon="savings" loading={isLoading} />
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
            subtitle={sectorData.length > 0 ? '% of equity sleeve' : 'Add equity holdings to see sector data'}
            className="mb-6"
          />
          <SectorBars data={sectorData} />
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
          {netWorth > 0
            ? `${formatINR(netWorth, { compact: true })} under management`
            : 'Add holdings to get started'}{' '}
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
  const { equityHoldings } = useHoldings();

  const movers = [...equityHoldings]
    .filter((h) => h.daily !== 0)
    .sort((a, b) => Math.abs(b.daily) - Math.abs(a.daily))
    .slice(0, 5);

  if (!movers.length) {
    return (
      <p className="text-[11px] text-outline italic">
        No live holdings data — connect Zerodha or add holdings to see today's movers.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {movers.map((m) => (
        <div
          key={m.ticker ?? m.name}
          className="flex items-center justify-between p-4 rounded-lg bg-surface-container-highest/20 hover:bg-surface-container-highest/40 transition-colors"
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-on-surface">{m.ticker ?? m.name}</p>
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
