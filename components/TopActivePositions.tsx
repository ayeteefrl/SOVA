'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useHoldings } from '@/components/HoldingsContext';
import { Sparkline } from '@/components/charts/Sparkline';
import { formatINR } from '@/lib/utils';
import { Card } from '@/components/ui/Card';

export function TopActivePositions() {
  const { equityHoldings } = useHoldings();
  const top = [...equityHoldings].sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-outline">Direct Equity</p>
          <h3 className="text-base font-extrabold uppercase tracking-widest text-on-surface mt-0.5">
            Top Active Positions
          </h3>
        </div>
        <Link
          href="/portfolio/equity"
          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-outline hover:text-primary-fixed-dim border border-outline/20 hover:border-primary-fixed-dim/30 px-3 py-1.5 rounded-lg transition-all"
        >
          View All
          <span className="material-symbols-outlined text-sm leading-none">arrow_forward</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {top.map((h, i) => {
          const isUp = h.daily >= 0;
          const accent = isUp ? '#4edea3' : '#ffb2b7';
          const sparkData = h.sparkline ?? Array.from({ length: 15 }, (_, j) => 50 + j * 0.5);

          return (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <Card
                tier="low"
                animate={false}
                className="p-5 hover:-translate-y-0.5 transition-transform cursor-default"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-on-surface">
                      {h.ticker}
                    </p>
                    <p className="text-[9px] text-outline font-semibold mt-0.5 uppercase tracking-wider truncate">
                      {h.sector}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded shrink-0 ml-2"
                    style={{ background: `${accent}15`, color: accent }}
                  >
                    {isUp ? '▲' : '▼'} {Math.abs(h.daily).toFixed(2)}%
                  </span>
                </div>

                {/* Sparkline */}
                <div className="my-3 -mx-1">
                  <Sparkline data={sparkData} color={accent} height={38} />
                </div>

                {/* Value */}
                <div className="mb-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-outline">
                    Position Value
                  </p>
                  <p className="text-[1.1rem] font-black text-on-surface mt-0.5 tabular-nums">
                    {formatINR(h.value)}
                  </p>
                  <p className="text-[9px] text-outline/60 font-semibold mt-0.5 uppercase tracking-wider">
                    {h.units} units · avg {formatINR(h.avgCost, { compact: true })}
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <Link
                    href="/activity"
                    className="flex-1 text-[9px] font-black uppercase tracking-widest text-center text-primary-fixed-dim border border-primary-fixed-dim/25 hover:bg-primary-fixed-dim/10 py-1.5 rounded-lg transition-all"
                  >
                    Trade
                  </Link>
                  <Link
                    href="/portfolio/equity"
                    className="flex-1 text-[9px] font-black uppercase tracking-widest text-center text-outline border border-outline/20 hover:border-outline/40 hover:text-on-surface py-1.5 rounded-lg transition-all"
                  >
                    Details
                  </Link>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
