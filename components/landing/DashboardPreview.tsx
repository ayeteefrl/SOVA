'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

/* ─── Mock data ─────────────────────────────────────────────────── */
const NET_WORTH   = 48_67_234;
const DAY_CHANGE  = 12_430;
const DAY_PCT     = 0.26;
const ALL_TIME    = 8_34_120;
const EQUITY_VAL  = 31_45_000;

const PERF_DATA = [
  { m: 'Nov', v: 3810000 }, { m: 'Dec', v: 3960000 }, { m: 'Jan', v: 4120000 },
  { m: 'Feb', v: 3990000 }, { m: 'Mar', v: 4340000 }, { m: 'Apr', v: 4580000 },
  { m: 'May', v: 4867234 },
];

const HOLDINGS = [
  { ticker: 'RELIANCE', name: 'Reliance Industries', value: 8_45_320, daily:  1.2 },
  { ticker: 'INFY',     name: 'Infosys Ltd.',        value: 6_23_100, daily: -0.8 },
  { ticker: 'HDFC',     name: 'HDFC Bank',           value: 5_11_480, daily:  0.4 },
  { ticker: 'TCS',      name: 'Tata Consultancy',    value: 4_82_200, daily:  2.1 },
  { ticker: 'WIPRO',    name: 'Wipro Ltd.',           value: 2_84_630, daily: -1.3 },
];

const SUGGESTIONS = ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'WIPRO', 'ICICIBANK', 'AXISBANK', 'TATAMOTORS'];
const TABS = ['Overview', 'Portfolio', 'Watchlist', 'Analytics', 'News'];

function fmt(v: number) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
}

/* ─── Sub-components ─────────────────────────────────────────────── */
function LockedOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
      style={{ backdropFilter: 'blur(5px)', background: 'rgba(13,19,34,0.6)' }}>
      <div className="flex flex-col items-center gap-2 px-5 py-3 rounded-xl"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.5)' }}>
        <span className="material-symbols-outlined text-xl text-primary">lock</span>
        <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Sign up to unlock</p>
      </div>
    </div>
  );
}

function KPI({ label, value, color, icon }: { label: string; value: string; color?: string; icon: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#131a2e', border: '1px solid rgba(66,71,84,0.3)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="material-symbols-outlined text-xs text-outline">{icon}</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-outline">{label}</span>
      </div>
      <p className="text-base font-black tracking-tight" style={{ color: color || '#dde2f8' }}>{value}</p>
    </div>
  );
}

function SearchBar() {
  const [query, setQuery]   = useState('');
  const [focused, setFocused] = useState(false);
  const suggestions = SUGGESTIONS.filter(s => s.includes(query.toUpperCase())).slice(0, 4);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg px-3 h-9"
        style={{ background: '#1a2035', border: `1px solid ${focused ? 'rgba(77,142,255,0.4)' : '#2f3445'}` }}>
        <span className="material-symbols-outlined text-sm text-outline">search</span>
        <input className="flex-1 bg-transparent text-xs text-on-surface placeholder:text-outline/40 outline-none"
          placeholder="Search stocks…" value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)} />
      </div>
      {focused && query.length > 0 && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 rounded-lg py-1 z-20"
          style={{ background: '#131a2e', border: '1px solid rgba(66,71,84,0.5)' }}>
          {suggestions.map(s => (
            <button key={s} className="w-full px-3 py-2 text-left text-[11px] font-bold text-on-surface hover:bg-surface-container-highest/30 flex items-center gap-2"
              onMouseDown={() => { setQuery(s); setFocused(false); }}>
              <span className="material-symbols-outlined text-xs text-outline">trending_up</span>
              {s}
              <span className="ml-auto text-[9px] text-outline">NSE</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddTradeRow() {
  const [open, setOpen]   = useState(false);
  const [ticker, setTicker] = useState('');
  const [qty, setQty]     = useState('');
  const [price, setPrice] = useState('');
  const [added, setAdded] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setAdded(true);
    setTimeout(() => { setOpen(false); setAdded(false); setTicker(''); setQty(''); setPrice(''); }, 1600);
  }

  const wrap  = 'flex items-center gap-1.5 rounded-lg px-3 focus-within:ring-1 focus-within:ring-primary/40';
  const ws    = { background: '#1a2035', border: '1px solid #2f3445' };
  const input = 'bg-transparent py-2 text-xs text-on-surface placeholder:text-outline/40 outline-none w-full';

  if (added)
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold text-secondary"
        style={{ background: 'rgba(78,222,163,0.08)', border: '1px solid rgba(78,222,163,0.2)' }}>
        <span className="material-symbols-outlined text-sm">check_circle</span>Trade logged!
      </motion.div>
    );

  if (!open)
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
        style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42' }}>
        <span className="material-symbols-outlined text-xs">add</span>Log Trade
      </button>
    );

  return (
    <motion.form initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit}
      className="flex items-center gap-2 flex-wrap">
      <div className={wrap} style={ws}><input className={input} style={{ width: 68 }} placeholder="Ticker" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} required /></div>
      <div className={wrap} style={ws}><input className={input} style={{ width: 46 }} placeholder="Qty" type="number" value={qty} onChange={e => setQty(e.target.value)} required /></div>
      <div className={wrap} style={ws}><input className={input} style={{ width: 62 }} placeholder="Price" type="number" value={price} onChange={e => setPrice(e.target.value)} required /></div>
      <button type="submit" className="px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-secondary" style={{ background: 'rgba(78,222,163,0.1)', border: '1px solid rgba(78,222,163,0.25)' }}>Add</button>
      <button type="button" onClick={() => setOpen(false)} className="px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-outline" style={{ background: '#1e2538' }}>Cancel</button>
    </motion.form>
  );
}

