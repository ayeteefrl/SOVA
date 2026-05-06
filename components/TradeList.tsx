'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Trade {
  id: string;
  instrument_name: string;
  asset_class: string;
  action: string;
  amount: number;
  trade_date: string;
}

function iconFor(action: string): { icon: string; color: string } {
  if (action === 'Buy')      return { icon: 'trending_up',  color: 'text-primary-fixed-dim' };
  if (action === 'Sell')     return { icon: 'trending_down', color: 'text-tertiary' };
  if (action === 'SIP')      return { icon: 'payments',      color: 'text-secondary' };
  if (action === 'Dividend') return { icon: 'toll',          color: 'text-gold' };
  return                            { icon: 'savings',       color: 'text-secondary-fixed-dim' };
}

export function TradeList({ limit }: { limit?: number }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch('/api/trades')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTrades(Array.isArray(data) ? data : []))
      .catch(() => setTrades([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    window.addEventListener('sova:refresh', load);
    return () => window.removeEventListener('sova:refresh', load);
  }, []);

  const items = limit ? trades.slice(0, limit) : trades;

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(limit ?? 3)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-surface-container-highest/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="text-[11px] text-outline italic text-center py-6">
        No trades recorded yet. Use &ldquo;Add Activity&rdquo; to log your first.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((t, i) => {
        const { icon, color } = iconFor(t.action);
        const dateStr = new Date(t.trade_date).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short',
        });
        const amountStr = `₹${Math.abs(t.amount).toLocaleString('en-IN')}`;
        const isOutflow = t.action === 'Sell' || t.action === 'Withdrawal';

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
              <div className={`w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center ${color} group-hover:scale-105 transition-transform`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface">{t.instrument_name}</p>
                <p className="text-[9px] text-outline font-bold uppercase tracking-widest">
                  {t.action} · {t.asset_class}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xs font-black ${isOutflow ? 'text-tertiary' : 'text-secondary'}`}>
                {isOutflow ? '−' : '+'}{amountStr}
              </p>
              <p className="text-[9px] text-outline font-bold">{dateStr}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
