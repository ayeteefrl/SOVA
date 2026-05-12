'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHoldings } from './HoldingsContext';

export function KiteAuthBanner() {
  const { needsKiteReconnect, needsAngelReconnect } = useHoldings();
  const [toast, setToast] = useState<'kite' | 'angel' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kite_auth') === 'success') {
      setToast('kite');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('angel_auth') === 'success') {
      setToast('angel');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('kite_auth') === 'failed' || params.get('angel_auth') === 'failed') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Only show the reconnect banner if ALL brokers need reconnecting — if even
  // one broker is working, the user already has live data and the banner adds noise.
  const showReconnectBanner = needsKiteReconnect && needsAngelReconnect;

  return (
    <>
      {/* Success toast — floats top-right, auto-dismisses */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed top-4 right-4 z-[500] flex items-center gap-3 px-4 py-3 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            style={{ background: '#0f1a2e', border: '1px solid rgba(78,222,163,0.35)' }}
          >
            <span className="material-symbols-outlined text-secondary text-base">check_circle</span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-secondary">Connected</p>
              <p className="text-[10px] text-on-surface-variant">
                {toast === 'angel' ? 'Angel One live data active' : 'Zerodha live data active'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reconnect banner — only shown when no broker is providing live data */}
      <AnimatePresence>
        {showReconnectBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center justify-between gap-4 px-5 py-3"
              style={{
                background: 'linear-gradient(90deg, rgba(13,19,34,0.95) 0%, rgba(77,142,255,0.08) 100%)',
                borderBottom: '1px solid rgba(173,198,255,0.12)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                  style={{ background: '#D4AF37', boxShadow: '0 0 8px #D4AF3760' }}
                />
                <p className="text-[11px] font-bold text-on-surface-variant truncate">
                  Connect a broker account to load live portfolio data
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { window.location.href = '/api/auth/kite/login'; }}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                    color: '#001a42',
                    boxShadow: '0 0 16px rgba(173,198,255,0.2)',
                  }}
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  Zerodha
                </button>
                <button
                  onClick={() => { window.location.href = '/api/auth/angel/login'; }}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #ff6b35 0%, #ffb347 100%)',
                    color: '#1a0800',
                    boxShadow: '0 0 16px rgba(255,107,53,0.2)',
                  }}
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  Angel One
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
