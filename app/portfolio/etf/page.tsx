'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR, cn } from '@/lib/utils';
import { createPortal } from 'react-dom';


type ETF = {
  id: string;
  name: string;
  ticker: string;
  units: number;
  avg_cost: number;
  current_price?: number;
  expense_ratio: number;
  theme?: string;
};

interface SearchQuote {
  symbol: string;
  shortName: string;
  exchange: string;
  quoteType: string;
}

/* ── Shared style helpers ─────────────────────────────────────────── */
const inputCls = 'w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 transition-all';
const inputStyle = { background: '#1a2035', border: '1px solid #2f3445' };
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2';

/* ── Add ETF Modal ─────────────────────────────────────────────────── */
function AddETFModal({ onClose, onSave }: { onClose: () => void; onSave: (etf: Partial<ETF>) => void }) {
  const [form, setForm] = useState({
    name: '', ticker: '', units: '', avg_cost: '',
    current_price: '', expense_ratio: '', theme: '',
  });
  const [errors, setErrors] = useState({ units: '', avg_cost: '' });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Ticker search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchQuote[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketPriceLoading, setMarketPriceLoading] = useState(false);
  const [marketPriceChange, setMarketPriceChange] = useState<number | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleTickerInput(value: string) {
    setSearchQuery(value);
    setForm((f) => ({ ...f, ticker: value, name: f.name || '' }));
    setMarketPrice(null);
    setMarketPriceChange(null);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (value.length < 1) { setSearchResults([]); setShowDropdown(false); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        const quotes = (data.quotes ?? []) as SearchQuote[];
        setSearchResults(quotes.filter((q) => ['ETF', 'EQUITY', 'MUTUALFUND'].includes(q.quoteType)));
        setShowDropdown(true);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 320);
  }

  async function fetchMarketPrice(symbol: string) {
    setMarketPriceLoading(true);
    setMarketPrice(null);
    setMarketPriceChange(null);
    try {
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (data.stock?.price != null) {
        setMarketPrice(data.stock.price);
        setMarketPriceChange(data.stock.changePercent ?? null);
        setForm((f) => ({ ...f, current_price: String(data.stock.price) }));
      }
    } catch { /* silent */ }
    setMarketPriceLoading(false);
  }

  function selectQuote(quote: SearchQuote) {
    const ticker = quote.symbol.replace(/\.(NS|BO|BSE|NSE)$/i, '');
    setSearchQuery(ticker);
    setForm((f) => ({ ...f, ticker, name: f.name || quote.shortName }));
    setShowDropdown(false);
    setSearchResults([]);
    fetchMarketPrice(quote.symbol);
  }

  function submit() {
    const errs = { units: '', avg_cost: '' };
    if (!form.units || Number(form.units) <= 0) errs.units = 'Units held is required';
    if (!form.avg_cost || Number(form.avg_cost) <= 0) errs.avg_cost = 'Average cost is required';
    if (errs.units || errs.avg_cost) { setErrors(errs); return; }
    if (!form.name || !form.ticker) return;

    onSave({
      name: form.name,
      ticker: form.ticker.toUpperCase(),
      units: Number(form.units),
      avg_cost: Number(form.avg_cost),
      current_price: form.current_price ? Number(form.current_price) : undefined,
      expense_ratio: Number(form.expense_ratio) || 0,
      theme: form.theme || undefined,
    });
    onClose();
  }

  const bookValue = (Number(form.units) || 0) * (Number(form.avg_cost) || 0);
  const curValue = (Number(form.units) || 0) * (marketPrice ?? (Number(form.current_price) || Number(form.avg_cost) || 0));

  const QUOTE_TYPE_COLOR: Record<string, string> = {
    EQUITY: 'text-[#adc6ff] bg-[#adc6ff]/10',
    ETF: 'text-[#4edea3] bg-[#4edea3]/10',
    MUTUALFUND: 'text-[#D4AF37] bg-[#D4AF37]/10',
  };

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#0f1526] rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#4edea330] to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#2f3445]/60">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#4edea3] text-xl">stacked_line_chart</span>
              Add ETF Holding
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">
              Search by ticker to auto-fill market price
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Ticker search */}
          <div ref={searchRef} className="relative">
            <label className={labelCls}>Ticker Symbol *</label>
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => handleTickerInput(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="e.g. NIFTYBEES, GOLDBEES"
                className={inputCls + ' pr-10'}
                style={inputStyle}
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {searchLoading
                  ? <span className="material-symbols-outlined text-base text-[#4d8eff] animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span>
                  : <span className="material-symbols-outlined text-base text-[#424754]">search</span>
                }
              </div>
            </div>

            {/* Live price badge */}
            {marketPriceLoading && (
              <p className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-[#4d8eff]">
                <span className="material-symbols-outlined text-xs animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span>
                Fetching live price…
              </p>
            )}
            {!marketPriceLoading && marketPrice != null && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1.5 flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit"
                style={{ background: '#1a2035', border: '1px solid #2f3445' }}
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-[#8c909f]">Live</span>
                <span className="text-[12px] font-black text-[#adc6ff]">
                  ₹{marketPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {marketPriceChange != null && (
                  <span className={cn('text-[9px] font-black', marketPriceChange >= 0 ? 'text-[#4edea3]' : 'text-[#ffb2b7]')}>
                    {marketPriceChange >= 0 ? '+' : ''}{marketPriceChange.toFixed(2)}%
                  </span>
                )}
                <span className="text-[9px] text-[#424754]">auto-filled ↓</span>
              </motion.div>
            )}

            {/* Dropdown */}
            <AnimatePresence>
              {showDropdown && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full mt-1.5 rounded-xl overflow-hidden z-[300] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7)]"
                  style={{ background: '#141c30', border: '1px solid #2f3445' }}
                >
                  {searchResults.map((q, i) => (
                    <button
                      key={q.symbol}
                      onMouseDown={() => selectQuote(q)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1e2a42] transition-colors',
                        i > 0 && 'border-t border-[#2f3445]/50'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-black text-[#dde2f8] truncate">{q.symbol}</span>
                          <span className={cn(
                            'text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded',
                            QUOTE_TYPE_COLOR[q.quoteType] ?? 'text-[#8c909f] bg-[#8c909f]/10'
                          )}>{q.quoteType === 'MUTUALFUND' ? 'MF' : q.quoteType}</span>
                        </div>
                        <p className="text-[11px] text-[#8c909f] truncate mt-0.5">{q.shortName}</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#424754] shrink-0">{q.exchange}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ETF Name */}
          <div>
            <label className={labelCls}>ETF Name *</label>
            <input
              type="text"
              placeholder="e.g. Nippon India Nifty BeES ETF"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Units + Avg Cost (required) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Units Held *</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={form.units}
                onChange={(e) => { setForm((f) => ({ ...f, units: e.target.value })); setErrors((er) => ({ ...er, units: '' })); }}
                className={cn(inputCls, errors.units && 'ring-1 ring-[#ffb2b7]/60')}
                style={{ ...inputStyle, ...(errors.units ? { borderColor: '#ffb2b7' } : {}) }}
              />
              {errors.units && <p className="text-[9px] text-[#ffb2b7] font-bold mt-1">{errors.units}</p>}
            </div>
            <div>
              <label className={labelCls}>Avg Cost per Unit (₹) *</label>
              <input
                type="number"
                placeholder="e.g. 250.00"
                value={form.avg_cost}
                onChange={(e) => { setForm((f) => ({ ...f, avg_cost: e.target.value })); setErrors((er) => ({ ...er, avg_cost: '' })); }}
                className={cn(inputCls, errors.avg_cost && 'ring-1 ring-[#ffb2b7]/60')}
                style={{ ...inputStyle, ...(errors.avg_cost ? { borderColor: '#ffb2b7' } : {}) }}
              />
              {errors.avg_cost && <p className="text-[9px] text-[#ffb2b7] font-bold mt-1">{errors.avg_cost}</p>}
            </div>
          </div>

          {/* Current Price + TER */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Current Price (₹)</label>
              <input
                type="number"
                placeholder="Auto-filled from search"
                value={form.current_price}
                onChange={(e) => setForm((f) => ({ ...f, current_price: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>TER / Expense Ratio (%)</label>
              <input
                type="number"
                placeholder="e.g. 0.05"
                value={form.expense_ratio}
                onChange={(e) => setForm((f) => ({ ...f, expense_ratio: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className={labelCls}>Theme / Category</label>
            <input
              type="text"
              placeholder="e.g. Broad Market, Gold, IT"
              value={form.theme}
              onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Value preview */}
          {bookValue > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl flex items-center justify-between"
              style={{ background: '#1a2035', border: '1px solid #2f3445' }}
            >
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8c909f]">Book Value</p>
                <p className="text-[9px] text-[#424754] mt-0.5">
                  {form.units} units × ₹{Number(form.avg_cost).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-[#4edea3]">₹{bookValue.toLocaleString('en-IN')}</p>
                {curValue !== bookValue && (
                  <p className={cn('text-[10px] font-bold', curValue >= bookValue ? 'text-[#4edea3]' : 'text-[#ffb2b7]')}>
                    Cur: ₹{curValue.toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!form.name || !form.ticker}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-40 disabled:pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                color: '#001a42',
                boxShadow: '0 0 24px rgba(173,198,255,0.25)',
              }}
            >
              <span className="material-symbols-outlined text-sm">stacked_line_chart</span>
              Add ETF
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

/* ── Edit ETF Modal ────────────────────────────────────────────────── */
function EditETFModal({ etf, onClose, onSave }: { etf: ETF; onClose: () => void; onSave: (id: string, updates: Partial<ETF>) => void }) {
  const [form, setForm] = useState({
    name: etf.name,
    units: String(etf.units),
    avg_cost: String(etf.avg_cost),
    current_price: String(etf.current_price ?? ''),
    expense_ratio: String(etf.expense_ratio),
    theme: etf.theme ?? '',
  });
  const [errors, setErrors] = useState({ units: '', avg_cost: '' });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function submit() {
    const errs = { units: '', avg_cost: '' };
    if (!form.units || Number(form.units) <= 0) errs.units = 'Units is required';
    if (!form.avg_cost || Number(form.avg_cost) <= 0) errs.avg_cost = 'Average cost is required';
    if (errs.units || errs.avg_cost) { setErrors(errs); return; }

    onSave(etf.id, {
      name: form.name,
      units: Number(form.units),
      avg_cost: Number(form.avg_cost),
      current_price: form.current_price ? Number(form.current_price) : undefined,
      expense_ratio: Number(form.expense_ratio) || 0,
      theme: form.theme || undefined,
    });
    onClose();
  }

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#0f1526] rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#4edea330] to-transparent" />

        <div className="flex items-center justify-between px-8 py-6 border-b border-[#2f3445]/60">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#adc6ff] text-xl">edit</span>
              Edit ETF · <span className="text-[#8c909f] text-base">{etf.ticker}</span>
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">Update holding details</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={labelCls}>ETF Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Units Held *</label>
              <input type="number" value={form.units}
                onChange={(e) => { setForm((f) => ({ ...f, units: e.target.value })); setErrors((er) => ({ ...er, units: '' })); }}
                className={cn(inputCls, errors.units && 'ring-1 ring-[#ffb2b7]/60')}
                style={{ ...inputStyle, ...(errors.units ? { borderColor: '#ffb2b7' } : {}) }} />
              {errors.units && <p className="text-[9px] text-[#ffb2b7] font-bold mt-1">{errors.units}</p>}
            </div>
            <div>
              <label className={labelCls}>Avg Cost (₹) *</label>
              <input type="number" value={form.avg_cost}
                onChange={(e) => { setForm((f) => ({ ...f, avg_cost: e.target.value })); setErrors((er) => ({ ...er, avg_cost: '' })); }}
                className={cn(inputCls, errors.avg_cost && 'ring-1 ring-[#ffb2b7]/60')}
                style={{ ...inputStyle, ...(errors.avg_cost ? { borderColor: '#ffb2b7' } : {}) }} />
              {errors.avg_cost && <p className="text-[9px] text-[#ffb2b7] font-bold mt-1">{errors.avg_cost}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Current Price (₹)</label>
              <input type="number" placeholder="Current market price" value={form.current_price}
                onChange={(e) => setForm((f) => ({ ...f, current_price: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>TER (%)</label>
              <input type="number" value={form.expense_ratio}
                onChange={(e) => setForm((f) => ({ ...f, expense_ratio: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Theme / Category</label>
            <input type="text" value={form.theme}
              onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
              className={inputCls} style={inputStyle} />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}>
              Cancel
            </button>
            <button onClick={submit}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.25)' }}>
              <span className="material-symbols-outlined text-sm">check</span>
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

/* ── Main Page ─────────────────────────────────────────────────────── */
export default function ETFPage() {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingETF, setEditingETF] = useState<ETF | null>(null);

  const fetchETFs = useCallback(async () => {
    try {
      const res = await fetch('/api/etfs');
      if (res.ok) setEtfs(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchETFs();
    const handler = () => fetchETFs();
    window.addEventListener('sova:refresh', handler);
    return () => window.removeEventListener('sova:refresh', handler);
  }, [fetchETFs]);

  async function handleAdd(data: Partial<ETF>) {
    const res = await fetch('/api/etfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const saved = await res.json();
      setEtfs((prev) => [...prev, saved]);
    }
  }

  async function handleUpdate(id: string, updates: Partial<ETF>) {
    const res = await fetch(`/api/etfs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setEtfs((prev) => prev.map((e) => (e.id === id ? updated : e)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this ETF from holdings?')) return;
    await fetch(`/api/etfs/${id}`, { method: 'DELETE' });
    setEtfs((prev) => prev.filter((e) => e.id !== id));
  }

  const totalBook = etfs.reduce((a, e) => a + Number(e.units) * Number(e.avg_cost), 0);
  const totalCurrentValue = etfs.reduce((a, e) => a + Number(e.units) * Number(e.current_price ?? e.avg_cost), 0);
  const weightedTER = etfs.length > 0
    ? etfs.reduce((a, e) => {
        const val = Number(e.units) * Number(e.avg_cost);
        return a + (Number(e.expense_ratio) * val);
      }, 0) / (totalBook || 1)
    : 0;
  const ytdReturn = totalBook > 0 ? ((totalCurrentValue - totalBook) / totalBook) * 100 : 0;

  const themeMap = new Map<string, number>();
  for (const e of etfs) {
    const theme = e.theme ?? 'Other';
    const val = Number(e.units) * Number(e.avg_cost);
    themeMap.set(theme, (themeMap.get(theme) ?? 0) + val);
  }
  const themes = Array.from(themeMap.entries()).map(([name, val]) => ({
    name,
    value: val,
    weight: totalBook > 0 ? Math.round((val / totalBook) * 100) : 0,
  }));
  const themeColors = ['#adc6ff', '#4edea3', '#D4AF37', '#ffb2b7', '#8b9dff', '#5eead4'];

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-8 pb-16 flex-1 min-w-0">

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard label="ETF Book" value={totalBook} format="inr" icon="stacked_line_chart" />
        <KPICard label="Weighted TER" value={weightedTER} format="percent" accent="primary" sub="Blended expense ratio" icon="receipt_long" />
        <KPICard
          label="Total Return"
          value={ytdReturn}
          format="percent"
          accent={ytdReturn >= 0 ? 'positive' : 'negative'}
          sub="Cost vs current price"
          icon="trending_up"
        />
        <KPICard label="Active ETFs" value={etfs.length} format="number" icon="layers" />
      </div>

      {/* Holdings Table */}
      <Card tier="low" className="p-8">
        <SectionHeader
          title="ETF Holdings"
          subtitle="Units held and average cost are required to track value"
          className="mb-6"
          right={
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest gradient-primary text-on-primary-container hover:scale-[1.01] transition-all shadow-glow"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add ETF
            </button>
          }
        />

        {loading ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-3xl text-outline animate-spin">sync</span>
          </div>
        ) : etfs.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-outline">stacked_line_chart</span>
            <p className="text-sm text-outline mt-4 mb-6">No ETFs added yet. Search by ticker to add your first holding.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow"
            >
              Add First ETF
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_72px] gap-3 px-4 pb-2 border-b border-outline-variant/10">
              {['ETF', 'Units', 'Avg Cost', 'Cur Price', 'Value', 'Return', ''].map((h) => (
                <p key={h} className="text-[9px] font-black uppercase tracking-widest text-outline">{h}</p>
              ))}
            </div>

            {etfs.map((e) => {
              const curPrice = Number(e.current_price ?? e.avg_cost);
              const value = Number(e.units) * curPrice;
              const returnPct = Number(e.avg_cost) > 0
                ? ((curPrice - Number(e.avg_cost)) / Number(e.avg_cost)) * 100
                : 0;

              return (
                <motion.div key={e.id} layout className="rounded-lg hover:bg-surface-container-highest/20 transition-colors">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_72px] gap-3 px-4 py-3 items-center">
                    <div>
                      <p className="text-xs font-bold text-on-surface">{e.name}</p>
                      <p className="text-[9px] text-outline uppercase tracking-widest">{e.ticker}{e.theme ? ` · ${e.theme}` : ''}</p>
                    </div>
                    <p className="text-xs text-on-surface">{Number(e.units).toLocaleString('en-IN', { maximumFractionDigits: 4 })}</p>
                    <p className="text-xs text-on-surface">{formatINR(Number(e.avg_cost))}</p>
                    <p className="text-xs text-on-surface">{formatINR(curPrice)}</p>
                    <p className="text-xs font-bold text-on-surface">{formatINR(value)}</p>
                    <p className={cn('text-xs font-black', returnPct >= 0 ? 'text-secondary' : 'text-tertiary')}>
                      {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                    </p>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditingETF(e)} className="text-outline hover:text-primary-fixed-dim transition-colors" title="Edit">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="text-outline hover:text-tertiary transition-colors" title="Remove">
                        <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {etfs.length > 0 && (
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_72px] gap-3 px-4 pt-3 mt-2 border-t border-outline-variant/15 items-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-outline col-span-4">Portfolio Total</p>
                <p className="text-sm font-black text-on-surface">{formatINR(totalCurrentValue)}</p>
                <p className={cn('text-sm font-black', ytdReturn >= 0 ? 'text-secondary' : 'text-tertiary')}>
                  {ytdReturn >= 0 ? '+' : ''}{ytdReturn.toFixed(2)}%
                </p>
                <div />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Thematic Allocation */}
      {themes.length > 0 && (
        <Card tier="low" className="p-8">
          <SectionHeader title="Thematic Allocation" subtitle="Automatically derived from your ETF holdings" className="mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themes.map((t, i) => {
              const color = themeColors[i % themeColors.length];
              return (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="p-5 rounded-xl bg-surface-container-highest/20 hover:bg-surface-container-highest/35 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{t.name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{formatINR(t.value)}</p>
                    </div>
                    <p className="text-2xl font-black text-on-surface">{t.weight}%</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-container-highest/40 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${t.weight}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.06 + 0.2 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      <AnimatePresence>
        {showAddModal && <AddETFModal onClose={() => setShowAddModal(false)} onSave={handleAdd} />}
      </AnimatePresence>

      <AnimatePresence>
        {editingETF && (
          <EditETFModal
            etf={editingETF}
            onClose={() => setEditingETF(null)}
            onSave={handleUpdate}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
