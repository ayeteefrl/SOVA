'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useHoldings } from './HoldingsContext';

const DISMISS_KEY = 'sova-reconnect-popup-dismissed';

export function ReconnectPopup() {
  const {
    needsKiteReconnect,
    needsAngelReconnect,
    needsUpstoxReconnect,
    needsGrowwReconnect,
    needsHdfcReconnect,
    needsMotilaReconnect,
    isShowingCachedData,
    cacheTimestamp,
  } = useHoldings();

  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Reset the dismiss flag each calendar day so the banner reappears after midnight
    // token expiry even if the user dismissed it the previous day.
    const dismissedDate = localStorage.getItem(DISMISS_KEY);
    const today = new Date().toISOString().slice(0, 10);
    // Legacy: '1' means dismissed indefinitely; new format stores a date string.
    if (dismissedDate === '1' || dismissedDate === today) {
      setDismissed(true);
    } else {
      // Dismissed on a previous day — clear it so the banner shows again today.
      localStorage.removeItem(DISMISS_KEY);
      setDismissed(false);
    }
  }, []);

  // Names of every integration currently needing reconnection.
  const disconnected = [
    needsKiteReconnect && 'Zerodha',
    needsAngelReconnect && 'Angel One',
    needsUpstoxReconnect && 'Upstox',
    needsGrowwReconnect && 'Groww',
    needsHdfcReconnect && 'HDFC',
    needsMotilaReconnect && 'Motilal Oswal',
  ].filter(Boolean) as string[];

  // Hide if dismissed for good, or once every integration is reconnected.
  const show = !dismissed && disconnected.length > 0;

  function handleDismiss() {
    // Store today's date so the banner auto-reappears tomorrow after next expiry.
    localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10));
    setDismissed(true);
  }

  const label =
    disconnected.length === 1
      ? `Your ${disconnected[0]} connection expired.`
      : `${disconnected.length} integrations need reconnecting.`;

  // Human-readable "as of" label for the cached-data timestamp.
  const asOfLabel = (() => {
    if (!isShowingCachedData || !cacheTimestamp) return null;
    try {
      const d = new Date(cacheTimestamp);
      const today = new Date().toISOString().slice(0, 10);
      const tsDate = d.toISOString().slice(0, 10);
      const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      if (tsDate === today) return `Showing data from today at ${timeStr}`;
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      if (tsDate === yesterday) return `Showing data from yesterday at ${timeStr}`;
      return `Showing data from ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${timeStr}`;
    } catch { return null; }
  })();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="sticky top-0 z-40 -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-1"
        >
          <div
            className="flex items-center gap-3 px-4 md:px-6 py-2.5"
            style={{
              background: 'linear-gradient(90deg, rgba(13,19,34,0.92) 0%, rgba(212,175,55,0.07) 100%)',
              borderBottom: '1px solid rgba(212,175,55,0.18)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
              style={{ background: '#D4AF37', boxShadow: '0 0 8px #D4AF3760' }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-on-surface-variant truncate">
                {label}
              </p>
              {asOfLabel && (
                <p className="text-[9px] font-semibold text-outline truncate mt-0.5">
                  {asOfLabel} — all values preserved until you reconnect.
                </p>
              )}
            </div>

            <Link
              href="/settings#integrations"
              className="ml-auto shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gold hover:text-gold/80 transition-colors"
            >
              Reconnect
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>

            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-outline hover:text-on-surface hover:bg-surface-container-highest/40 transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
