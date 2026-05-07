'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';
import { useHoldings } from './HoldingsContext';
import type { ActivityItem } from '@/lib/data';

interface SearchQuote {
  symbol: string;
  shortName: string;
  exchange: string;
  quoteType: string;
}

const QUOTE_TYPE_COLOR: Record<string, string> = {
  EQUITY: 'text-[#adc6ff] bg-[#adc6ff]/10',
  ETF: 'text-[#4edea3] bg-[#4edea3]/10',
  MUTUALFUND: 'text-[#D4AF37] bg-[#D4AF37]/10',
  INDEX: 'text-[#ffb2b7] bg-[#ffb2b7]/10',
};

const EQUITY_SECTORS = [
  'IT / Technology', 'Banking / Finance', 'Oil & Gas', 'FMCG', 'Pharma / Healthcare',
  'Auto', 'Infra / Construction', 'Metals / Mining', 'Consumer Durables', 'Telecom',
  'Media / Entertainment', 'Real Estate', 'Energy / Power', 'Chemicals', 'Textiles', 'Other',
];

const ASSET_TYPES = ['Equity', 'Mutual Fund', 'ETF', 'PPF', 'Real Estate', 'Cash'] as const;
const ORDER_TYPES_BY_ASSET: Record<string, string[]> = {
  Equity: ['Buy', 'Sell', 'Dividend'],
  'Mutual Fund': ['SIP', 'Lumpsum', 'Redeem', 'Dividend'],
  ETF: ['Buy', 'Sell', 'Dividend'],
  PPF: ['Deposit', 'Partial Withdrawal', 'Interest Credit'],
  'Real Estate': ['Deposit', 'Rent Income', 'Appreciation'],
  Cash: ['Deposit', 'Withdrawal', 'Interest'],
};

export interface TradeInitValues {
  ticker?: string;
  name?: string;
  action?: 'Buy' | 'Sell';
  price?: number;
}

interface TradeModalProps {
  open: boolean;
  onClose: () => void;
  initialValues?: TradeInitValues | null;
}

