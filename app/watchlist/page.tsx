'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Sparkline } from '@/components/charts/Sparkline';
import { DeltaChip } from '@/components/ui/Chip';
import { watchlist as defaultWatchlist } from '@/lib/data';
import { cn, formatINR, formatDelta } from '@/lib/utils';
import { Segmented } from '@/components/ui/Segmented';

const views = ['GRID', 'LIST'] as const;
type View = (typeof views)[number];

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  price: number;
  change: number;
  sparkline: number[];
  marketCap: string;
  pe: number;
  notes?: string;
}

interface WatchlistGroup {
  id: string;
  name: string;
  items: WatchlistItem[];
}

const DEFAULT_LISTS: WatchlistGroup[] = [
  {
    id: 'main',
    name: 'Main Watchlist',
    items: defaultWatchlist.map((w) => ({ ...w })),
  },
];

function loadLists(): WatchlistGroup[] {
  try {
    const raw = localStorage.getItem('sova-watchlists');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_LISTS;
}

function saveLists(lists: WatchlistGroup[]) {
  try { localStorage.setItem('sova-watchlists', JSON.stringify(lists)); } catch { /* ignore */ }
}

interface SearchQuote {
  symbol: string;
  shortName: string;
  exchange: string;
  quoteType: string;
}

const MOCK_SEARCH: SearchQuote[] = [
  { symbol: 'RELIANCE.NS', shortName: 'Reliance Industries', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'HDFCBANK.NS', shortName: 'HDFC Bank', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'TCS.NS', shortName: 'Tata Consultancy Services', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'INFY.NS', shortName: 'Infosys', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'ICICIBANK.NS', shortName: 'ICICI Bank', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'BAJFINANCE.NS', shortName: 'Bajaj Finance', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'ASIANPAINT.NS', shortName: 'Asian Paints', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'LT.NS', shortName: 'Larsen & Toubro', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'ZOMATO.NS', shortName: 'Zomato', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'NYKAA.NS', shortName: 'FSN E-Commerce Ventures (Nykaa)', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'DMART.NS', shortName: 'Avenue Supermarts (DMart)', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'IRCTC.NS', shortName: 'Indian Railway Catering & Tourism', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'POLYCAB.NS', shortName: 'Polycab India', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'ADANIENT.NS', shortName: 'Adani Enterprises', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'WIPRO.NS', shortName: 'Wipro', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'HINDUNILVR.NS', shortName: 'Hindustan Unilever', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'MARUTI.NS', shortName: 'Maruti Suzuki India', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'TITAN.NS', shortName: 'Titan Company', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'TATAMOTORS.NS', shortName: 'Tata Motors', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'SUNPHARMA.NS', shortName: 'Sun Pharmaceutical Industries', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'KOTAKBANK.NS', shortName: 'Kotak Mahindra Bank', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'AXISBANK.NS', shortName: 'Axis Bank', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'SBIN.NS', shortName: 'State Bank of India', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'ONGC.NS', shortName: 'Oil & Natural Gas Corporation', exchange: 'NSE', quoteType: 'EQUITY' },
  { symbol: 'NIFTYBEES.NS', shortName: 'Nippon India Nifty BeES', exchange: 'NSE', quoteType: 'ETF' },
  { symbol: 'GOLDBEES.NS', shortName: 'SBI Gold ETF', exchange: 'NSE', quoteType: 'ETF' },
  { symbol: 'MON100.NS', shortName: 'Motilal Oswal Nasdaq 100 ETF', exchange: 'NSE', quoteType: 'ETF' },
];

// ── Add Ticker Modal ──────────────────────────────────────────────────────────
function AddTickerModal({
  lists,
  onAdd,
  onClose,
}: {
  lists: WatchlistGroup[];
  onAdd: (listId: string, item: WatchlistItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchQuote | null>(null);
  const [targetList, setTargetList] = useState(lists[0]?.id ?? 'main');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((v: string) => {
    setQuery(v);
    setSelected(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (v.length < 1) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(v)}`);
        const data = await res.json();
        const quotes: SearchQuote[] = data.quotes ?? [];
        if (quotes.length > 0) {
          setResults(quotes);
        } else {
          // Fallback: filter mock stocks locally
          const q = v.toLowerCase();
          setResults(MOCK_SEARCH.filter(
            (s) => s.symbol.toLowerCase().includes(q) || s.shortName.toLowerCase().includes(q)
          ).slice(0, 8));
        }
      } catch {
        const q = v.toLowerCase();
        setResults(MOCK_SEARCH.filter(
          (s) => s.symbol.toLowerCase().includes(q) || s.shortName.toLowerCase().includes(q)
        ).slice(0, 8));
      }
      setLoading(false);
    }, 300);
  }, []);

  function handleAdd() {
    if (!selected) return;
    const newItem: WatchlistItem = {
      id: `${selected.symbol}-${Date.now()}`,
      ticker: selected.symbol,
      name: selected.shortName,
      price: 0,
      change: 0,
      sparkline: Array.from({ length: 20 }, () => Math.random() * 100 + 50),
      marketCap: '—',
      pe: 0,
    };
    onAdd(targetList, newItem);
    onClose();
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2f3445]/60">
          <h2 className="text-base font-black tracking-tight text-[#dde2f8] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D4AF37] text-base">add_circle</span>
            Add to Watchlist
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Search */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">Search Instrument</label>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder="Search symbol or name — e.g. RELIANCE, TCS"
                autoFocus
                className="w-full rounded-lg px-4 py-3 pr-10 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50"
                style={{ background: '#1a2035', border: '1px solid #2f3445' }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {loading
                  ? <span className="material-symbols-outlined text-base text-[#4d8eff] animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span>
                  : <span className="material-symbols-outlined text-base text-[#424754]">search</span>
                }
              </div>
            </div>

            {/* Results */}
            {results.length > 0 && !selected && (
              <div className="mt-1.5 rounded-xl overflow-hidden shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7)]" style={{ background: '#141c30', border: '1px solid #2f3445' }}>
                {results.slice(0, 6).map((q, i) => (
                  <button
                    key={q.symbol}
                    onClick={() => { setSelected(q); setQuery(q.shortName); setResults([]); }}
                    className={cn('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1e2a42] transition-colors', i > 0 && 'border-t border-[#2f3445]/50')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-black text-[#dde2f8]">{q.symbol}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded text-[#adc6ff] bg-[#adc6ff]/10">{q.quoteType === 'MUTUALFUND' ? 'MF' : q.quoteType}</span>
                      </div>
                      <p className="text-[11px] text-[#8c909f] truncate">{q.shortName}</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#424754]">{q.exchange}</span>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="mt-2 px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: '#4d8eff15', border: '1px solid #4d8eff30' }}>
                <span className="material-symbols-outlined text-sm text-[#4d8eff]">check_circle</span>
                <span className="text-[11px] font-bold text-[#adc6ff]">{selected.symbol}</span>
                <span className="text-[11px] text-[#8c909f] truncate">{selected.shortName}</span>
                <button onClick={() => { setSelected(null); setQuery(''); }} className="ml-auto text-[#8c909f] hover:text-[#ffb2b7]">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}
          </div>

          {/* Watchlist selector */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">Add to Watchlist</label>
            <div className="flex flex-wrap gap-2">
              {lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setTargetList(l.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border',
                    targetList === l.id
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40'
                      : 'bg-[#1e2538] text-[#8c909f] border-[#2f3445]/60 hover:text-[#dde2f8]',
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}
            >Cancel</button>
            <button
              onClick={handleAdd}
              disabled={!selected}
              className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.2)' }}
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Ticker
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Rename Modal ──────────────────────────────────────────────────────────────
function RenameModal({ current, onRename, onClose }: { current: string; onRename: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(current);
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl p-6 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <h2 className="text-sm font-black text-[#dde2f8] mb-4">Rename Watchlist</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { onRename(name); onClose(); } if (e.key === 'Escape') onClose(); }}
          autoFocus
          className="w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 mb-4"
          style={{ background: '#1a2035', border: '1px solid #2f3445' }}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f]" style={{ background: '#1e2538', border: '1px solid #2f3445' }}>Cancel</button>
          <button onClick={() => { onRename(name); onClose(); }} className="flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest" style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42' }}>Save</button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WatchlistPage() {
  const [lists, setLists] = useState<WatchlistGroup[]>(DEFAULT_LISTS);
  const [activeId, setActiveId] = useState('main');
  const [view, setView] = useState<View>('GRID');
  const [showAddTicker, setShowAddTicker] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadLists();
    setLists(loaded);
    if (loaded.length > 0) setActiveId(loaded[0].id);
  }, []);

  function persist(next: WatchlistGroup[]) {
    setLists(next);
    saveLists(next);
  }

  function addList() {
    const id = `list-${Date.now()}`;
    const next = [...lists, { id, name: `Watchlist ${lists.length + 1}`, items: [] }];
    persist(next);
    setActiveId(id);
  }

  function deleteList(id: string) {
    if (lists.length === 1) return;
    const next = lists.filter((l) => l.id !== id);
    persist(next);
    setActiveId(next[0].id);
  }

  function renameList(id: string, name: string) {
    persist(lists.map((l) => l.id === id ? { ...l, name } : l));
  }

  function addItem(listId: string, item: WatchlistItem) {
    persist(lists.map((l) => l.id === listId ? { ...l, items: [...l.items, item] } : l));
  }

  function removeItem(listId: string, itemId: string) {
    persist(lists.map((l) => l.id === listId ? { ...l, items: l.items.filter((i) => i.id !== itemId) } : l));
  }

  const activeList = lists.find((l) => l.id === activeId) ?? lists[0];
  const items = activeList?.items ?? [];

  return (
    <div className="p-8 space-y-6 pb-16">
      {/* Watchlist Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {lists.map((l) => (
          <div key={l.id} className={cn('group flex items-center rounded-xl transition-all', activeId === l.id ? 'bg-surface-container-highest/50' : 'bg-surface-container-highest/20 hover:bg-surface-container-highest/35')}>
            <button
              onClick={() => setActiveId(l.id)}
              className={cn('px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-colors', activeId === l.id ? 'text-gold' : 'text-outline hover:text-on-surface')}
            >
              {l.name}
              <span className="ml-2 text-[9px] font-bold text-outline">({l.items.length})</span>
            </button>
            {activeId === l.id && (
              <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setRenameId(l.id)} title="Rename" className="w-6 h-6 flex items-center justify-center rounded-md text-outline hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                {lists.length > 1 && (
                  <button onClick={() => deleteList(l.id)} title="Delete" className="w-6 h-6 flex items-center justify-center rounded-md text-outline hover:text-tertiary transition-colors">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <button
          onClick={addList}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-outline hover:text-on-surface bg-surface-container-highest/20 hover:bg-surface-container-highest/35 transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New List
        </button>
      </div>

      {/* Main Card */}
      <Card tier="low" className="p-8">
        <SectionHeader
          title={activeList?.name ?? 'Watchlist'}
          subtitle={`${items.length} instrument${items.length !== 1 ? 's' : ''} under surveillance`}
          right={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddTicker(true)}
                className="px-4 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest bg-surface-container-highest/50 text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Add Ticker
              </button>
              <Segmented options={views} value={view} onChange={setView} />
            </div>
          }
          className="mb-8"
        />

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="material-symbols-outlined text-4xl text-outline">visibility_off</span>
            <p className="text-sm font-bold text-outline">No instruments in this watchlist</p>
            <button onClick={() => setShowAddTicker(true)} className="mt-2 px-4 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest text-on-surface bg-surface-container-highest/50 hover:bg-surface-container-highest transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-base">add</span>
              Add Ticker
            </button>
          </div>
        ) : view === 'GRID' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="p-6 rounded-xl bg-surface-container-highest/20 hover:bg-surface-container-highest/40 transition-all cursor-pointer hover:-translate-y-1 ghost-border group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-outline">{w.ticker}</p>
                    <p className="text-sm font-black text-on-surface mt-0.5 truncate">{w.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeItem(activeId, w.id); }}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-outline hover:text-tertiary opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                    <DeltaChip value={w.change} />
                  </div>
                </div>

                <div className="mb-4 h-16 -mx-2">
                  <Sparkline data={w.sparkline} color={w.change >= 0 ? '#4edea3' : '#ffb2b7'} height={64} />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-2xl font-black tracking-tight text-on-surface">{formatINR(w.price, { decimals: 2 })}</p>
                    <p className={cn('text-[10px] font-bold uppercase tracking-widest mt-1', w.change >= 0 ? 'text-secondary' : 'text-tertiary')}>
                      {formatDelta(w.change)} today
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-outline">MCap · PE</p>
                      <p className="text-[11px] font-bold text-on-surface">{w.marketCap}</p>
                      <p className="text-[10px] font-bold text-outline">{w.pe > 0 ? `${w.pe.toFixed(1)}x` : '—'}</p>
                    </div>
                  </div>
                </div>

                {w.notes && (
                  <p className="mt-4 pt-4 border-t border-outline-variant/10 text-[10px] text-on-surface-variant italic">"{w.notes}"</p>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {items.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="grid grid-cols-[1fr_1fr_1fr_0.6fr_0.6fr_auto] gap-6 items-center px-3 py-4 rounded-lg hover:bg-surface-container-highest/30 transition-colors group"
              >
                <div>
                  <p className="text-xs font-black text-on-surface">{w.name}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-outline">{w.ticker}</p>
                </div>
                <div className="-my-1"><Sparkline data={w.sparkline} color={w.change >= 0 ? '#4edea3' : '#ffb2b7'} /></div>
                <p className="text-right text-sm font-black text-on-surface">{formatINR(w.price, { decimals: 2 })}</p>
                <div className="text-right flex justify-end"><DeltaChip value={w.change} /></div>
                <p className="text-right text-[10px] font-bold text-outline">{w.marketCap}</p>
                <button
                  onClick={() => removeItem(activeId, w.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-outline hover:text-tertiary opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <AnimatePresence>
        {showAddTicker && (
          <AddTickerModal lists={lists} onAdd={addItem} onClose={() => setShowAddTicker(false)} />
        )}
        {renameId && (
          <RenameModal
            current={lists.find((l) => l.id === renameId)?.name ?? ''}
            onRename={(name) => renameList(renameId, name)}
            onClose={() => setRenameId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
