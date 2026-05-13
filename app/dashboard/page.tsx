'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { SectorBars } from '@/components/charts/SectorBars';
import { CandleChart } from '@/components/charts/CandleChart';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR, cn } from '@/lib/utils';
import { computeRisk } from '@/lib/risk';
import { useHoldings } from '@/components/HoldingsContext';
import {
  computePortfolioMetrics,
  type PortfolioMetrics,
} from '@/lib/analytics';

type TaxCandidate = {
  name: string;
  ticker?: string;
  gainLoss: number;
  gainLossPct: number;
  holdingDays: number;
  type: 'LTCG' | 'STCG' | 'Loss Offset';
  action: string;
  savings: string;
  explanation: string;
  steps: string[];
  status: 'Available' | 'Pending';
};

function computeTaxCandidates(holdings: { name: string; ticker?: string; units: number; avgCost: number; ltp: number }[]): TaxCandidate[] {
  const candidates: TaxCandidate[] = [];

  for (const h of holdings) {
    const gainLoss = (h.ltp - h.avgCost) * h.units;
    const gainLossPct = h.avgCost > 0 ? ((h.ltp - h.avgCost) / h.avgCost) * 100 : 0;
    const holdingDays = 365; // Estimated — real dates would need transaction history

    if (gainLoss > 0 && gainLossPct > 10) {
      // LTCG opportunity: gains above ₹1L are taxable at 12.5% for stocks held > 1 year
      const exemptAmount = 100000;
      const taxableGain = Math.max(0, gainLoss - exemptAmount);
      const taxSaving = Math.round(taxableGain * 0.125);
      if (taxSaving > 1000) {
        candidates.push({
          name: h.name,
          ticker: h.ticker,
          gainLoss,
          gainLossPct,
          holdingDays,
          type: 'LTCG',
          action: 'Book partial profit',
          savings: `₹${taxSaving.toLocaleString('en-IN')} potential saving`,
          explanation: `${h.name} has an unrealised gain of ${formatINR(gainLoss)}. Under LTCG rules, gains up to ₹1 Lakh per financial year are tax-free for equity held over 1 year. If your total LTCG for this FY is below ₹1L, booking profits now resets your cost basis tax-free.`,
          steps: [
            `Verify your total LTCG for this FY across all equity assets.`,
            `Sell shares worth up to ₹1L profit and immediately repurchase to reset cost basis.`,
            `This works only if holding period > 365 days — check your purchase date.`,
            `Consult your CA for FY-end timing to maximise the exemption.`,
          ],
          status: 'Available',
        });
      }
    }

    if (gainLoss < -5000) {
      // Loss harvesting: can offset capital gains elsewhere
      const offsetValue = Math.abs(gainLoss);
      candidates.push({
        name: h.name,
        ticker: h.ticker,
        gainLoss,
        gainLossPct,
        holdingDays,
        type: 'Loss Offset',
        action: 'Harvest loss to offset gains',
        savings: `Offset up to ${formatINR(offsetValue)} of gains`,
        explanation: `${h.name} shows an unrealised loss of ${formatINR(Math.abs(gainLoss))}. By booking this loss, you can offset equivalent capital gains elsewhere in your portfolio, reducing your overall tax liability for this financial year.`,
        steps: [
          `Sell ${h.name} to book the loss of ${formatINR(Math.abs(gainLoss))}.`,
          `This loss can be set off against short-term or long-term capital gains.`,
          `If you wish to maintain exposure, wait 30 days before repurchasing (wash sale rule in practice).`,
          `Losses can be carried forward for up to 8 financial years if not fully offset this year.`,
        ],
        status: 'Available',
      });
    }
  }

  return candidates.slice(0, 5); // Show top 5
}

