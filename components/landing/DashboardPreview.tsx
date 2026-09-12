'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

/* ─── Chrome ────────────────────────────────────────────────────────
   Mirrors the address the terminal actually loads at. Keep only the host —
   NEXT_PUBLIC_APP_URL may carry a protocol, a `www.`, a path or a trailing
   slash, any of which would otherwise show up doubled in the fake URL bar.
   Falls back to the production host when the var isn't set at build time. */
const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL || 'sova.net.in')
  .replace(/^[a-z]+:\/\//i, '')   // protocol
  .replace(/^www\./i, '')         // browsers hide this, so we do too
  .replace(/[/?#].*$/, '');       // path, query, hash
const APP_URL = `${APP_HOST}/home`;

/* ─── Demo data ─────────────────────────────────────────────────── */
const DEMO_NAME  = 'Aarav';
const NET_WORTH  = 48_67_234;
const DAY_CHANGE = 12_430;
const DAY_PCT    = 0.26;
const ALL_TIME   = 8_34_120;
const INVESTED   = 40_33_114;
const EQUITY_VAL = 31_45_000;

const PERF_DATA = [
  { m: 'Nov', v: 3810000 }, { m: 'Dec', v: 3960000 }, { m: 'Jan', v: 4120000 },
  { m: 'Feb', v: 3990000 }, { m: 'Mar', v: 4340000 }, { m: 'Apr', v: 4580000 },
  { m: 'May', v: 4867234 },
];

const ALLOCATION = [
  { label: 'Equity',      value: 31_45_000, color: '#4d8eff' },
  { label: 'Mutual Fund', value: 10_22_400, color: '#4edea3' },
  { label: 'ETF',         value:  4_11_800, color: '#D4AF37' },
  { label: 'PPF',         value:  2_88_034, color: '#c084fc' },
];

const SECTORS = [
  { sector: 'Energy',     weight: 31.4 },
  { sector: 'IT',         weight: 27.1 },
  { sector: 'Financials', weight: 22.8 },
  { sector: 'Consumer',   weight: 11.3 },
  { sector: 'Other',      weight:  7.4 },
];

const MOVERS = [
  { ticker: 'TCS',      name: 'Tata Consultancy',    daily:  2.1 },
  { ticker: 'WIPRO',    name: 'Wipro Ltd.',          daily: -1.3 },
  { ticker: 'RELIANCE', name: 'Reliance Industries', daily:  1.2 },
  { ticker: 'INFY',     name: 'Infosys Ltd.',        daily: -0.8 },
];

const TRADES = [
  { side: 'BUY',  ticker: 'HDFCBANK', qty: 24, price: 1_642.30, when: 'Today · 10:41' },
  { side: 'SELL', ticker: 'WIPRO',    qty: 60, price:   482.15, when: 'Today · 09:58' },
  { side: 'BUY',  ticker: 'TCS',      qty: 12, price: 3_918.00, when: 'Yesterday' },
];

const TICKER = [
  { symbol: 'NIFTY 50',       price: '22,147.20', change:  0.85 },
  { symbol: 'SENSEX',         price: '73,088.33', change:  0.72 },
  { symbol: 'NIFTY MIDCAP',   price: '47,312.15', change:  1.10 },
  { symbol: 'NIFTY SMALLCAP', price: '16,823.40', change: -0.35 },
  { symbol: 'GOLD',           price:  '2,342.10', change:  0.31 },
  { symbol: 'USD/INR',        price:     '83.42', change:  0.05 },
];

const SUGGESTIONS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'WIPRO', 'ICICIBANK', 'AXISBANK', 'TATAMOTORS'];

/* Sidebar mirrors the terminal's nav — only Home is open in the demo. */
const NAV = [
  { label: 'Home',      icon: 'home',                   free: true  },
  { label: 'Portfolio', icon: 'account_balance_wallet', free: false },
  { label: 'Dashboard', icon: 'dashboard',              free: false },
  { label: 'Watchlist', icon: 'visibility',             free: false },
  { label: 'Activity',  icon: 'history',                free: false },
  { label: 'News',      icon: 'article',                free: false },
];

/* Same titles the real TopBar shows for each route. */
const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  Home:      { title: 'Portfolio Intelligence', subtitle: 'Live state of capital across every vertical' },
  Portfolio: { title: 'Portfolio',              subtitle: 'Unified sleeve view across all asset classes' },
  Dashboard: { title: 'Analytics Dashboard',    subtitle: 'Forensic view of performance and exposure' },
  Watchlist: { title: 'Watchlist',              subtitle: 'Instruments under active surveillance' },
  Activity:  { title: 'Activity Ledger',        subtitle: 'Immutable record of every capital movement' },
  News:      { title: 'Newsroom',               subtitle: 'Market intelligence curated for your book' },
};

function fmt(v: number) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
}