/* ─── Main ──────────────────────────────────────────────────────── */
export default function DashboardPreview() {
  const [activeTab, setActiveTab] = useState('Overview');
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.08 });

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
            Interact with a real demo — log a trade, search a stock, track your net worth.
            Other sections unlock after sign-up.
          </p>
        </motion.div>
      </div>

      {/* Framed preview — visible immediately, animates in on scroll */}
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
        <div className="flex items-center gap-2 px-4 h-9"
          style={{ background: '#070d1a', borderBottom: '1px solid rgba(66,71,84,0.4)' }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-tertiary/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-gold/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-secondary/50" />
          </div>
          <div className="flex-1 mx-3 h-5 rounded-md flex items-center px-3 gap-2"
            style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}>
            <span className="material-symbols-outlined text-[10px] text-outline">lock</span>
            <span className="text-[9px] text-outline font-semibold">sova.app/home</span>
          </div>
        </div>

        {/* App header */}
        <div className="flex items-center justify-between px-4 h-11 gap-2"
          style={{ background: '#0b1120', borderBottom: '1px solid rgba(66,71,84,0.3)' }}>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-5 h-5"><img src="/sovalogo.svg" alt="" className="w-full h-full object-contain" /></div>
            <span className="text-xs font-black tracking-tighter gradient-text-primary">SOVA</span>
          </div>
          <div className="hidden sm:block flex-1 max-w-[180px]">
            <SearchBar />
          </div>
          <AddTradeRow />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 h-10 overflow-x-auto"
          style={{ background: '#0b1120', borderBottom: '1px solid rgba(66,71,84,0.3)' }}>
          {TABS.map(tab => {
            const isLocked = tab !== 'Overview';
            return (
              <div key={tab} className="relative group shrink-0">
                <button onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1 px-3 h-8 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap rounded-lg ${
                    activeTab === tab ? 'text-primary-fixed-dim bg-primary/10' : 'text-outline hover:text-on-surface hover:bg-surface-container-highest/20'
                  }`}>
                  {tab}
                  {isLocked && <span className="material-symbols-outlined opacity-30" style={{ fontSize: 9 }}>lock</span>}
                </button>
                {isLocked && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30">
                    <div className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold whitespace-nowrap text-on-surface-variant"
                      style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.6)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                      Sign in to unlock
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="relative min-h-[380px] p-5">
          {activeTab === 'Overview' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <KPI label="Net Worth"    value={fmt(NET_WORTH)}                             icon="diamond"     />
                <KPI label="Day Change"   value={`+${fmt(DAY_CHANGE)} (+${DAY_PCT}%)`}       icon="trending_up" color="#4edea3" />
                <KPI label="All-Time Gain" value={`+${fmt(ALL_TIME)}`}                       icon="insights"    color="#4edea3" />
                <KPI label="Equity"       value={fmt(EQUITY_VAL)}                            icon="savings"     color="#D4AF37" />
              </div>

              {/* Chart */}
              <div className="rounded-xl p-4" style={{ background: '#131a2e', border: '1px solid rgba(66,71,84,0.3)' }}>
                <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-3">Portfolio Performance · 6M</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={PERF_DATA} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#4d8eff" />
                        <stop offset="100%" stopColor="#4edea3" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#8c909f', fontFamily: 'Manrope' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.5)', borderRadius: 8, fontSize: 10, fontFamily: 'Manrope' }}
                      itemStyle={{ color: '#adc6ff' }}
                      labelStyle={{ color: '#8c909f', fontWeight: 'bold' }}
                      formatter={(v: number) => [fmt(v), 'Value']}
                    />
                    <Line type="monotone" dataKey="v" stroke="url(#lg)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Holdings */}
              <div className="rounded-xl overflow-hidden" style={{ background: '#131a2e', border: '1px solid rgba(66,71,84,0.3)' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(66,71,84,0.25)' }}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline">Top Holdings</p>
                </div>
                {HOLDINGS.map(h => (
                  <div key={h.ticker} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-container-highest/10 transition-colors gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-on-surface">{h.ticker}</p>
                      <p className="text-[9px] text-outline font-semibold truncate">{h.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-black text-on-surface">{fmt(h.value)}</p>
                      <p className={`text-[9px] font-bold ${h.daily >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                        {h.daily >= 0 ? '+' : ''}{h.daily}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative h-80">
              <div className="h-full rounded-xl overflow-hidden opacity-20 pointer-events-none select-none">
                <div className="p-4 space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 rounded-lg bg-surface-container-highest/40" />
                  ))}
                </div>
              </div>
              <LockedOverlay />
            </div>
          )}
        </div>

        {/* Bottom strip */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
          style={{ background: '#070d1a', borderTop: '1px solid rgba(66,71,84,0.3)' }}>
          <p className="text-[10px] text-outline font-semibold hidden sm:block">Demo data · Sign up to connect your real portfolio</p>
          <Link href="/signup"
            className="flex items-center gap-1.5 px-4 h-7 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42' }}>
            Get started
            <span className="material-symbols-outlined text-xs" style={{ color: '#001a42' }}>arrow_forward</span>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
