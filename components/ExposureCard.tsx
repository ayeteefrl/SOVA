'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SectorBars } from '@/components/charts/SectorBars';
import { useHoldings } from '@/components/HoldingsContext';
import type { Holding } from '@/lib/data';
import { computeRisk } from '@/lib/risk';

type View = 'sector' | 'equity';

/* ── equity horizontal bar ─────────────────────────────────────────── */
function EquityMap({ holdings }: { holdings: Holding[] }) {
  const total = holdings.reduce((s, h) => s + h.value, 0);
  const sorted = [...holdings].sort((a, b) => b.value - a.value);
  const colors = ['#adc6ff', '#4edea3', '#8b9dff', '#ffb2b7', '#D4AF37', '#ff9b6e', '#c084fc', '#5eead4', '#6ffbbe', '#ff516a'];

  if (!holdings.length) {
    return (
      <div className="text-center py-8">
        <span className="material-symbols-outlined text-3xl text-outline">inventory_2</span>
        <p className="text-[11px] text-outline italic mt-2">No equity holdings found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-64 pr-1 scrollbar-thin">
      {sorted.map((h, i) => {
        const pct = total > 0 ? (h.value / total) * 100 : 0;
        const color = colors[i % colors.length];
        return (
          <div key={h.ticker || h.name} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface">
                  {h.ticker || h.name}
                </span>
                {h.sector && (
                  <span className="text-[8px] text-outline font-semibold hidden group-hover:inline">
                    {h.sector}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-black ${h.daily >= 0 ? 'text-secondary' : 'text-tertiary'}`}
                >
                  {h.daily >= 0 ? '+' : ''}{h.daily.toFixed(2)}%
                </span>
                <span className="text-[10px] font-black text-outline w-10 text-right">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.04, ease: [0.4, 0, 0.2, 1] }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── risk panel ────────────────────────────────────────────────────── */
function RiskPanel({ holdings }: { holdings: Holding[] }) {
  const { score, hhi, top5, tips } = useMemo(() => computeRisk(holdings), [holdings]);

  const color =
    score >= 70 ? '#4edea3' :
    score >= 45 ? '#D4AF37' :
    '#ffb2b7';

  const label =
    score >= 70 ? 'Low Risk' :
    score >= 45 ? 'Moderate Risk' :
    'High Risk';

  if (!holdings.length) return null;

  return (
    <div className="mt-6 pt-5 border-t border-outline-variant/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-outline">
            Risk Score
          </p>
          <p className="text-[9px] font-semibold text-outline/60 mt-0.5">Auto-computed · refreshes with portfolio</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums" style={{ color }}>{score}</p>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{label}</p>
          </div>
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#2f3445" strokeWidth="4" />
            <circle
              cx="22" cy="22" r="18"
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeDasharray={`${(score / 100) * 113} 113`}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="px-3 py-2 rounded-lg bg-surface-container-highest/20">
          <p className="text-[8px] text-outline uppercase tracking-widest font-bold">HHI Index</p>
          <p className="text-sm font-black text-on-surface mt-0.5">{hhi.toFixed(3)}</p>
          <p className="text-[8px] text-outline/60">{hhi < 0.15 ? 'Diversified' : hhi < 0.25 ? 'Moderate' : 'Concentrated'}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-surface-container-highest/20">
          <p className="text-[8px] text-outline uppercase tracking-widest font-bold">Top-5 Weight</p>
          <p className="text-sm font-black text-on-surface mt-0.5">{(top5 * 100).toFixed(1)}%</p>
          <p className="text-[8px] text-outline/60">{top5 < 0.5 ? 'Balanced' : top5 < 0.7 ? 'Watch' : 'Overweight'}</p>
        </div>
      </div>

      <div className="space-y-2">
        {tips.map((tip, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07 }}
            className="flex items-start gap-2.5 p-2.5 rounded-lg"
            style={{ background: `${tip.color}08` }}
          >
            <span
              className="material-symbols-outlined text-sm shrink-0 mt-0.5"
              style={{ color: tip.color }}
            >
              {tip.icon}
            </span>
            <p className="text-[10px] text-on-surface/80 leading-snug">{tip.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── main component ────────────────────────────────────────────────── */
export function ExposureCard() {
  const [view, setView] = useState<View>('sector');
  const { equityHoldings } = useHoldings();

  // Derive sector data from live holdings
  const totalEquityValue = equityHoldings.reduce((a, h) => a + h.value, 0);
  const sectorMap = new Map<string, number>();
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-on-surface">
            {view === 'sector' ? 'Sector Exposure' : 'Equity Map'}
          </h3>
          <p className="text-[9px] text-outline font-bold uppercase tracking-widest mt-0.5">
            {view === 'sector' ? 'Concentration heat-map across equity sleeve' : 'Individual position weights'}
          </p>
        </div>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as View)}
          className="text-[10px] font-bold uppercase tracking-widest bg-surface-container-highest/40 border border-outline/20 rounded px-3 py-1.5 text-on-surface hover:border-primary/40 transition-colors cursor-pointer"
        >
          <option value="sector">Sector Exposure</option>
          <option value="equity">Equity Map</option>
        </select>
      </div>

      <div className={view === 'equity' ? 'overflow-y-auto' : ''}>
        {view === 'sector' ? <SectorBars data={sectorData} /> : <EquityMap holdings={equityHoldings} />}
      </div>

      <RiskPanel holdings={equityHoldings} />
    </div>
  );
}
