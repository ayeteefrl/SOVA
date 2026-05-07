'use client';

import { motion } from 'framer-motion';

type SectorEntry = { sector: string; weight: number };

const palette = ['#adc6ff', '#4edea3', '#8b9dff', '#ffb2b7', '#D4AF37', '#6ffbbe', '#4d8eff', '#ff516a'];

export function SectorBars({ data = [] }: { data?: SectorEntry[] }) {
  if (!data.length) {
    return (
      <div className="text-center py-8">
        <span className="material-symbols-outlined text-3xl text-outline">donut_large</span>
        <p className="text-[11px] text-outline italic mt-2">Add equity holdings with sectors to see exposure.</p>
      </div>
    );
  }
  const max = Math.max(...data.map((s) => s.weight));
  return (
    <div className="space-y-3">
      {data.map((s, i) => (
        <div key={s.sector} className="flex items-center gap-3">
          <p className="text-[10px] uppercase font-bold tracking-widest w-28 shrink-0 text-on-surface-variant">
            {s.sector}
          </p>
          <div className="flex-1 h-6 rounded-full bg-surface-container-highest/40 overflow-hidden relative">
            <motion.div
              key={`${s.sector}-${s.weight.toFixed(1)}`}
              initial={{ width: 0 }}
              animate={{ width: `${(s.weight / max) * 100}%` }}
              transition={{ duration: 1, delay: i * 0.07, ease: [0.4, 0, 0.2, 1] }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${palette[i % palette.length]}80 0%, ${palette[i % palette.length]} 100%)`,
              }}
            />
          </div>
          <p className="text-[11px] font-black w-12 text-right text-on-surface">
            {s.weight.toFixed(1)}%
          </p>
        </div>
      ))}
    </div>
  );
}