function TaxDetailModal({ candidate, onClose }: { candidate: TaxCandidate; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-container-low rounded-2xl p-8 w-full max-w-lg shadow-2xl border border-outline-variant/20 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className={cn(
              'text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-2 inline-block',
              candidate.type === 'Loss Offset' ? 'bg-tertiary/15 text-tertiary' : 'bg-secondary/15 text-secondary',
            )}>
              {candidate.type}
            </span>
            <h2 className="text-base font-black text-on-surface mt-1">{candidate.name}</h2>
            <p className={cn('text-sm font-black', candidate.gainLoss >= 0 ? 'text-secondary' : 'text-tertiary')}>
              {candidate.gainLoss >= 0 ? '+' : ''}{formatINR(candidate.gainLoss)} ({candidate.gainLossPct.toFixed(2)}%)
            </p>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-surface-container-highest/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-2">Why This Was Chosen</p>
            <p className="text-xs text-on-surface-variant leading-relaxed">{candidate.explanation}</p>
          </div>

          <div className="p-4 rounded-xl bg-gold/8 border border-gold/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-gold mb-1">Potential Savings</p>
            <p className="text-sm font-black text-on-surface">{candidate.savings}</p>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-3">Action Steps</p>
            <ol className="space-y-2">
              {candidate.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary-fixed-dim text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="p-3 rounded-lg bg-tertiary/5 border border-tertiary/15">
            <p className="text-[9px] text-outline leading-relaxed">
              ⚠ This is informational only. Consult your CA or tax advisor before taking action. Tax laws change — verify current exemption limits for the financial year.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RiskGauge({ holdings }: { holdings: { value: number; daily: number; sector?: string; weight: number }[] }) {
  const { score } = computeRisk(holdings as any);
  const color = score >= 70 ? '#4edea3' : score >= 45 ? '#D4AF37' : '#ffb2b7';
  const label = score >= 70 ? 'Good' : score >= 45 ? 'Moderate' : 'Review';
  const dashoffset = 100 - score;
  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" stroke="#2f3445" strokeWidth="3" />
          <motion.circle cx="18" cy="18" r="16" fill="none" stroke={color}
            strokeWidth="3" strokeDasharray="100" strokeLinecap="round"
            initial={{ strokeDashoffset: 100 }} whileInView={{ strokeDashoffset: dashoffset }}
            viewport={{ once: true }} transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{score}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-outline mt-1">{label}</span>
        </div>
      </div>
      <div className="mt-6 w-full space-y-2">
        {[
          { l: 'Diversification', v: holdings.length > 10 ? 'Strong' : holdings.length > 5 ? 'Adequate' : 'Watch' },
          { l: 'Concentration', v: holdings.some((h) => h.weight > 20) ? 'Watch' : 'Good' },
          { l: 'Holdings', v: `${holdings.length} positions` },
        ].map((r) => (
          <div key={r.l} className="flex justify-between px-3 py-2 rounded-lg bg-surface-container-highest/20">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">{r.l}</span>
            <span className={cn('text-[10px] font-black uppercase tracking-widest',
              r.v === 'Strong' || r.v === 'Good' ? 'text-secondary' :
              r.v === 'Watch' ? 'text-tertiary' : 'text-gold',
            )}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { equityHoldings, mutualFundHoldings, etfHoldings, isLoading: holdingsLoading, intradayReady } = useHoldings();
  const [selectedTaxCandidate, setSelectedTaxCandidate] = useState<TaxCandidate | null>(null);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [monthlyPL, setMonthlyPL] = useState<{ label: string; value: number }[]>(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      return { label: d.toLocaleString('en', { month: 'short' }).toUpperCase(), value: 0 };
    }),
  );

  const fetchMonthlyPnl = useCallback(async () => {
    const res = await fetch('/api/trades/monthly-pnl');
    if (res.ok) {
      const json = await res.json();
      if (json.data?.length) setMonthlyPL(json.data);
    }
  }, []);

  useEffect(() => {
    fetchMonthlyPnl();
    const handler = () => fetchMonthlyPnl();
    window.addEventListener('sova:refresh', handler);
    return () => window.removeEventListener('sova:refresh', handler);
  }, [fetchMonthlyPnl]);

  useEffect(() => {
    if (holdingsLoading) return;
    const allHoldings = [...equityHoldings, ...mutualFundHoldings, ...etfHoldings];
    if (allHoldings.length === 0) return;
    fetch('/api/portfolio/snapshot?daily=true')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.data?.length) return;
        const snaps = data.data.map((d: { label: string; value: number; date?: string }) => ({
          date: d.date ?? d.label,
          value: d.value,
        }));
        setMetrics(computePortfolioMetrics(snaps, allHoldings));
      })
      .catch(() => {});
  }, [holdingsLoading, equityHoldings, mutualFundHoldings, etfHoldings]);

  // Derive sector exposure from equity holdings
  const sectorMap = new Map<string, number>();
  const totalEquityValue = equityHoldings.reduce((a, h) => a + h.value, 0);
  for (const h of equityHoldings) {
    const sector = h.sector ?? 'Other';
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.value);
  }
  const sectorData = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      weight: totalEquityValue > 0 ? (value / totalEquityValue) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  // Compute real returns from all holdings
  const equityValue = equityHoldings.reduce((a, h) => a + h.value, 0);
  const mfValue = mutualFundHoldings.reduce((a, h) => a + h.value, 0);
  const etfValue = etfHoldings.reduce((a, h) => a + h.value, 0);
  const totalCurrent = equityValue + mfValue + etfValue;
  const totalInvested =
    equityHoldings.reduce((a, h) => a + h.units * h.avgCost, 0) +
    mutualFundHoldings.reduce((a, h) => a + h.units * h.avgCost, 0) +
    etfHoldings.reduce((a, h) => a + h.units * h.avgCost, 0);
  const totalReturn = totalCurrent - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  // Use dayAbs (exact INR change) if available; fall back to approximate formula
  const dayChangeAbs =
    equityHoldings.reduce((a, h) => a + (h.dayAbs ?? (h.value * h.daily) / 100), 0) +
    mutualFundHoldings.reduce((a, h) => a + (h.dayAbs ?? (h.value * h.daily) / 100), 0) +
    etfHoldings.reduce((a, h) => a + (h.dayAbs ?? (h.value * h.daily) / 100), 0);
  const dayChangePct = totalCurrent > 0 ? (dayChangeAbs / totalCurrent) * 100 : 0;

  // Tax harvesting candidates from real holdings
  const taxCandidates = computeTaxCandidates(equityHoldings);

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-8 pb-16">

      {/* KPI Cards — real portfolio data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          label="Net Worth"
          value={totalCurrent}
          format="inr"
          accent="primary"
          icon="insights"
          loading={holdingsLoading}
          sub={`Eq ${formatINR(equityValue, { compact: true })} · MF ${formatINR(mfValue, { compact: true })} · ETF ${formatINR(etfValue, { compact: true })}`}
        />
        <KPICard
          label="Total Return"
          value={totalReturnPct}
          format="percent"
          accent={totalReturnPct >= 0 ? 'positive' : 'negative'}
          icon="show_chart"
          loading={holdingsLoading}
          sub={holdingsLoading ? 'Loading…' : equityHoldings.length === 0 ? 'No Kite data' : `on ${formatINR(totalInvested, { compact: true })} invested`}
        />
        <KPICard
          label="Day Change"
          value={dayChangeAbs}
          format="inr"
          accent={dayChangeAbs >= 0 ? 'positive' : 'negative'}
          icon="timeline"
          loading={holdingsLoading || !intradayReady}
          sub={`${dayChangePct >= 0 ? '+' : ''}${dayChangePct.toFixed(2)}%`}
        />
        <KPICard
          label="All‑Time Gain"
          value={totalReturn}
          format="inr"
          accent={totalReturn >= 0 ? 'positive' : 'negative'}
          icon="flag"
          loading={holdingsLoading}
          sub={`${equityHoldings.length + mutualFundHoldings.length + etfHoldings.length} positions`}
        />
      </div>

      {/* Performance Chart */}
      <Card tier="low" className="overflow-hidden">
        <PerformanceChart />
      </Card>

      {/* Monthly P&L + Risk Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card tier="low" className="p-8 lg:col-span-2">
          <SectionHeader
            title="Monthly P&L"
            subtitle="Realised P&L — last 12 months"
            className="mb-6"
          />
          <CandleChart data={monthlyPL} height={220} />
        </Card>
        <Card tier="low" className="p-8">
          <SectionHeader overline="Health" title="Risk Profile" subtitle="Based on your holdings" className="mb-6" />
          <RiskGauge holdings={equityHoldings} />
        </Card>
      </div>

      {/* Advanced Analytics */}
      {metrics && (
        <Card tier="low" className="p-8">
          <SectionHeader
            overline="Analytics"
            title="Portfolio Health"
            subtitle="Risk-adjusted returns & drawdown analysis"
            className="mb-6"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[
              {
                label: 'Sharpe Ratio',
                value: metrics.sharpeRatio.toFixed(2),
                color: metrics.sharpeRatio >= 1 ? '#4edea3' : metrics.sharpeRatio >= 0.5 ? '#D4AF37' : '#ffb2b7',
                hint: metrics.sharpeRatio >= 1 ? 'Strong' : metrics.sharpeRatio >= 0.5 ? 'Adequate' : 'Weak',
              },
              {
                label: 'Sortino Ratio',
                value: metrics.sortinoRatio.toFixed(2),
                color: metrics.sortinoRatio >= 1.5 ? '#4edea3' : metrics.sortinoRatio >= 0.7 ? '#D4AF37' : '#ffb2b7',
                hint: metrics.sortinoRatio >= 1.5 ? 'Strong' : metrics.sortinoRatio >= 0.7 ? 'Adequate' : 'Weak',
              },
              {
                label: 'Max Drawdown',
                value: `-${metrics.maxDrawdownPct.toFixed(1)}%`,
                color: metrics.maxDrawdownPct <= 10 ? '#4edea3' : metrics.maxDrawdownPct <= 20 ? '#D4AF37' : '#ffb2b7',
                hint: metrics.maxDrawdownPct <= 10 ? 'Low' : metrics.maxDrawdownPct <= 20 ? 'Moderate' : 'High',
              },
              {
                label: 'Volatility',
                value: `${metrics.volatility.toFixed(1)}%`,
                color: metrics.volatility <= 15 ? '#4edea3' : metrics.volatility <= 25 ? '#D4AF37' : '#ffb2b7',
                hint: metrics.volatility <= 15 ? 'Low' : metrics.volatility <= 25 ? 'Moderate' : 'High',
              },
              {
                label: 'Beta',
                value: metrics.beta.toFixed(2),
                color: metrics.beta <= 1.1 && metrics.beta >= 0.8 ? '#4edea3' : '#D4AF37',
                hint: metrics.beta > 1.1 ? 'Aggressive' : metrics.beta < 0.8 ? 'Defensive' : 'Neutral',
              },
              {
                label: 'Risk-Free Rate',
                value: '7.0%',
                color: '#8c909f',
                hint: 'IN 10Y Bond',
              },
            ].map((m) => (
              <div key={m.label} className="p-4 rounded-xl bg-surface-container-highest/20 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-2">{m.label}</p>
                <p className="text-xl font-black" style={{ color: m.color }}>{m.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: m.color }}>{m.hint}</p>
              </div>
            ))}
          </div>

          {/* Rolling Returns */}
          {metrics.rollingReturns.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-3">Rolling Returns</p>
              <div className="flex gap-3 flex-wrap">
                {metrics.rollingReturns.map((r) => (
                  <div key={r.period} className="flex-1 min-w-[80px] p-3 rounded-lg bg-surface-container-highest/20 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-outline">{r.period}</p>
                    <p className={cn('text-sm font-black mt-1', r.returnPct >= 0 ? 'text-secondary' : 'text-tertiary')}>
                      {r.returnPct >= 0 ? '+' : ''}{r.returnPct.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Sector Exposure + Tax Harvesting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card tier="low" className="p-8">
          <SectionHeader
            title="Sector Exposure"
            subtitle={equityHoldings.length > 0 ? 'Derived from your equity holdings' : 'Add equity holdings to see sector data'}
            className="mb-6"
          />
          <SectorBars data={sectorData} />
        </Card>

        <Card tier="low" className="p-8">
          <SectionHeader
            overline="Tax"
            title="Tax Harvesting Candidates"
            subtitle="Click any row for detailed analysis and action steps"
            className="mb-6"
          />
          {taxCandidates.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-3xl text-outline">receipt_long</span>
              <p className="text-xs text-outline mt-3">
                {equityHoldings.length === 0
                  ? 'Connect Zerodha to see tax harvesting opportunities.'
                  : 'No tax harvesting opportunities found in current holdings.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {taxCandidates.map((t, i) => (
                <motion.button
                  key={t.name}
                  onClick={() => setSelectedTaxCandidate(t)}
                  initial={{ opacity: 0, x: -6 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  className="w-full flex items-center justify-between p-4 rounded-lg bg-surface-container-highest/20 hover:bg-surface-container-highest/35 transition-colors text-left group"
                >
                  <div>
                    <p className="text-xs font-bold text-on-surface">{t.name}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-outline mt-0.5">{t.savings}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full',
                      t.type === 'Loss Offset' ? 'bg-tertiary/15 text-tertiary' : 'bg-secondary/15 text-secondary',
                    )}>
                      {t.type}
                    </span>
                    <span className="material-symbols-outlined text-sm text-outline group-hover:text-on-surface transition-colors">chevron_right</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Tax Detail Modal */}
      <AnimatePresence>
        {selectedTaxCandidate && (
          <TaxDetailModal
            candidate={selectedTaxCandidate}
            onClose={() => setSelectedTaxCandidate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
