'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { recentTrades, Trade } from '@/lib/data';

function iconFor(t: Trade) {
  if (t.kind === 'Buy Order') return { icon: 'trending_up', color: 'text-primary-fixed-dim' };
  if (t.kind === 'Sell Order') return { icon: 'trending_down', color: 'text-tertiary' };
  if (t.kind === 'SIP Execution') return { icon: 'payments', color: 'text-secondary' };
  if (t.kind === 'Dividend') return { icon: 'toll', color: 'text-gold' };
  return { icon: 'savings', color: 'text-secondary-fixed-dim' };
}

export function TradeList({ limit }: { limit?: number }) {
  const items = limit ? recentTrades.slice(0, limit) : recentTrades;
  return (
    <div className="space-y-1">
      {items.map((t, i) => {
        const { icon, color } = iconFor(t);
        return (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="flex items-center justify-between p-4 rounded-lg hover:bg-surface-container-highest/40 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center ${color} group-hover:scale-105 transition-transform`}
              >
                <span className="material-symbols-outlined text-xl">{icon}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface">{t.name}</p>
                <p className="text-[9px] text-outline font-bold uppercase tracking-widest">
                  {t.kind} • {t.asset}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-on-surface">{t.amount}</p>
              <p className="text-[9px] text-outline font-bold">{t.time}</p>
            </div>
          </motion.div>
        );
      })}
      <Link
        href="/activity"
        className="block text-center text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary-fixed-dim transition-colors pt-3"
      >
        View Full Ledger →
      </Link>
    </div>
  );
}
