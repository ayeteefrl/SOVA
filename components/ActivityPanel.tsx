'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ActivityItem } from '@/lib/data';
import { activityLog as initialActivityLog } from '@/lib/data';

const COLLAPSED_W = 48;
const EXPANDED_W = 340;

const categoryMeta: Record<string, { color: string; icon: string }> = {
  Trade:      { color: '#adc6ff', icon: 'swap_horiz' },
  SIP:        { color: '#4edea3', icon: 'autorenew' },
  Dividend:   { color: '#D4AF37', icon: 'payments' },
  Deposit:    { color: '#8b9dff', icon: 'arrow_downward' },
  Withdrawal: { color: '#ffb2b7', icon: 'arrow_upward' },
  Rebalance:  { color: '#5eead4', icon: 'balance' },
};

export function ActivityPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivityLog);

  // Load activities from Supabase
  useEffect(() => {
    fetch('/api/trades')
      .then((r) => r.ok ? r.json() : [])
      .then((trades: Array<{
        id: string; asset_class: string; instrument_name: string; ticker?: string;
        action: string; units?: number; price?: number; amount: number;
        trade_date: string; rationale?: string; notes?: string;
      }>) => {
        const mapped: ActivityItem[] = trades.map((t) => ({
          id: t.id,
          title: `${t.action} ${t.instrument_name}`,
          detail: [
            t.units && t.price ? `${t.units} units @ ₹${t.price.toLocaleString('en-IN')}` : null,
            t.asset_class,
            t.notes,
          ].filter(Boolean).join(' · '),
          category: t.action === 'SIP' ? 'SIP' : t.action === 'Deposit' ? 'Deposit' : t.action === 'Withdrawal' ? 'Withdrawal' : 'Trade',
          amount: t.amount,
          positive: ['Buy', 'SIP', 'Deposit', 'Dividend'].includes(t.action),
          timestamp: new Date(t.trade_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          rationale: t.rationale ?? undefined,
        }));
        setActivities(mapped.length > 0 ? mapped : initialActivityLog);
      })
      .catch(() => setActivities(initialActivityLog));
  }, []);

  async function deleteActivity(id: string) {
    const res = await fetch(`/api/trades/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setActivities((prev) => prev.filter((a) => a.id !== id));
    }
  }

  return (
    <motion.div
      animate={{ width: isOpen ? EXPANDED_W : COLLAPSED_W }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="self-stretch shrink-0 border-l border-outline-variant/10 bg-surface-container-lowest flex flex-col overflow-hidden"
    >
      {/* Toggle strip */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="h-12 w-full flex items-center justify-center border-b border-outline-variant/10 hover:bg-surface-container-high/20 transition-colors shrink-0 group"
        title={isOpen ? 'Collapse activity' : 'Expand activity'}
      >
        <motion.span
          animate={{ rotate: isOpen ? 0 : 180 }}
          transition={{ duration: 0.25 }}
          className="material-symbols-outlined text-sm text-outline group-hover:text-primary-fixed-dim transition-colors"
        >
          chevron_right
        </motion.span>
      </button>

      {/* Collapsed: vertical label + activity dots */}
      <AnimatePresence initial={false}>
        {!isOpen && (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="flex-1 flex flex-col items-center pt-6 gap-5 overflow-hidden"
          >
            <span
              className="text-[9px] font-black uppercase tracking-[0.3em] text-outline select-none"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Activity
            </span>
            <div className="flex flex-col items-center gap-2.5 mt-2">
              {activities.slice(0, 6).map((a) => {
                const meta = categoryMeta[a.category];
                return (
                  <div
                    key={a.id}
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: meta.color,
                      boxShadow: `0 0 6px ${meta.color}90`,
                    }}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded: full feed */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.12 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="flex-1 overflow-y-auto scrollbar-thin"
          >
            <div className="p-5 pt-4">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-outline mb-5">
                Transactional Journey
              </p>

              <div className="space-y-0">
                {activities.map((item, i) => {
                  const meta = categoryMeta[item.category];
                  const isLast = i === activities.length - 1;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="flex gap-3 group"
                    >
                      {/* Icon + timeline */}
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            background: `${meta.color}15`,
                            border: `1px solid ${meta.color}25`,
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 13, color: meta.color }}
                          >
                            {meta.icon}
                          </span>
                        </div>
                        {!isLast && (
                          <div className="w-px flex-1 min-h-[16px] mt-1 mb-1 bg-outline-variant/15" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="pb-4 min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface leading-tight truncate">
                            {item.title}
                          </p>
                          <span
                            className="text-[8px] font-black uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded"
                            style={{ background: `${meta.color}18`, color: meta.color }}
                          >
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[9px] text-outline mt-0.5 font-medium leading-snug">
                          {item.detail}
                        </p>
                        <div className="flex items-center justify-between mt-1.5 gap-1">
                          <p
                            className="text-[10px] font-black tabular-nums"
                            style={{ color: item.positive ? '#4edea3' : '#ffb2b7' }}
                          >
                            {item.positive ? '+' : '−'}₹{item.amount.toLocaleString('en-IN')}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteActivity(item.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-tertiary text-outline/50 text-xs"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                            <p className="text-[8px] text-outline/50 font-semibold text-right leading-tight">
                              {item.timestamp}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
