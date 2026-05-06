'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Chip } from '@/components/ui/Chip';
import { ActivityItem } from '@/lib/data';
import { useHoldings } from '@/components/HoldingsContext';
import { formatINR, cn } from '@/lib/utils';

const categories = ['ALL', 'TRADE', 'SIP', 'DIVIDEND', 'DEPOSIT', 'WITHDRAWAL', 'REBALANCE'] as const;
type Category = (typeof categories)[number];

const iconMap: Record<ActivityItem['category'], string> = {
  Trade: 'swap_vert',
  SIP: 'autorenew',
  Dividend: 'toll',
  Deposit: 'arrow_downward',
  Withdrawal: 'arrow_upward',
  Rebalance: 'balance',
};

const colorMap: Record<ActivityItem['category'], string> = {
  Trade: '#adc6ff',
  SIP: '#4edea3',
  Dividend: '#D4AF37',
  Deposit: '#4edea3',
  Withdrawal: '#ffb2b7',
  Rebalance: '#5eead4',
};

export default function ActivityPage() {
  const [cat, setCat] = useState<Category>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const { updateHoldingsFromActivity } = useHoldings();

  // Load manual trades from Supabase
  useEffect(() => {
    fetch('/api/trades')
      .then((r) => r.ok ? r.json() : [])
      .then((trades: Array<{
        id: string; asset_class: string; instrument_name: string; ticker?: string;
        action: string; units?: number; price?: number; amount: number;
        trade_date: string; rationale?: string; notes?: string;
      }>) => {
        const mapped: ActivityItem[] = trades.map((t) => ({
          id: t.id,
          title: `${t.action} ${t.instrument_name}`,
          detail: [
            t.units && t.price ? `${t.units} units @ ₹${t.price.toLocaleString('en-IN')}` : null,
            t.asset_class,
            t.notes,
          ].filter(Boolean).join(' · '),
          category: t.action === 'SIP' ? 'SIP' : t.action === 'Deposit' ? 'Deposit' : t.action === 'Withdrawal' ? 'Withdrawal' : 'Trade',
          amount: t.amount,
          positive: ['Buy', 'SIP', 'Deposit', 'Dividend'].includes(t.action),
          timestamp: new Date(t.trade_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          rationale: t.rationale ?? undefined,
          tradeAction: (t.action === 'Buy' || t.action === 'Sell') ? t.action : undefined,
          tradeTicker: t.ticker ?? undefined,
          tradeUnits: t.units ?? undefined,
          tradePrice: t.price ?? undefined,
          tradeInstrumentType: (t.asset_class as 'Equity' | 'MF' | 'ETF' | 'Real Estate') === 'Equity' ? 'Equity' :
                               t.asset_class === 'MF' ? 'MF' : t.asset_class === 'ETF' ? 'ETF' : 'Equity',
        }));
        setActivityLog(mapped);
      })
      .catch(() => setActivityLog([]))
      .finally(() => setLoadingActivity(false));
  }, []);

  const filtered = useMemo(() => {
    if (cat === 'ALL') return activityLog;
    return activityLog.filter((a) => a.category.toUpperCase() === cat);
  }, [cat, activityLog]);

  const totalIn = activityLog.filter((a) => a.positive).reduce((acc, a) => acc + a.amount, 0);
  const totalOut = activityLog.filter((a) => !a.positive).reduce((acc, a) => acc + a.amount, 0);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function addActivity(newActivity: ActivityItem) {
    // Save to Supabase
    const body = {
      asset_class: newActivity.tradeInstrumentType ?? 'Equity',
      instrument_name: newActivity.tradeTicker ?? newActivity.title,
      ticker: newActivity.tradeTicker,
      action: newActivity.tradeAction ?? newActivity.category,
      units: newActivity.tradeUnits,
      price: newActivity.tradePrice,
      amount: newActivity.amount,
      rationale: newActivity.rationale,
      notes: newActivity.detail,
      trade_date: new Date().toISOString(),
    };
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const saved = await res.json();
      newActivity.id = saved.id;
    }
    setActivityLog((prev) => [newActivity, ...prev]);
    updateHoldingsFromActivity(newActivity);
    setShowAddForm(false);
  }

  async function deleteActivity(id: string) {
    const res = await fetch(`/api/trades/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setActivityLog((prev) => prev.filter((a) => a.id !== id));
    }
  }

  function editActivity(id: string) {
    const item = activityLog.find((a) => a.id === id);
    if (item) {
      setEditingId(id);
    }
  }

  return (
    <div className="p-8 space-y-8 pb-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card tier="low" className="p-6">
          <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Inflows (30 days)</p>
          <p className="text-2xl font-black text-secondary mt-2">+{formatINR(totalIn, { compact: true })}</p>
        </Card>
        <Card tier="low" className="p-6">
          <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Outflows (30 days)</p>
          <p className="text-2xl font-black text-tertiary mt-2">−{formatINR(totalOut, { compact: true })}</p>
        </Card>
        <Card tier="low" className="p-6">
          <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Net Movement</p>
          <p className="text-2xl font-black gradient-text-primary mt-2">
            {formatINR(totalIn - totalOut, { compact: true })}
          </p>
        </Card>
      </div>

      <Card tier="low" className="p-8">
        <SectionHeader
          title="Activity Ledger"
          subtitle="Click any row to expand — immutable record of every capital movement"
          right={
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest bg-primary/15 text-primary-fixed-dim hover:bg-primary/25 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Add Activity
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cn(
                    'px-3 py-1.5 rounded-pill text-[9px] font-black uppercase tracking-widest transition-all',
                    cat === c
                      ? 'bg-gold/15 text-gold ring-1 ring-gold/30'
                      : 'bg-surface-container-highest/30 text-outline hover:text-on-surface',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          }
          className="mb-8"
        />

        {loadingActivity ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-3xl text-outline animate-spin">sync</span>
            <p className="text-sm text-outline mt-3">Loading activity…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-outline">receipt_long</span>
            <p className="text-sm text-outline mt-4">No activity yet. Click Record Activity to log your first trade.</p>
          </div>
        ) : (
        <div className="relative">
          <div className="absolute left-[38px] top-2 bottom-2 w-px bg-outline-variant/15" />
          <div className="space-y-1">
            {filtered.map((a, i) => {
              const isExpanded = expandedId === a.id;
              const color = colorMap[a.category];
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.03 }}
                >
                  {/* Clickable row — entire row expands */}
                  <button
                    onClick={() => toggle(a.id)}
                    className={cn(
                      'relative w-full flex items-start gap-5 p-4 rounded-xl transition-all text-left group cursor-pointer',
                      isExpanded
                        ? 'bg-surface-container-high/50 ring-1 ring-outline-variant/20'
                        : 'hover:bg-surface-container-highest/30',
                    )}
                  >
                    {/* Category icon */}
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 relative z-10 transition-all"
                      style={{ background: `${color}15`, border: `1px solid ${color}25` }}
                    >
                      <span
                        className="material-symbols-outlined text-xl"
                        style={{ color }}
                      >
                        {iconMap[a.category]}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-on-surface">{a.title}</p>
                        <Chip variant={a.positive ? 'positive' : 'negative'}>{a.category}</Chip>
                        {a.rationale && (
                          <span
                            className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                            style={{ background: `${color}18`, color }}
                          >
                            Rationale
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{a.detail}</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-outline mt-2">
                        {a.timestamp}
                      </p>
                    </div>

                    {/* Amount + chevron + action buttons */}
                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <p className={cn('text-sm font-black', a.positive ? 'text-secondary' : 'text-tertiary')}>
                        {a.positive ? '+' : '−'}{formatINR(a.amount)}
                      </p>
                      <div className="flex items-center gap-1">
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            editActivity(a.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface-container-high/30 rounded transition-colors"
                          title="Edit activity"
                        >
                          <span className="material-symbols-outlined text-sm text-outline hover:text-primary-fixed-dim">edit</span>
                        </motion.button>
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteActivity(a.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface-container-high/30 rounded transition-colors"
                          title="Delete activity"
                        >
                          <span className="material-symbols-outlined text-sm text-outline hover:text-tertiary">delete</span>
                        </motion.button>
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="material-symbols-outlined text-sm text-outline group-hover:text-on-surface transition-colors"
                        >
                          expand_more
                        </motion.span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail — rationale + portfolio line */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="expanded"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mx-4 mb-3 p-5 rounded-xl bg-surface-container/60 ring-1 ring-outline-variant/10 space-y-4">
                          {/* Trade Rationale */}
                          {a.rationale ? (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5"
                                style={{ color }}>
                                <span className="material-symbols-outlined text-xs">psychology</span>
                                Trade Rationale
                              </p>
                              <p className="text-[12px] text-on-surface-variant leading-relaxed">
                                {a.rationale}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-1">
                                Trade Rationale
                              </p>
                              <p className="text-[11px] text-outline/60 italic">
                                No rationale recorded for this transaction.
                              </p>
                            </div>
                          )}

                          {/* Quick stats row */}
                          <div className="grid grid-cols-3 gap-4 pt-3 border-t border-outline-variant/10">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-outline">Category</p>
                              <p className="text-xs font-black mt-0.5" style={{ color }}>{a.category}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-outline">Flow</p>
                              <p className={cn('text-xs font-black mt-0.5', a.positive ? 'text-secondary' : 'text-tertiary')}>
                                {a.positive ? 'Inflow' : 'Outflow'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-outline">Amount</p>
                              <p className={cn('text-xs font-black mt-0.5', a.positive ? 'text-secondary' : 'text-tertiary')}>
                                {a.positive ? '+' : '−'}{formatINR(a.amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
        )}
      </Card>

      {/* Add Activity Modal */}
      <AnimatePresence>
        {showAddForm && (
          <ActivityFormModal
            onAdd={addActivity}
            onClose={() => setShowAddForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Activity Form Modal Component
function ActivityFormModal({
  onAdd,
  onClose,
}: {
  onAdd: (activity: ActivityItem) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ActivityItem['category']>('Trade');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState('');
  const [rationale, setRationale] = useState('');

  // Structured trade fields
  const [tradeAction, setTradeAction] = useState<'Buy' | 'Sell'>('Buy');
  const [tradeInstrumentType, setTradeInstrumentType] = useState<'Equity' | 'MF' | 'ETF'>('Equity');
  const [tradeTicker, setTradeTicker] = useState('');
  const [tradeUnits, setTradeUnits] = useState('');
  const [tradePrice, setTradePrice] = useState('');

  const isTrade = category === 'Trade';

  // Auto-compute amount and auto-fill title/detail for trade
  const computedAmount = isTrade
    ? ((parseFloat(tradeUnits) || 0) * (parseFloat(tradePrice) || 0)).toFixed(0)
    : amount;

  function handleSubmit() {
    if (isTrade) {
      if (!tradeTicker || !tradeUnits || !tradePrice) return;
      const units = parseFloat(tradeUnits) || 0;
      const price = parseFloat(tradePrice) || 0;
      const totalAmount = units * price;
      const autoTitle = `${tradeAction} ${tradeTicker.toUpperCase()}`;
      const autoDetail = `${tradeAction} ${units} units @ ₹${price.toLocaleString('en-IN')} · ${tradeInstrumentType}`;

      const newActivity: ActivityItem = {
        id: `activity-${Date.now()}`,
        title: autoTitle,
        detail: autoDetail,
        category: 'Trade',
        amount: totalAmount,
        positive: tradeAction === 'Sell',
        timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        rationale: rationale || undefined,
        tradeAction,
        tradeTicker: tradeTicker.toUpperCase(),
        tradeUnits: units,
        tradePrice: price,
        tradeInstrumentType,
      };
      onAdd(newActivity);
    } else {
      if (!title || !detail || !amount) return;
      const newActivity: ActivityItem = {
        id: `activity-${Date.now()}`,
        title,
        detail,
        category,
        amount: parseFloat(amount) || 0,
        positive: category === 'Deposit' || category === 'Dividend' || category === 'SIP',
        timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        rationale: rationale || undefined,
      };
      onAdd(newActivity);
    }
  }

  const isValid = isTrade
    ? !!(tradeTicker && tradeUnits && tradePrice)
    : !!(title && detail && amount);

  const fieldStyle = { background: '#1a2035', border: '1px solid #2f3445' };
  const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2';
  const inputCls = 'w-full rounded-lg px-4 py-2.5 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)] my-auto"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2f3445]/60">
          <h2 className="text-base font-black tracking-tight text-[#dde2f8] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D4AF37]">add_circle</span>
            Record Activity
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Category */}
          <div>
            <label className={labelCls}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ActivityItem['category'])}
              className={inputCls}
              style={fieldStyle}
            >
              <option>Trade</option>
              <option>SIP</option>
              <option>Dividend</option>
              <option>Deposit</option>
              <option>Withdrawal</option>
              <option>Rebalance</option>
            </select>
          </div>

          {/* ── Structured Trade Fields ── */}
          {isTrade && (
            <>
              {/* Buy / Sell toggle */}
              <div>
                <label className={labelCls}>Action</label>
                <div className="flex gap-2">
                  {(['Buy', 'Sell'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setTradeAction(a)}
                      className="flex-1 h-10 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
                      style={
                        tradeAction === a
                          ? { background: a === 'Buy' ? '#4edea320' : '#ffb2b720', color: a === 'Buy' ? '#4edea3' : '#ffb2b7', border: `1px solid ${a === 'Buy' ? '#4edea340' : '#ffb2b740'}` }
                          : { background: '#1e2538', color: '#8c909f', border: '1px solid #2f3445' }
                      }
                    >
                      {a === 'Buy' ? '↑ Buy' : '↓ Sell'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instrument type */}
              <div>
                <label className={labelCls}>Instrument Type</label>
                <div className="flex gap-2">
                  {(['Equity', 'MF', 'ETF'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTradeInstrumentType(t)}
                      className="flex-1 h-10 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
                      style={
                        tradeInstrumentType === t
                          ? { background: '#adc6ff20', color: '#adc6ff', border: '1px solid #adc6ff40' }
                          : { background: '#1e2538', color: '#8c909f', border: '1px solid #2f3445' }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ticker */}
              <div>
                <label className={labelCls}>Ticker / Symbol</label>
                <input
                  type="text"
                  value={tradeTicker}
                  onChange={(e) => setTradeTicker(e.target.value.toUpperCase())}
                  placeholder="e.g., RELIANCE, TCS, HDFCBANK"
                  className={inputCls}
                  style={fieldStyle}
                />
              </div>

              {/* Units + Price side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Units / Qty</label>
                  <input
                    type="number"
                    value={tradeUnits}
                    onChange={(e) => setTradeUnits(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label className={labelCls}>Price per Unit (₹)</label>
                  <input
                    type="number"
                    value={tradePrice}
                    onChange={(e) => setTradePrice(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                    style={fieldStyle}
                  />
                </div>
              </div>

              {/* Auto-computed amount preview */}
              {tradeUnits && tradePrice && (
                <div className="px-3 py-2.5 rounded-lg flex items-center justify-between" style={{ background: '#adc6ff10', border: '1px solid #adc6ff20' }}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#8c909f]">Total Amount</span>
                  <span className="text-sm font-black text-[#adc6ff]">₹{parseFloat(computedAmount).toLocaleString('en-IN')}</span>
                </div>
              )}
            </>
          )}

          {/* ── Generic Fields (non-Trade) ── */}
          {!isTrade && (
            <>
              <div>
                <label className={labelCls}>Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., SIP — Parag Parikh" className={inputCls} style={fieldStyle} />
              </div>
              <div>
                <label className={labelCls}>Detail</label>
                <input type="text" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g., Monthly SIP executed" className={inputCls} style={fieldStyle} />
              </div>
              <div>
                <label className={labelCls}>Amount (₹)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputCls} style={fieldStyle} />
              </div>
            </>
          )}

          {/* Rationale */}
          <div>
            <label className={labelCls}>Rationale (Optional)</label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why are you making this transaction?"
              rows={3}
              className={`${inputCls} resize-none`}
              style={fieldStyle}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
              style={{
                background: isValid ? 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)' : '#424754',
                color: isValid ? '#001a42' : '#8c909f',
                boxShadow: isValid ? '0 0 24px rgba(173,198,255,0.2)' : 'none',
              }}
            >
              <span className="material-symbols-outlined text-sm">check</span>
              Record Activity
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
