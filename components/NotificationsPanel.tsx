'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  icon: string;
  color: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const STORAGE_KEY = 'sova_notifications';

const DEFAULT_NOTIFICATIONS: Notification[] = [
  { id: 'n1', icon: 'warning',    color: '#ffb2b7', title: 'Stop-Loss Triggered',   body: 'ASIAN PAINTS hit ₹2,890 stop-loss. Position flagged for review.',       time: '14:22 today',  read: false },
  { id: 'n2', icon: 'autorenew',  color: '#4edea3', title: 'SIP Executed',           body: 'Parag Parikh Flexi Cap — ₹15,000 debited successfully.',               time: '11:05 today',  read: false },
  { id: 'n3', icon: 'payments',   color: '#D4AF37', title: 'Dividend Credited',      body: 'TCS interim dividend ₹4,860 received in trading ledger.',              time: 'Yesterday',    read: false },
  { id: 'n4', icon: 'trending_up',color: '#adc6ff', title: 'Breakout Alert',         body: 'TCS broke above 52-week high ₹4,100. Momentum bullish.',               time: '2d ago',       read: true  },
  { id: 'n5', icon: 'autorenew',  color: '#4edea3', title: 'SIP Executed',           body: 'Mirae Asset Large Cap — ₹10,000 debited successfully.',                time: '3d ago',       read: true  },
  { id: 'n6', icon: 'balance',    color: '#5eead4', title: 'Rebalance Suggestion',   body: 'Equity sleeve is 3.2% above target. Consider trimming.',               time: '5d ago',       read: true  },
  { id: 'n7', icon: 'monitoring', color: '#8b9dff', title: 'Market Alert',           body: 'NIFTY 50 down 1.4% — your portfolio drawdown at 0.8%.',                time: '1w ago',       read: true  },
];

function loadNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Notification[];
  } catch {}
  return DEFAULT_NOTIFICATIONS;
}

function saveNotifications(items: Notification[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Callback so TopBar badge stays in sync */
  onUnreadChange?: (count: number) => void;
}

export function NotificationsPanel({ open, onClose, onUnreadChange }: NotificationsPanelProps) {
  const [items, setItems] = useState<Notification[]>(DEFAULT_NOTIFICATIONS);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = loadNotifications();
    setItems(stored);
    setHydrated(true);
  }, []);

  // Persist on every change (after first hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveNotifications(items);
    onUnreadChange?.(items.filter((n) => !n.read).length);
  }, [items, hydrated, onUnreadChange]);

  const unread = items.filter((n) => !n.read).length;

  function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function deleteNotification(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  function deleteAll() {
    setItems([]);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="fixed top-[70px] right-6 z-[91] w-[400px] bg-surface-container-lowest rounded-2xl ghost-border shadow-elevated overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg text-gold">notifications</span>
                <p className="text-sm font-black text-on-surface">Notifications</p>
                {unread > 0 && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-pill bg-tertiary/15 text-tertiary border border-tertiary/20">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[9px] font-black uppercase tracking-widest text-primary-fixed-dim hover:text-primary transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    onClick={deleteAll}
                    className="text-[9px] font-black uppercase tracking-widest text-outline hover:text-tertiary transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Feed */}
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
              {items.length === 0 && (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-4xl text-outline/40">notifications_off</span>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-outline mt-3">All clear</p>
                </div>
              )}
              {items.map((n, i) => (
                <motion.button
                  key={n.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.25 }}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    'w-full flex items-start gap-3 px-5 py-4 border-b border-outline-variant/5 text-left transition-colors group',
                    n.read
                      ? 'hover:bg-surface-container-high/15'
                      : 'bg-surface-container-high/20 hover:bg-surface-container-high/30',
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${n.color}15`, border: `1px solid ${n.color}20` }}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ color: n.color }}>
                      {n.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-black text-on-surface group-hover:text-primary-fixed-dim transition-colors">
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-outline/50 mt-1.5">
                      {n.time}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-sm text-outline hover:text-tertiary transition-colors">close</span>
                  </button>
                </motion.button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-outline-variant/10 flex items-center justify-between">
              <p className="text-[9px] font-bold uppercase tracking-widest text-outline/60">
                {items.length} total alerts
              </p>
              <Link href="/settings" onClick={onClose} className="text-[9px] font-black uppercase tracking-widest text-outline hover:text-on-surface transition-colors">
                Notification Settings →
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

