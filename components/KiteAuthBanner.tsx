'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useHoldings } from './HoldingsContext';
import { openKiteLogin, subscribeKiteAuth } from '@/lib/kite-connect';

const DISMISS_KEY = 'sova-stale-banner-dismissed';
const TOAST_DURATION_MS = 10_000;

export function KiteAuthBanner() {
  const {
    needsKiteReconnect,
    needsAngelReconnect,
    needsUpstoxReconnect,
    needsGrowwReconnect,
    isShowingCachedData,
    cacheTimestamp,
  } = useHoldings();

  const [toast, setToast]       = useState<'kite' | 'angel' | 'upstox' | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [kiteConnecting, setKiteConnecting] = useState(false);
  // Toast countdown: hovering pauses it, clicking pins it until the X is pressed.
  const [toastKey, setToastKey]       = useState(0);
  const [toastPaused, setToastPaused] = useState(false);
  const [toastPinned, setToastPinned] = useState(false);

  // Each new toast restarts the countdown with a fresh, unpinned state.
  function showToast(kind: 'kite' | 'angel' | 'upstox') {
    setToast(kind);
    setToastKey((k) => k + 1);
    setToastPaused(false);
    setToastPinned(false);
  }

  // Zerodha login popup result
  useEffect(() => {
    return subscribeKiteAuth((status) => {
      setKiteConnecting(false);
      if (status === 'success') showToast('kite');
    });
  }, []);

  function handleKiteReconnect() {
    setKiteConnecting(true);
    // Popup closed (finished or abandoned) — stop the spinner either way.
    openKiteLogin({ onClosed: () => setKiteConnecting(false) });
  }

  // Success toast — fires once after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kite_auth') === 'success')   showToast('kite');
    else if (params.get('angel_auth') === 'success')  showToast('angel');
    else if (params.get('upstox_auth') === 'success') showToast('upstox');
    if ([...params.keys()].some((k) => k.endsWith('_auth'))) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Reset the dismiss flag each calendar day so the banner reappears automatically
  // the next morning when tokens have expired overnight.
  useEffect(() => {
    const saved = localStorage.getItem(DISMISS_KEY);
    const today = new Date().toISOString().slice(0, 10);
    if (saved === today) {
      setDismissed(true);
    } else {
      localStorage.removeItem(DISMISS_KEY);
      setDismissed(false);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10));
    setDismissed(true);
  }

  // All integrations that currently need reconnecting
  const disconnected = [
    needsKiteReconnect   && 'Zerodha',
    needsAngelReconnect  && 'Angel One',
    needsUpstoxReconnect && 'Upstox',
    needsGrowwReconnect  && 'Groww',
  ].filter(Boolean) as string[];

  // Human-readable "as of" label for the stale-data timestamp
  const asOfLabel = (() => {
    if (!cacheTimestamp) return null;
    try {
      const d    = new Date(cacheTimestamp);
      const today     = new Date().toISOString().slice(0, 10);
      const tsDate    = d.toISOString().slice(0, 10);
      const timeStr   = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      if (tsDate === today) return `last synced today at ${timeStr}`;
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      if (tsDate === yesterday) return `last synced yesterday at ${timeStr}`;
      return `last synced ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${timeStr}`;
    } catch { return null; }
  })();

  // Show the stale-data banner when:
  //   • We are actively serving cached data (broker tokens have expired), AND
  //   • At least one integration needs reconnecting, AND
  //   • The user has not dismissed it today
  const showStaleBanner = isShowingCachedData && disconnected.length > 0 && !dismissed;

  const bannerLabel =
    disconnected.length === 1
      ? `${disconnected[0]} token expired`
      : `${disconnected.length} integrations need reconnecting`;

  return (
    <>
      {/* ── Success toast ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toastKey}
            role="status"
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onMouseEnter={() => setToastPaused(true)}
            onMouseLeave={() => setToastPaused(false)}
            onPointerDown={() => setToastPinned(true)}
            className="fixed top-4 right-4 z-[500] flex items-center gap-3 pl-4 pr-2 py-3 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            style={{ background: '#0f1a2e', border: '1px solid rgba(78,222,163,0.35)' }}
          >
            <span className="material-symbols-outlined text-secondary text-base">check_circle</span>
            <div className="pr-1">
              <p className="text-[11px] font-black uppercase tracking-widest text-secondary">Connected</p>
              <p className="text-[10px] text-on-surface-variant">
                {toast === 'angel'  ? 'Angel One live data active'
                : toast === 'upstox' ? 'Upstox live data active'
                :                      'Zerodha live data active'}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setToast(null); }}
              aria-label="Close notification"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-outline hover:text-on-surface hover:bg-surface-container-highest/40 transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>

            {/* Countdown bar — shrinks right-to-left; gone once the toast is pinned by a click */}
            {!toastPinned && (
              <span
                aria-hidden="true"
                onAnimationEnd={() => setToast(null)}
                className="absolute left-0 bottom-0 h-[3px] w-full origin-left"
                style={{
                  background: 'linear-gradient(90deg, #4edea3 0%, #adc6ff 100%)',
                  animation: `toast-countdown ${TOAST_DURATION_MS}ms linear forwards`,
                  animationPlayState: toastPaused ? 'paused' : 'running',
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stale-data banner ──────────────────────────────────────────── */}
      {/* Shown on every page whenever cached/stale holdings are being displayed */}
      <AnimatePresence>
        {showStaleBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-3 px-4 md:px-6 py-2.5"
              style={{
                background: 'linear-gradient(90deg, rgba(13,19,34,0.96) 0%, rgba(212,175,55,0.06) 100%)',
                borderBottom: '1px solid rgba(212,175,55,0.2)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Pulsing amber dot */}
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                style={{ background: '#D4AF37', boxShadow: '0 0 8px #D4AF3760' }}
              />

              {/* Message */}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-on-surface-variant">
                  <span className="text-gold font-black">{bannerLabel}</span>
                  {' '}— showing last known portfolio data.
                  {asOfLabel && (
                    <span className="text-outline font-semibold"> Data {asOfLabel}. Values may be outdated.</span>
                  )}
                </p>
              </div>

              {/* One-click Zerodha reconnect (opens the login popup) */}
              {needsKiteReconnect && (
                <button
                  onClick={handleKiteReconnect}
                  disabled={kiteConnecting}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-wait"
                  style={{ background: 'rgba(212,175,55,0.16)', color: '#D4AF37' }}
                >
                  <span className={`material-symbols-outlined text-sm ${kiteConnecting ? 'animate-spin' : ''}`}>
                    {kiteConnecting ? 'progress_activity' : 'link'}
                  </span>
                  {kiteConnecting ? 'Waiting for Zerodha…' : 'Reconnect Zerodha'}
                </button>
              )}

              {/* Other brokers still reconnect from Settings */}
              {disconnected.some((name) => name !== 'Zerodha') && (
                <Link
                  href="/settings#integrations"
                  className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gold hover:text-gold/80 transition-colors"
                >
                  {needsKiteReconnect ? 'Other brokers' : 'Reconnect'}
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              )}

              {/* Dismiss for today */}
              <button
                onClick={handleDismiss}
                aria-label="Dismiss until tomorrow"
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-outline hover:text-on-surface hover:bg-surface-container-highest/40 transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