/* Material symbol sized precisely. The shared `.material-symbols-outlined`
   rule pins opsz to 24, which renders visibly heavy and oversized at small
   sizes, so every glyph in the preview gets an explicit box and optical size. */
function Icon({ name, size, className, style }: {
  name: string; size: number; className?: string; style?: React.CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined shrink-0 select-none ${className ?? ''}`}
      style={{
        fontSize: size,
        lineHeight: 1,
        width: size,
        height: size,
        fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size <= 20 ? 20 : 24}`,
        ...style,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

/* ─── Primitives ─────────────────────────────────────────────────── */
function Panel({ children, className = '', pad = 'p-4' }: {
  children: React.ReactNode; className?: string; pad?: string;
}) {
  return (
    <div
      className={`rounded-xl ${pad} ${className}`}
      style={{ background: '#131a2e', border: '1px solid rgba(66,71,84,0.3)' }}
    >
      {children}
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-black uppercase tracking-widest text-outline">{children}</p>;
}

function LockedOverlay({ section }: { section: string }) {
  return (
    <div
      className="absolute inset-0 z-20 px-4"
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(11,17,32,0.65)' }}
    >
      {/* Anchored near the top of the locked region rather than its centre —
          the content below is tall enough that a centred card would sit off
          screen when the reader clicks a locked item. */}
      <div
        className="flex flex-col items-center gap-2.5 mx-auto w-max mt-16 px-6 py-5 rounded-xl text-center"
        style={{
          background: '#0f1526',
          border: '1px solid rgba(66,71,84,0.5)',
          boxShadow: '0 18px 48px -12px rgba(0,0,0,0.7)',
        }}
      >
        <Icon name="lock" size={20} className="text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">{section}</p>
        <p className="text-[10px] font-semibold text-outline max-w-[190px] leading-relaxed">
          Free to unlock — create an account to open this section.
        </p>
        <Link
          href="/signup"
          className="mt-1 flex items-center px-3.5 h-7 rounded-lg text-[9px] font-black uppercase tracking-widest transition-transform hover:scale-[1.03]"
          style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42' }}
        >
          Sign up free
        </Link>
      </div>
    </div>
  );
}

/* KPI tile — mirrors components/ui/KPICard */
function KPI({ label, value, sub, delta, color, icon }: {
  label: string; value: string; sub?: string; delta?: number; color?: string; icon: string;
}) {
  return (
    <Panel>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-outline">{label}</p>
        <Icon name={icon} size={14} className="opacity-40" style={{ color: color || '#8c909f' }} />
      </div>
      <p className="text-lg font-black tracking-tight leading-none" style={{ color: color || '#dde2f8' }}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {delta !== undefined && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black tabular-nums"
            style={{
              background: delta >= 0 ? 'rgba(78,222,163,0.12)' : 'rgba(255,178,183,0.12)',
              color: delta >= 0 ? '#4edea3' : '#ffb2b7',
            }}
          >
            <Icon name={delta >= 0 ? 'arrow_upward' : 'arrow_downward'} size={9} />
            {Math.abs(delta).toFixed(2)}%
          </span>
        )}
        {sub && <span className="text-[9px] font-bold uppercase tracking-widest text-outline">{sub}</span>}
      </div>
    </Panel>
  );
}

function SearchBar() {
  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const suggestions = SUGGESTIONS.filter((s) => s.includes(query.toUpperCase())).slice(0, 4);

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 rounded-lg pl-2.5 pr-2 h-8 transition-colors"
        style={{
          background: 'rgba(51,57,74,0.3)',
          border: `1px solid ${focused ? 'rgba(77,142,255,0.4)' : 'transparent'}`,
        }}
      >
        <Icon name="search" size={14} className="text-outline" />
        <input
          className="flex-1 min-w-0 bg-transparent text-[11px] font-semibold text-on-surface placeholder:text-outline/60 outline-none"
          placeholder="Global Ledger Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          aria-label="Search the demo ledger"
        />
        <span
          className="hidden xl:block text-[8px] font-bold uppercase tracking-widest text-outline px-1.5 py-0.5 rounded shrink-0"
          style={{ background: 'rgba(25,31,47,0.7)' }}
        >
          ⌘K
        </span>
      </div>
      {focused && query.length > 0 && (
        <div
          className="absolute top-full mt-1 left-0 right-0 rounded-lg py-1 z-30"
          style={{
            background: '#131a2e',
            border: '1px solid rgba(66,71,84,0.5)',
            boxShadow: '0 12px 32px -8px rgba(0,0,0,0.7)',
          }}
        >
          {suggestions.length > 0 ? suggestions.map((s) => (
            <button
              key={s}
              className="w-full px-3 py-2 text-left text-[11px] font-bold text-on-surface hover:bg-surface-container-highest/30 flex items-center gap-2"
              onMouseDown={() => { setQuery(s); setFocused(false); }}
            >
              <Icon name="trending_up" size={12} className="text-outline" />
              {s}
              <span className="ml-auto text-[9px] text-outline">NSE</span>
            </button>
          )) : (
            <p className="px-3 py-2 text-[10px] font-semibold text-outline">No instruments match that.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AddTradeRow() {
  const [open, setOpen]     = useState(false);
  const [ticker, setTicker] = useState('');
  const [qty, setQty]       = useState('');
  const [price, setPrice]   = useState('');
  const [added, setAdded]   = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setAdded(true);
    setTimeout(() => {
      setOpen(false); setAdded(false); setTicker(''); setQty(''); setPrice('');
    }, 1600);
  }

  const wrap  = 'flex items-center rounded-lg px-2 focus-within:ring-1 focus-within:ring-primary/40';
  const ws    = { background: '#1a2035', border: '1px solid #2f3445' };
  const input = 'bg-transparent py-1.5 text-[11px] text-on-surface placeholder:text-outline/50 outline-none w-full';

  if (added)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-secondary shrink-0"
        style={{ background: 'rgba(78,222,163,0.08)', border: '1px solid rgba(78,222,163,0.2)' }}
      >
        <Icon name="check_circle" size={13} />
        Trade logged
      </motion.div>
    );

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-[1.03] shrink-0"
        style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42' }}
      >
        <Icon name="add" size={13} />
        <span className="hidden sm:inline">New Trade</span>
      </button>
    );

  return (
    <motion.form
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={submit}
      className="flex items-center gap-1.5 flex-wrap justify-end"
    >
      <div className={wrap} style={ws}>
        <input className={input} style={{ width: 64 }} placeholder="Ticker" value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())} required />
      </div>
      <div className={wrap} style={ws}>
        <input className={input} style={{ width: 42 }} placeholder="Qty" type="number" value={qty}
          onChange={(e) => setQty(e.target.value)} required />
      </div>
      <div className={wrap} style={ws}>
        <input className={input} style={{ width: 58 }} placeholder="Price" type="number" value={price}
          onChange={(e) => setPrice(e.target.value)} required />
      </div>
      <button type="submit"
        className="px-2.5 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-secondary"
        style={{ background: 'rgba(78,222,163,0.1)', border: '1px solid rgba(78,222,163,0.25)' }}>
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cancel"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-outline"
        style={{ background: '#1e2538' }}>
        <Icon name="close" size={13} />
      </button>
    </motion.form>
  );
}

/* Donut mirroring charts/AllocationDonut */
function Donut() {
  const total = ALLOCATION.reduce((s, a) => s + a.value, 0);
  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
          {ALLOCATION.map((a) => {
            const len = (a.value / total) * C;
            const arc = (
              <circle
                key={a.label}
                cx="50" cy="50" r={R}
                fill="none"
                stroke={a.color}
                strokeWidth="9"
                strokeDasharray={`${Math.max(len - 2, 0)} ${C - Math.max(len - 2, 0)}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return arc;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-outline">Total</p>
          <p className="text-[11px] font-black text-on-surface leading-tight">{fmt(total)}</p>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {ALLOCATION.map((a) => (
          <div key={a.label} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} />
            <span className="text-[10px] font-bold text-on-surface-variant truncate">{a.label}</span>
            <span className="ml-auto text-[10px] font-black text-outline tabular-nums shrink-0">
              {((a.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorBars() {
  return (
    <div className="space-y-2.5">
      {SECTORS.map((s) => (
        <div key={s.sector}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-on-surface-variant">{s.sector}</span>
            <span className="text-[10px] font-black text-outline tabular-nums">{s.weight.toFixed(1)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(47,52,69,0.6)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${s.weight}%`, background: 'linear-gradient(90deg, #4d8eff, #adc6ff)' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────────────── */
export default function DashboardPreview() {
  const [activeNav, setActiveNav] = useState('Home');
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.08 });

  const meta = PAGE_META[activeNav];
  const isLocked = !NAV.find((n) => n.label === activeNav)?.free;

  return (
    <section id="features" className="py-20 px-4 md:px-6 relative">
      {/* Section header */}
      <div ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 max-w-xl mx-auto"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-outline mb-3">Live preview</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-on-surface mb-4">
            See the terminal in action
          </h2>
          <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
            This is the real Home screen, running on demo numbers. Search an instrument, log a trade,
            click through the sidebar — the rest opens the moment you sign up.
          </p>
        </motion.div>
      </div>

      {/* Framed preview */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-5xl mx-auto rounded-2xl overflow-hidden"
        style={{
          border: '1px solid rgba(66,71,84,0.5)',
          background: '#0b1120',
          boxShadow: '0 40px 120px -20px rgba(0,0,0,0.8)',
        }}
      >
        {/* Browser chrome */}
        <div
          className="flex items-center gap-2 px-3 sm:px-4 h-9"
          style={{ background: '#070d1a', borderBottom: '1px solid rgba(66,71,84,0.4)' }}
        >
          <div className="flex gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-tertiary/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-gold/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-secondary/50" />
          </div>
          <div
            className="flex-1 min-w-0 mx-2 sm:mx-3 h-[22px] rounded-md flex items-center justify-center gap-1.5 px-3"
            style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
          >
            <Icon name="lock" size={9} className="text-secondary/70" />
            <span className="text-[9px] text-outline font-semibold truncate">{APP_URL}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0 text-outline/40">
            <Icon name="refresh" size={12} />
            <Icon name="more_vert" size={12} />
          </div>
        </div>

        {/* Market ticker — the terminal's top strip */}
        <div
          className="ticker-wrap h-7 flex items-center"
          style={{ background: '#080e1d', borderBottom: '1px solid rgba(66,71,84,0.3)' }}
        >
          <div className="flex w-max animate-ticker" style={{ animationDuration: '45s' }}>
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={`${t.symbol}-${i}`} className="flex items-center gap-1.5 px-4 whitespace-nowrap">
                <span className="text-[8px] font-black uppercase tracking-widest text-outline">{t.symbol}</span>
                <span className="text-[9px] font-bold text-on-surface-variant tabular-nums">{t.price}</span>
                <span
                  className="text-[8px] font-black tabular-nums"
                  style={{ color: t.change >= 0 ? '#4edea3' : '#ffb2b7' }}
                >
                  {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* App body: sidebar + main */}
        <div className="flex items-stretch">
          {/* Sidebar — matches the terminal's nav */}
          <aside
            className="hidden md:flex flex-col shrink-0 w-[168px] p-3"
            style={{ background: '#080e1d', borderRight: '1px solid rgba(66,71,84,0.25)' }}
          >
            <div className="flex items-center gap-2 px-1.5 mt-1 mb-5">
              <img src="/sovalogo.svg" alt="" className="w-6 h-6 object-contain shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-black tracking-tighter gradient-text-primary leading-none">SOVA</p>
                <p className="text-[7px] font-semibold uppercase tracking-widest text-outline leading-tight">
                  Private Wealth
                </p>
              </div>
            </div>

            <nav className="space-y-0.5">
              {NAV.map((item) => {
                const active = activeNav === item.label;
                return (
                  <button
                    key={item.label}
                    onClick={() => setActiveNav(item.label)}
                    className={`w-full flex items-center gap-2 px-2 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                      active
                        ? 'text-primary-fixed-dim bg-primary/10'
                        : 'text-outline hover:text-on-surface hover:bg-surface-container-highest/20'
                    }`}
                  >
                    <Icon name={item.icon} size={14} />
                    <span className="truncate">{item.label}</span>
                    {!item.free && <Icon name="lock" size={9} className="ml-auto opacity-40" />}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 space-y-0.5" style={{ borderTop: '1px solid rgba(66,71,84,0.2)' }}>
              <div className="flex items-center gap-2 px-2 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-outline">
                <Icon name="settings" size={14} />
                Settings
              </div>
              <div className="flex items-center gap-2 px-2 h-9">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black shrink-0"
                  style={{ background: 'rgba(77,142,255,0.15)', color: '#adc6ff' }}
                >
                  AM
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-on-surface truncate leading-tight">{DEMO_NAME} M.</p>
                  <p className="text-[7px] font-bold uppercase tracking-widest text-outline leading-tight">Demo</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main column */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Top bar */}
            <div
              className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(66,71,84,0.25)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="md:hidden text-outline"><Icon name="menu" size={16} /></span>
                <div className="min-w-0">
                  <motion.p
                    key={meta.title}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-[13px] font-extrabold tracking-tighter text-on-surface truncate leading-tight"
                  >
                    {meta.title}
                  </motion.p>
                  <p className="hidden sm:block text-[8px] font-semibold uppercase tracking-widest text-outline truncate">
                    {meta.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden lg:block w-48"><SearchBar /></div>
                <div
                  className="relative hidden sm:flex w-8 h-8 items-center justify-center rounded-lg text-outline"
                  style={{ background: 'rgba(51,57,74,0.3)' }}
                >
                  <Icon name="notifications" size={14} />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-tertiary" />
                </div>
                <AddTradeRow />
              </div>
            </div>

            {/* Content */}
            <div className="relative flex-1 p-3 sm:p-4">
              {/* Morning brief */}
              <div
                className="relative rounded-xl overflow-hidden p-4 sm:p-5 mb-3"
                style={{ background: 'linear-gradient(135deg, #131a2e 0%, #182238 50%, #131a2e 100%)' }}
              >
                <div
                  className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
                  style={{ background: 'rgba(77,142,255,0.10)', filter: 'blur(48px)' }}
                />
                <div
                  className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full pointer-events-none"
                  style={{ background: 'rgba(212,175,55,0.06)', filter: 'blur(48px)' }}
                />
                <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-[0.32em] text-gold mb-1.5">
                      ⟡ SOVA Ledger · Morning Brief
                    </p>
                    <p className="text-xl sm:text-2xl font-black tracking-tighter leading-none text-on-surface">
                      Good morning, <span className="gradient-text-gold">{DEMO_NAME}</span>.
                    </p>
                    <p className="text-[10px] font-medium text-on-surface-variant mt-2">
                      Your book is <span className="font-bold text-secondary">up {DAY_PCT.toFixed(2)}%</span>{' '}
                      on the day — {fmt(DAY_CHANGE)} net movement.
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <span
                      className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest text-on-surface"
                      style={{ background: 'rgba(51,57,74,0.5)' }}
                    >
                      <Icon name="analytics" size={13} />
                      Analytics
                    </span>
                    <span
                      className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest"
                      style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42' }}
                    >
                      <Icon name="bolt" size={13} />
                      Rebalance
                    </span>
                  </div>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <KPI label="Net Worth"     value={fmt(NET_WORTH)}  icon="diamond"     sub={`Equity ${fmt(EQUITY_VAL)}`} />
                <KPI label="Day Change"    value={fmt(DAY_CHANGE)} icon="trending_up" color="#4edea3" delta={DAY_PCT} sub="Equity sleeve" />
                <KPI label="All-Time Gain" value={fmt(ALL_TIME)}   icon="insights"    color="#4edea3" sub={`on ${fmt(INVESTED)} invested`} />
              </div>

              {/* Performance */}
              <Panel className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <PanelLabel>Portfolio Performance · 6M</PanelLabel>
                  <div className="flex gap-1">
                    {['1M', '6M', '1Y', 'ALL'].map((r) => (
                      <span
                        key={r}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                          r === '6M' ? 'text-primary-fixed-dim bg-primary/10' : 'text-outline'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={116}>
                  <AreaChart data={PERF_DATA} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sovaPreviewStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#4d8eff" />
                        <stop offset="100%" stopColor="#4edea3" />
                      </linearGradient>
                      <linearGradient id="sovaPreviewFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4d8eff" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#4d8eff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="m"
                      tick={{ fontSize: 8, fill: '#8c909f', fontFamily: 'Manrope', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide domain={['dataMin - 200000', 'dataMax + 100000']} />
                    <Tooltip
                      contentStyle={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.5)', borderRadius: 8, fontSize: 10, fontFamily: 'Manrope' }}
                      itemStyle={{ color: '#adc6ff' }}
                      labelStyle={{ color: '#8c909f', fontWeight: 'bold' }}
                      formatter={(v: number) => [fmt(v), 'Net worth']}
                    />
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke="url(#sovaPreviewStroke)"
                      strokeWidth={2}
                      fill="url(#sovaPreviewFill)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>

              {/* Allocation + sector exposure */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-3">
                <Panel className="lg:col-span-3">
                  <div className="mb-3"><PanelLabel>Asset Allocation</PanelLabel></div>
                  <Donut />
                </Panel>
                <Panel className="lg:col-span-2">
                  <div className="mb-3"><PanelLabel>Sector Exposure</PanelLabel></div>
                  <SectorBars />
                </Panel>
              </div>

              {/* Movers + trades */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Panel pad="p-0">
                  <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(66,71,84,0.25)' }}>
                    <PanelLabel>Top Movers Today</PanelLabel>
                  </div>
                  {MOVERS.map((m) => (
                    <div
                      key={m.ticker}
                      className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-surface-container-highest/10 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-on-surface leading-tight">{m.ticker}</p>
                        <p className="text-[8px] font-semibold text-outline truncate leading-tight">{m.name}</p>
                      </div>
                      <span className={`text-[10px] font-black tabular-nums shrink-0 ${m.daily >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                        {m.daily >= 0 ? '+' : ''}{m.daily.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </Panel>

                <Panel pad="p-0">
                  <div
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderBottom: '1px solid rgba(66,71,84,0.25)' }}
                  >
                    <PanelLabel>Recent Trades &amp; Activity</PanelLabel>
                    <span className="text-[8px] font-black uppercase tracking-widest text-outline">View Ledger →</span>
                  </div>
                  {TRADES.map((t) => (
                    <div
                      key={`${t.ticker}-${t.when}`}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container-highest/10 transition-colors"
                    >
                      <span
                        className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0"
                        style={{
                          background: t.side === 'BUY' ? 'rgba(78,222,163,0.12)' : 'rgba(255,178,183,0.12)',
                          color: t.side === 'BUY' ? '#4edea3' : '#ffb2b7',
                        }}
                      >
                        {t.side}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-on-surface leading-tight truncate">{t.ticker}</p>
                        <p className="text-[8px] font-semibold text-outline leading-tight">{t.when}</p>
                      </div>
                      <p className="ml-auto text-[10px] font-black text-on-surface tabular-nums shrink-0">
                        {t.qty} × ₹{t.price.toLocaleString('en-IN')}
                      </p>
                    </div>
                  ))}
                </Panel>
              </div>

              {/* Terminal footer line */}
              <p className="text-center text-[8px] font-bold uppercase tracking-[0.3em] text-outline mt-4">
                ⟡ SOVA Terminal · {fmt(NET_WORTH)} under management · Powered by Kite Connect
              </p>

              {isLocked && <LockedOverlay section={meta.title} />}
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
          style={{ background: '#070d1a', borderTop: '1px solid rgba(66,71,84,0.3)' }}
        >
          <p className="text-[10px] font-semibold text-outline hidden sm:block">
            Demo data · your own numbers stay private to your account
          </p>
          <Link
            href="/signup"
            className="flex items-center gap-1.5 px-4 h-7 rounded-lg text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42' }}
          >
            Get started
            <Icon name="arrow_forward" size={13} style={{ color: '#001a42' }} />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
