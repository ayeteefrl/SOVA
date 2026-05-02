'use client';

import { motion } from 'framer-motion';
import { equityHoldings } from '@/lib/data';
import { Card } from '@/components/ui/Card';

const riskMeta = {
  Low:    { color: '#4edea3', label: 'Low Risk' },
  Medium: { color: '#D4AF37', label: 'Medium' },
  High:   { color: '#ffb2b7', label: 'High Risk' },
};

const riskOrder = { High: 0, Medium: 1, Low: 2 };

export function RiskTable() {
  const sorted = [...equityHoldings].sort(
    (a, b) => (riskOrder[a.riskLevel ?? 'Low']) - (riskOrder[b.riskLevel ?? 'Low']),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-outline">Equity Book</p>
          <h3 className="text-base font-extrabold uppercase tracking-widest text-on-surface mt-0.5">
            Portfolio Risk Profile
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(riskMeta).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: v.color, boxShadow: `0 0 5px ${v.color}80` }}
              />
              <span className="text-[9px] font-bold uppercase tracking-widest text-outline">{k}</span>
            </div>
          ))}
        </div>
      </div>

      <Card tier="low" animate={false} className="overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1.8fr_0.8fr_0.8fr_1fr_0.3fr] gap-4 px-5 py-3 border-b border-outline-variant/10">
          {['Position', 'Beta', '30d Vol', 'Risk Level', ''].map((h, i) => (
            <p key={i} className="text-[8px] font-black uppercase tracking-widest text-outline">
              {h}
            </p>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-outline-variant/5">
          {sorted.map((h, i) => {
            const risk = h.riskLevel ?? 'Low';
            const { color } = riskMeta[risk];
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="grid grid-cols-[1.8fr_0.8fr_0.8fr_1fr_0.3fr] gap-4 px-5 py-3.5 items-center hover:bg-surface-container-high/10 transition-colors group"
              >
                {/* Ticker + name */}
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-on-surface">
                    {h.ticker}
                  </p>
                  <p className="text-[9px] text-outline font-semibold mt-0.5 truncate uppercase tracking-wider">
                    {h.sector}
                  </p>
                </div>

                {/* Beta */}
                <p className="text-[11px] font-bold text-on-surface tabular-nums">
                  {h.beta?.toFixed(2)}
                </p>

                {/* 30d Vol */}
                <p className="text-[11px] font-bold text-on-surface tabular-nums">
                  {h.volatility30d?.toFixed(1)}%
                </p>

                {/* Risk badge */}
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: `${color}18`, color }}
                  >
                    <span
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {risk}
                  </span>
                </div>

                {/* Risk bar */}
                <div
                  className="w-1.5 h-8 rounded-full justify-self-center"
                  style={{
                    background: `linear-gradient(to bottom, ${color}90, ${color}20)`,
                    boxShadow: `0 0 8px ${color}30`,
                  }}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Footer summary */}
        <div className="px-5 py-3 border-t border-outline-variant/10 flex items-center gap-6">
          {Object.entries(riskMeta).map(([k]) => {
            const count = sorted.filter((h) => h.riskLevel === k).length;
            const { color } = riskMeta[k as keyof typeof riskMeta];
            return (
              <div key={k} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-black tabular-nums"
                  style={{ color }}
                >
                  {count}
                </span>
                <span className="text-[9px] text-outline font-semibold uppercase tracking-widest">
                  {k}
                </span>
              </div>
            );
          })}
          <p className="text-[9px] text-outline/50 font-semibold ml-auto uppercase tracking-wider">
            Beta: portfolio-weighted average
          </p>
        </div>
      </Card>
    </div>
  );
}
