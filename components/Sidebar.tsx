'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';
import { useSettings } from './SettingsContext';

type NavItem = {
  label: string;
  href: string;
  icon: string;
  children?: { label: string; href: string }[];
};

const nav: NavItem[] = [
  { label: 'Home', href: '/', icon: 'home' },
  {
    label: 'Portfolio',
    href: '/portfolio',
    icon: 'account_balance_wallet',
    children: [
      { label: 'Equity', href: '/portfolio/equity' },
      { label: 'Mutual Funds', href: '/portfolio/mf' },
      { label: 'ETF', href: '/portfolio/etf' },
      { label: 'PPF', href: '/portfolio/ppf' },
      { label: 'Real Estate', href: '/portfolio/real-estate' },
    ],
  },
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Watchlist', href: '/watchlist', icon: 'visibility' },
  { label: 'Activity', href: '/activity', icon: 'history' },
  { label: 'News', href: '/news', icon: 'article' },
];

export function Sidebar() {
  const pathname = usePathname();
  const portfolioActive = pathname.startsWith('/portfolio');
  const [portfolioOpen, setPortfolioOpen] = useState(portfolioActive);
  const { collapsed, mobileOpen, toggleCollapse, closeMobile } = useSidebar();
  const { avatarUrl } = useSettings();

  return (
    <aside
      className={cn(
        'bg-surface-container-lowest border-r border-outline-variant/10 flex flex-col h-full shrink-0 z-50 overflow-y-auto scrollbar-thin',
        'transition-all duration-300 ease-in-out',
        // Mobile: fixed overlay, slides in from left
        'fixed lg:relative',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0',
        // Desktop: full or icon-only
        collapsed ? 'lg:w-16 p-3' : 'w-72 lg:w-64 p-6',
      )}
    >
      {/* ── Logo + header controls ── */}
      <div className={cn('shrink-0 flex', collapsed ? 'flex-col items-center gap-3 mb-4' : 'items-start justify-between mb-10')}>
        {/* Logo */}
        <Link href="/" onClick={closeMobile} className={cn('flex items-center gap-3 group', collapsed && 'justify-center')}>
          <div className="w-10 h-10 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-full h-full">
              <defs>
                <linearGradient id="sova-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#adc6ff" />
                  <stop offset="100%" stopColor="#D4AF37" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="6" fill="#0d1322" />
              <path d="M8 22 L8 10 L16 18 L24 10 L24 22" fill="none" stroke="url(#sova-g)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-black tracking-tighter gradient-text-primary">SOVA</h1>
              <p className="text-[10px] uppercase tracking-widest text-outline font-semibold leading-tight">
                Private Wealth
              </p>
            </div>
          )}
        </Link>

        {/* Controls row */}
        <div className="flex items-center gap-1">
          {/* Mobile close */}
          <button
            onClick={closeMobile}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high/20 transition-colors"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
          {/* Desktop collapse (expand arrow when collapsed) */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high/20 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span
              className="material-symbols-outlined text-sm transition-transform duration-300"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }}
            >
              chevron_left
            </span>
          </button>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 space-y-1">
        {nav.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(item.href + '/');

          if (item.children) {
            return (
              <div key={item.href} className="space-y-1">
                <button
                  onClick={() => {
                    if (collapsed) {
                      toggleCollapse();
                      setPortfolioOpen(true);
                    } else {
                      setPortfolioOpen((v) => !v);
                    }
                  }}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all',
                    collapsed && 'justify-center',
                    isActive
                      ? 'text-gold bg-surface-container-highest/30 shadow-inner-glint'
                      : 'text-outline hover:text-primary hover:bg-surface-container-high/20',
                  )}
                >
                  <span className="material-symbols-outlined text-sm shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span>{item.label}</span>
                      <span
                        className={cn(
                          'material-symbols-outlined ml-auto text-sm transition-transform duration-300',
                          portfolioOpen ? 'rotate-90' : '',
                        )}
                      >
                        chevron_right
                      </span>
                    </>
                  )}
                </button>

                {!collapsed && (
                  <AnimatePresence initial={false}>
                    {portfolioOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="ml-10 space-y-2 py-2 border-l border-outline-variant/20">
                          {item.children.map((child) => {
                            const childActive = pathname === child.href;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={closeMobile}
                                className={cn(
                                  'block pl-4 text-[10px] tracking-widest uppercase font-semibold transition-colors py-0.5',
                                  childActive
                                    ? 'text-primary-fixed-dim'
                                    : 'text-outline hover:text-primary',
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-3 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all relative',
                collapsed && 'justify-center',
                isActive
                  ? 'text-gold bg-surface-container-highest/30'
                  : 'text-outline hover:text-primary hover:bg-surface-container-high/20',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-lg bg-gold/5 ring-1 ring-gold/20"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="material-symbols-outlined text-sm relative shrink-0">{item.icon}</span>
              {!collapsed && <span className="relative">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom: settings + profile ── */}
      <div className="shrink-0 mt-6">
        {collapsed ? (
          /* Icon-only bottom when collapsed */
          <div className="space-y-2">
            <Link
              href="/settings"
              title="Settings"
              className={cn(
                'flex justify-center items-center w-10 h-10 mx-auto rounded-lg transition-all',
                pathname === '/settings'
                  ? 'text-gold bg-surface-container-highest/30'
                  : 'text-outline hover:text-primary hover:bg-surface-container-high/20',
              )}
            >
              <span className="material-symbols-outlined text-sm">settings</span>
            </Link>
            <div className="w-10 h-10 mx-auto rounded-lg bg-gradient-to-br from-primary-container to-primary/40 flex items-center justify-center font-black text-on-primary-container text-sm shadow-glow overflow-hidden">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : 'AT'}
            </div>
          </div>
        ) : (
          /* Full bottom when expanded */
          <>
            <Link
              href="/settings"
              onClick={closeMobile}
              className={cn(
                'flex items-center gap-3 px-3 py-3 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all',
                pathname === '/settings'
                  ? 'text-gold bg-surface-container-highest/30'
                  : 'text-outline hover:text-primary hover:bg-surface-container-high/20',
              )}
            >
              <span className="material-symbols-outlined text-sm">settings</span>
              Settings
            </Link>
            <div className="mt-3 pt-3 border-t border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-container to-primary/40 flex items-center justify-center font-black text-on-primary-container text-sm shadow-glow shrink-0 overflow-hidden">
                {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : 'AT'}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-on-surface truncate">
                  Advik Teotea
                </p>
                <p className="text-[9px] text-outline uppercase tracking-wider">Premium Access</p>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
