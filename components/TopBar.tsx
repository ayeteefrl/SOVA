'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SearchModal } from '@/components/SearchModal';
import { TradeModal } from '@/components/TradeModal';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { useSidebar } from '@/components/SidebarContext';
import { useHoldings } from '@/components/HoldingsContext';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Portfolio Intelligence', subtitle: 'Live state of capital across every vertical' },
  '/portfolio': { title: 'Portfolio', subtitle: 'Unified sleeve view across all asset classes' },
  '/portfolio/etf': { title: 'ETF Sleeve', subtitle: 'Passive instruments and thematic baskets' },
  '/portfolio/mf': { title: 'Mutual Fund Sleeve', subtitle: 'Actively managed positions and SIPs' },
  '/portfolio/equity': { title: 'Direct Equity', subtitle: 'Single-stock conviction positions' },
  '/portfolio/real-estate': { title: 'Real Estate', subtitle: 'Physical property holdings and yields' },
  '/portfolio/ppf': { title: 'PPF', subtitle: 'Public Provident Fund — long-term tax-free corpus' },
  '/dashboard': { title: 'Analytics Dashboard', subtitle: 'Forensic view of performance and exposure' },
  '/watchlist': { title: 'Watchlist', subtitle: 'Instruments under active surveillance' },
  '/activity': { title: 'Activity Ledger', subtitle: 'Immutable record of every capital movement' },
  '/news': { title: 'Newsroom', subtitle: 'Market intelligence curated for your book' },
  '/settings': { title: 'Settings', subtitle: 'Terminal preferences and access' },
};

export function TopBar() {
  const pathname = usePathname();
  const meta = pageTitles[pathname] ?? { title: 'Sova', subtitle: '' };
  const [searchOpen, setSearchOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { toggleMobile } = useSidebar();
  const { refresh, isLoading } = useHoldings();

  function handleRefresh() {
    refresh();
    window.dispatchEvent(new Event('sova:refresh'));
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setTradeOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <div className="flex justify-between items-center gap-3 px-4 md:px-8 py-4 md:py-5 border-b border-outline-variant/5">
        {/* Left: hamburger (mobile) + page title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleMobile}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-low text-outline hover:text-primary transition-colors shrink-0"
            aria-label="Open menu"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
          <div className="min-w-0">
            <motion.h2
              key={meta.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="text-lg md:text-2xl font-extrabold tracking-tighter text-on-surface truncate"
            >
              {meta.title}
            </motion.h2>
            <motion.p
              key={meta.subtitle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="text-[10px] md:text-[11px] text-outline font-semibold uppercase tracking-widest mt-0.5 truncate hidden sm:block"
            >
              {meta.subtitle}
            </motion.p>
          </div>
        </div>

        {/* Right: search + notifications + trade */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Full search bar — hidden on small screens */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden lg:flex items-center gap-2 bg-surface-container-highest/30 hover:bg-surface-container-highest/50 rounded-lg pl-3 pr-3 py-2 w-64 xl:w-72 text-left transition-colors group"
          >
            <span className="material-symbols-outlined text-outline text-lg group-hover:text-primary-fixed-dim transition-colors">
              search
            </span>
            <span className="flex-1 text-xs text-outline/70 font-semibold">
              Global Ledger Search…
            </span>
            <span className="text-[9px] font-bold text-outline uppercase tracking-widest bg-surface-container/70 px-1.5 py-0.5 rounded">
              ⌘K
            </span>
          </button>

          {/* Icon-only search — visible on small/medium screens */}
          <button
            onClick={() => setSearchOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-low text-outline hover:text-primary transition-colors"
            aria-label="Search"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-low text-outline hover:text-primary transition-colors disabled:opacity-40"
            aria-label="Refresh data"
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-transform ${isLoading ? 'animate-spin' : ''}`}
            >
              refresh
            </span>
          </button>

          {/* Notification bell */}
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-low text-outline hover:text-gold transition-colors relative"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
          </button>

          {/* New Trade */}
          <button
            onClick={() => setTradeOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 md:px-4 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow hover:shadow-lg hover:scale-[1.02] transition-all"
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            <span className="hidden md:inline">New Trade</span>
          </button>
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <TradeModal open={tradeOpen} onClose={() => setTradeOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