function ModalContent({ onClose, initialValues }: { onClose: () => void; initialValues?: TradeInitValues | null }) {
  const { collapsed } = useSidebar();
  const { updateHoldingsFromActivity } = useHoldings();
  const sidebarLeft = collapsed ? 0 : 256;
  const [assetType, setAssetType] = useState<string>('Equity');
  const [orderType, setOrderType] = useState('Buy');
  const [instrument, setInstrument] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [broker, setBroker] = useState('Zerodha');
  const [rationale, setRationale] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sector, setSector] = useState('Other');

  // Instrument autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchQuote[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instrumentRef = useRef<HTMLDivElement>(null);

  // Live market price
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketPriceLoading, setMarketPriceLoading] = useState(false);
  const [marketPriceChange, setMarketPriceChange] = useState<number | null>(null);

  const showQtyPrice = ['Equity', 'ETF'].includes(assetType) && ['Buy', 'Sell'].includes(orderType);
  const totalValue = showQtyPrice && quantity && price
    ? Number(quantity) * Number(price)
    : Number(amount) || 0;

  // Pre-fill from initialValues (e.g. triggered via sova:open-trade event from SearchModal)
  useEffect(() => {
    if (!initialValues) return;
    if (initialValues.action) setOrderType(initialValues.action);
    if (initialValues.name || initialValues.ticker) {
      const display = initialValues.name || initialValues.ticker || '';
      setSearchQuery(display);
      setInstrument(display);
    }
    if (initialValues.ticker) setSelectedSymbol(initialValues.ticker);
    if (initialValues.price) setPrice(String(initialValues.price));
  }, [initialValues]);

  // Debounced instrument search
  const handleInstrumentInput = useCallback((value: string) => {
    setSearchQuery(value);
    setInstrument(value);
    setSelectedSymbol('');
    setMarketPrice(null);
    setMarketPriceChange(null);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (value.length < 1) { setSearchResults([]); setShowDropdown(false); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSearchResults(data.quotes ?? []);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 320);
  }, []);

  // Fetch live price when symbol is selected
  const fetchMarketPrice = useCallback(async (symbol: string) => {
    setMarketPriceLoading(true);
    setMarketPrice(null);
    setMarketPriceChange(null);
    try {
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (data.stock?.price != null) {
        setMarketPrice(data.stock.price);
        setMarketPriceChange(data.stock.changePercent ?? null);
      }
    } catch { /* silent */ }
    setMarketPriceLoading(false);
  }, []);

  function selectQuote(quote: SearchQuote) {
    setInstrument(quote.shortName);
    setSearchQuery(quote.shortName);
    setSelectedSymbol(quote.symbol);
    setShowDropdown(false);
    setSearchResults([]);
    fetchMarketPrice(quote.symbol);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (instrumentRef.current && !instrumentRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleAssetChange(a: string) {
    setAssetType(a);
    setOrderType(ORDER_TYPES_BY_ASSET[a][0]);
    setSearchQuery('');
    setInstrument('');
    setSelectedSymbol('');
    setMarketPrice(null);
    setMarketPriceChange(null);
    setSearchResults([]);
    setShowDropdown(false);
    setSector('Other');
  }

  async function handleSubmit() {
    const isSell = ['Sell', 'Redeem', 'Withdrawal', 'Partial Withdrawal'].includes(orderType);
    const assetClass = assetType === 'Mutual Fund' ? 'MF' : assetType;
    // Normalize ticker: strip exchange suffixes so "TCS.NS" matches Zerodha's "TCS"
    const rawTicker = selectedSymbol || instrument;
    const ticker = rawTicker.toUpperCase().replace(/\.(NS|BO|BSE|NSE)$/i, '');
    const units = parseFloat(quantity) || 0;
    const priceNum = parseFloat(price) || 0;
    const amountNum = totalValue || parseFloat(amount) || 0;

    // Persist to DB
    const body = {
      asset_class: assetClass,
      instrument_name: instrument || ticker,
      ticker: selectedSymbol || undefined,
      action: orderType,
      units: units || undefined,
      price: priceNum || undefined,
      amount: amountNum,
      trade_date: date ? new Date(date).toISOString() : new Date().toISOString(),
      rationale: rationale || undefined,
      notes: broker ? `via ${broker}` : undefined,
      sector: ['Equity', 'ETF'].includes(assetType) ? sector : undefined,
    };

    try {
      await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch { /* silent — still update local state */ }

    // Update holdings in memory
    const activity: ActivityItem = {
      id: `trade-${Date.now()}`,
      title: `${orderType} ${ticker || instrument}`,
      detail: units > 0 && priceNum > 0
        ? `${units} units @ ₹${priceNum.toLocaleString('en-IN')} · ${assetClass}`
        : `${assetClass} · via ${broker}`,
      category: orderType === 'SIP' ? 'SIP' : ['Deposit', 'Interest Credit', 'Rent Income', 'Lumpsum'].includes(orderType) ? 'Deposit' : ['Withdrawal', 'Partial Withdrawal', 'Redeem'].includes(orderType) ? 'Withdrawal' : 'Trade',
      amount: amountNum,
      positive: !isSell,
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      rationale: rationale || undefined,
      tradeAction: orderType === 'Buy' ? 'Buy' : orderType === 'Sell' ? 'Sell' : undefined,
      tradeTicker: ticker || undefined,
      instrumentName: instrument || ticker || undefined,
      tradeUnits: units || undefined,
      tradePrice: priceNum || undefined,
      tradeInstrumentType: assetClass === 'Equity' ? 'Equity' : assetClass === 'MF' ? 'MF' : assetClass === 'ETF' ? 'ETF' : 'Equity',
      tradeSector: ['Equity', 'ETF'].includes(assetType) ? sector : undefined,
    };
    updateHoldingsFromActivity(activity);
    window.dispatchEvent(new Event('sova:refresh'));

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setInstrument(''); setSearchQuery(''); setSelectedSymbol('');
      setQuantity(''); setPrice(''); setAmount(''); setRationale('');
      setMarketPrice(null); setMarketPriceChange(null);
      onClose();
    }, 1800);
  }

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Full-screen click trap */}
      <div className="fixed inset-0 z-[200]" onClick={onClose} />

      {/* Blur backdrop — full screen when collapsed, sidebar-excluded when expanded */}
      <div
        className="fixed top-0 bottom-0 right-0 z-[200]"
        style={{ left: sidebarLeft }}
      >
        <div className="absolute inset-0 bg-[#080e1d]/70 backdrop-blur-xl" />
      </div>

      {/* Centered modal — anchored to visible content area */}
      <div
        className="fixed top-0 bottom-0 right-0 z-[201] flex items-center justify-center p-6"
        style={{ left: sidebarLeft }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 24 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl bg-[#0f1526] rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
          style={{ border: '1px solid rgba(66,71,84,0.4)' }}
        >
          {/* Subtle top gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-[#2f3445]/60">
            <div>
              <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#D4AF37] text-xl">bolt</span>
                Log New Trade
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">
                Record a capital movement across any sleeve
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(78,222,163,0.15)' }}
              >
                <span className="material-symbols-outlined text-4xl text-[#4edea3]">check_circle</span>
              </motion.div>
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-widest text-[#dde2f8]">Trade Logged</p>
                <p className="text-[10px] text-[#8c909f] font-semibold mt-1">Activity ledger has been updated</p>
              </div>
            </div>
          ) : (
            <div className="p-8 space-y-7 max-h-[75vh] overflow-y-auto scrollbar-thin">

              {/* ── Asset Class ── */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-3">
                  Asset Class
                </label>
                <div className="flex flex-wrap gap-2">
                  {ASSET_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => handleAssetChange(t)}
                      className={cn(
                        'px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border',
                        assetType === t
                          ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40'
                          : 'bg-[#1e2538] text-[#8c909f] border-[#2f3445]/60 hover:text-[#dde2f8] hover:border-[#424754]',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Transaction Type ── */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-3">
                  Transaction Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {(ORDER_TYPES_BY_ASSET[assetType] || []).map((t) => {
                    const isNeg = ['Sell', 'Redeem', 'Withdrawal', 'Partial Withdrawal'].includes(t);
                    const isActive = orderType === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setOrderType(t)}
                        className={cn(
                          'px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border',
                          isActive
                            ? isNeg
                              ? 'bg-[#ffb2b7]/20 text-[#ffb2b7] border-[#ffb2b7]/40'
                              : 'bg-[#4edea3]/20 text-[#4edea3] border-[#4edea3]/40'
                            : 'bg-[#1e2538] text-[#8c909f] border-[#2f3445]/60 hover:text-[#dde2f8] hover:border-[#424754]',
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Instrument ── */}
              <div ref={instrumentRef} className="relative">
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
                  Instrument / Fund / Asset Name
                </label>
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => handleInstrumentInput(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    placeholder={
                      assetType === 'Equity' ? 'Search symbol or name — e.g. RELIANCE, TCS'
                      : assetType === 'Mutual Fund' ? 'Search — e.g. Parag Parikh Flexi Cap'
                      : assetType === 'ETF' ? 'Search — e.g. Nifty BeES, GOLDBEES'
                      : assetType === 'PPF' ? 'PPF Account'
                      : assetType === 'Real Estate' ? 'e.g. DLF Capital Greens'
                      : 'e.g. HDFC Savings, Liquid Fund'
                    }
                    className="w-full rounded-lg px-4 py-3 pr-10 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 transition-all"
                    style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                    autoComplete="off"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {searchLoading
                      ? <span className="material-symbols-outlined text-base text-[#4d8eff] animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span>
                      : <span className="material-symbols-outlined text-base text-[#424754]">search</span>
                    }
                  </div>
                </div>

                {/* Dropdown results */}
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
                      <div className="px-4 py-2 border-t border-[#2f3445]/50">
                        <p className="text-[9px] text-[#424754] font-semibold">Data via Yahoo Finance · NSE · BSE</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Sector (Equity / ETF only) ── */}
              {['Equity', 'ETF'].includes(assetType) && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
                    Sector
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 [color-scheme:dark]"
                    style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                  >
                    {EQUITY_SECTORS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Qty + Price (Equity / ETF) ── */}
              {showQtyPrice && (
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
                      Quantity / Units
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50"
                      style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f]">
                        Price per Unit (₹)
                      </label>
                      {/* Live market price badge */}
                      {marketPriceLoading && (
                        <span className="text-[9px] font-bold text-[#4d8eff] flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span>
                          Fetching price…
                        </span>
                      )}
                      {!marketPriceLoading && marketPrice != null && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => setPrice(String(marketPrice))}
                          title="Click to use market price"
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#4d8eff]/20 transition-colors group"
                          style={{ border: '1px solid #4d8eff30' }}
                        >
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#8c909f] group-hover:text-[#adc6ff]">Market</span>
                          <span className="text-[11px] font-black text-[#adc6ff]">
                            ₹{marketPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {marketPriceChange != null && (
                            <span className={cn(
                              'text-[9px] font-black',
                              marketPriceChange >= 0 ? 'text-[#4edea3]' : 'text-[#ffb2b7]'
                            )}>
                              {marketPriceChange >= 0 ? '+' : ''}{marketPriceChange.toFixed(2)}%
                            </span>
                          )}
                          <span className="material-symbols-outlined text-[10px] text-[#424754] group-hover:text-[#4d8eff]">north_east</span>
                        </motion.button>
                      )}
                    </div>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder={marketPrice != null ? `Market: ₹${marketPrice.toLocaleString('en-IN')}` : 'Market or Limit price'}
                      className="w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50"
                      style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                    />
                  </div>
                </div>
              )}

              {/* ── Amount ── */}
              {!showQtyPrice && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50"
                    style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                  />
                </div>
              )}

              {/* ── Date + Broker ── */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 [color-scheme:dark]"
                    style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
                    Broker / Platform
                  </label>
                  <select
                    value={broker}
                    onChange={(e) => setBroker(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 [color-scheme:dark]"
                    style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                  >
                    {['Zerodha', 'Groww', 'HDFC Securities', 'ICICI Direct', 'CAMS', 'Direct / Offline'].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Trade Rationale ── */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-1">
                  Trade Rationale
                </label>
                <p className="text-[10px] text-[#424754] font-semibold mb-2">
                  Why are you making this trade? Saved to your Activity Ledger.
                </p>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  rows={4}
                  placeholder="e.g. Increasing position on dip — technical support at ₹2,900 holding, fundamental thesis intact. Q4 margins beat by 8%. Target ₹3,400 in 12M..."
                  className="w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] placeholder:text-[#424754]/80 focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 resize-none"
                  style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                />
              </div>

              {/* ── Total preview ── */}
              {totalValue > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl flex items-center justify-between"
                  style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                >
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#8c909f]">Total Trade Value</p>
                    {showQtyPrice && quantity && price && (
                      <p className="text-[9px] text-[#424754] mt-0.5">
                        {quantity} units × ₹{Number(price).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                  <p className={cn(
                    'text-2xl font-black',
                    ['Sell', 'Redeem', 'Withdrawal', 'Partial Withdrawal'].includes(orderType)
                      ? 'text-[#ffb2b7]'
                      : 'text-[#4edea3]',
                  )}>
                    ₹{totalValue.toLocaleString('en-IN')}
                  </p>
                </motion.div>
              )}

              {/* ── Actions ── */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
                  style={{ background: '#1e2538', border: '1px solid #2f3445' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                  style={{
                    background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                    color: '#001a42',
                    boxShadow: '0 0 24px rgba(173,198,255,0.25)',
                  }}
                >
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  Log Trade
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}

export function TradeModal({ open, onClose, initialValues }: TradeModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && <ModalContent onClose={onClose} initialValues={initialValues} />}
    </AnimatePresence>,
    document.body,
  );
}
