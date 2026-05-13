'use client';

import { Card } from '@/components/ui/Card';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import { TopActivePositions } from '@/components/TopActivePositions';
import { RiskTable } from '@/components/RiskTable';
import { useHoldings } from '@/components/HoldingsContext';
import { formatINR } from '@/lib/utils';
import { motion } from 'framer-motion';

/* Target allocation (strategic) vs current */
const targetAllocation: Record<string, number> = {
  Equity: 60,
  'Mutual Funds': 20,
  ETF: 10,
  'Real Estate': 15,
  'Cash / Liquidity': 5,
};

// ─── metric chips ─────────────────────────────────────────────────────────────
const annualisedROI = 18.4;
const roiTarget = 12;
const volatilityIndex = 14.2;

function MetricChip({
  label, value, sub, color, icon, delay = 0,
}: {
  label: string; value: string; sub?: string; color: string; icon: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card
        tier="low"
        animate={false}
        className="px-5 py-4 flex items-center gap-4"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `${color}15`,
            border: `1px solid ${color}20`,
          }}
        >
          <span className="material-symbols-outlined text-base" style={{ color }}>
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-outline">
            {label}
          </p>
          <p className="text-lg font-black tracking-tight text-on-surface leading-tight" style={{ color }}>
            {value}
          </p>
          {sub && (
            <p className="text-[9px] font-semibold text-outline/70 uppercase tracking-widest mt-0.5">
              {sub}
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { equityHoldings, mutualFundHoldings, etfHoldings } = useHoldings();

  const allHoldings = [...equityHoldings, ...mutualFundHoldings, ...etfHoldings];
  const netWorth = allHoldings.reduce((s, h) => s + h.value, 0);
  const dayChange = allHoldings.reduce((s, h) => s + (h.dayAbs ?? (h.value * h.daily) / 100), 0);
  const dayChangePct = netWorth > 0 ? (dayChange / netWorth) * 100 : 0;

  const allocation = [
    { name: 'Equity', value: equityHoldings.reduce((s, h) => s + h.value, 0), color: '#adc6ff' },
    { name: 'Mutual Funds', value: mutualFundHoldings.reduce((s, h) => s + h.value, 0), color: '#4edea3' },
    { name: 'ETF', value: etfHoldings.reduce((s, h) => s + h.value, 0), color: '#8b9dff' },
  ];

  return (
    <div className="flex-1 min-w-0 p-4 md:p-8 space-y-6 md:space-y-10 pb-16">

        {/* Net worth banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-outline">
              Total Portfolio Value
            </p>
            <h2 className="text-4xl font-black tracking-tighter text-on-surface mt-1">
              {netWorth > 0 ? formatINR(netWorth) : <span className="text-outline">—</span>}
            </h2>
          </div>
          {dayChange !== 0 && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${dayChange >= 0 ? 'bg-secondary-container/20 border-secondary/15' : 'bg-tertiary/10 border-tertiary/15'}`}>
              <span className={`material-symbols-outlined text-base ${dayChange >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                {dayChange >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              <span className={`text-sm font-black ${dayChange >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                {dayChange >= 0 ? '+' : ''}{formatINR(dayChange)} today
              </span>
              <span className={`text-[10px] font-black ml-1 ${dayChange >= 0 ? 'text-secondary/70' : 'text-tertiary/70'}`}>
                ({dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%)
              </span>
            </div>
          )}
        </motion.div>

        {/* ── 3 metric chips ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricChip
            label="Day's Gain / Loss"
            value={`${dayChange >= 0 ? '+' : ''}${formatINR(Math.abs(dayChange), { compact: true })}`}
            sub={`${dayChangePct >= 0 ? '+' : ''}${dayChangePct.toFixed(2)}% vs yesterday`}
            color={dayChange >= 0 ? '#4edea3' : '#ffb2b7'}
            icon="show_chart"
            delay={0.05}
          />
          <MetricChip
            label="Annualised ROI"
            value={`${annualisedROI}%`}
            sub={`Target ${roiTarget}% · outperforming`}
            color="#adc6ff"
            icon="insights"
            delay={0.1}
          />
          <MetricChip
            label="Volatility Index"
            value={volatilityIndex.toFixed(1)}
            sub="Low Beta · stable book"
            color="#D4AF37"
            icon="graphic_eq"
            delay={0.15}
          />
        </div>

        {/* ── top active positions ── */}
        <TopActivePositions />

        {/* ── allocation chart ── */}
        <Card tier="low" className="p-8">
          <AllocationDonut />

          {/* ── Target vs Actual breakdown ── */}
          <div className="mt-8 pt-8 border-t border-outline-variant/10">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-outline mb-5">
              Target vs Current Allocation
            </p>
            <div className="space-y-4">
              {allocation.map((a, i) => {
                const total = allocation.reduce((s, x) => s + x.value, 0);
                const currentPct = total > 0 ? (a.value / total) * 100 : 0;
                const target = targetAllocation[a.name] ?? 0;
                const variance = currentPct - target;
                const isOver = variance > 0;
                return (
                  <motion.div
                    key={a.name}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        <span className="font-bold text-on-surface">{a.name}</span>
                      </div>
                      <div className="flex items-center gap-4 font-black">
                        <span className="text-outline">Target {target}%</span>
                        <span style={{ color: a.color }}>{currentPct.toFixed(1)}%</span>
                        <span className={variance > 0.5 ? 'text-tertiary' : variance < -0.5 ? 'text-primary-fixed-dim' : 'text-secondary'}>
                          {isOver ? '+' : ''}{variance.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* Stacked bar: target (dim) + current overlay */}
                    <div className="relative h-2 rounded-full bg-surface-container-highest/40 overflow-hidden">
                      {/* Target marker line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-outline/40 z-10"
                        style={{ left: `${target}%` }}
                      />
                      {/* Current fill */}
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${Math.min(currentPct, 100)}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.08 }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          backgroundColor: a.color,
                          boxShadow: `0 0 8px ${a.color}60`,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="flex items-center gap-6 mt-5 pt-4 border-t border-outline-variant/8">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-0.5 bg-outline/40" />
                <p className="text-[9px] text-outline font-bold">Target line</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-tertiary">+%</span>
                <p className="text-[9px] text-outline font-bold">Overweight</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-primary-fixed-dim">−%</span>
                <p className="text-[9px] text-outline font-bold">Underweight</p>
              </div>
            </div>
          </div>
        </Card>

        {/* ── risk profile ── */}
        <RiskTable />
    </div>
  );
}
