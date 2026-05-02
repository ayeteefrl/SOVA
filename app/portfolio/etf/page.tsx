'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR, cn } from '@/lib/utils';


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

function AddETFModal({ onClose, onSave }: { onClose: () => void; onSave: (etf: Partial<ETF>) => void }) {
  const [form, setForm] = useState({ name: '', ticker: '', units: '', avg_cost: '', current_price: '', expense_ratio: '', theme: '' });

  function submit() {
    if (!form.name || !form.ticker) return;
    onSave({
      name: form.name,
      ticker: form.ticker.toUpperCase(),
      units: Number(form.units) || 0,
      avg_cost: Number(form.avg_cost) || 0,
      current_price: form.current_price ? Number(form.current_price) : undefined,
      expense_ratio: Number(form.expense_ratio) || 0,
      theme: form.theme || undefined,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-container-low rounded-2xl p-8 w-full max-w-lg shadow-2xl border border-outline-variant/20 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-base font-black text-on-surface mb-6">Add ETF Holding</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'name', label: 'ETF Name *', placeholder: 'Nifty 50 ETF', full: true },
            { key: 'ticker', label: 'Ticker Symbol *', placeholder: 'NIFTYBEES' },
            { key: 'units', label: 'Units Held', placeholder: '100', type: 'number' },
            { key: 'avg_cost', label: 'Avg Cost (₹)', placeholder: '250.00', type: 'number' },
            { key: 'current_price', label: 'Current Price (₹)', placeholder: '280.00', type: 'number' },
            { key: 'expense_ratio', label: 'TER / Expense Ratio (%)', placeholder: '0.05', type: 'number' },
            { key: 'theme', label: 'Theme / Category', placeholder: 'Broad Market', full: true },
          ].map((f) => (
            <div key={f.key} className={f.full ? 'col-span-2' : ''}>
              <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1.5">{f.label}</label>
              <input
                type={f.type ?? 'text'}
                placeholder={f.placeholder}
                value={(form as Record<string, string>)[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full bg-surface-container-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary-container"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={submit}
            disabled={!form.name || !form.ticker}
            className="flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container disabled:opacity-40 transition-all"
          >
            Add ETF
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest bg-surface-container-highest/30 text-outline hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ETFPage() {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ETF>>({});

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
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this ETF from holdings?')) return;
    await fetch(`/api/etfs/${id}`, { method: 'DELETE' });
    setEtfs((prev) => prev.filter((e) => e.id !== id));
  }

  // Auto-calculated metrics
  const totalBook = etfs.reduce((a, e) => a + e.units * e.avg_cost, 0);
  const totalCurrentValue = etfs.reduce((a, e) => a + e.units * (e.current_price ?? e.avg_cost), 0);
  const weightedTER = etfs.length > 0
    ? etfs.reduce((a, e) => {
        const val = e.units * e.avg_cost;
        return a + (e.expense_ratio * val);
      }, 0) / (totalBook || 1)
    : 0;
  const ytdReturn = totalBook > 0 ? ((totalCurrentValue - totalBook) / totalBook) * 100 : 0;

  // Thematic allocations derived from ETF data
  const themeMap = new Map<string, number>();
  for (const e of etfs) {
    const theme = e.theme ?? 'Other';
    const val = e.units * e.avg_cost;
    themeMap.set(theme, (themeMap.get(theme) ?? 0) + val);
  }
  const themes = Array.from(themeMap.entries()).map(([name, val]) => ({
    name,
    value: val,
    weight: totalBook > 0 ? Math.round((val / totalBook) * 100) : 0,
  }));

  const themeColors = ['#adc6ff', '#4edea3', '#D4AF37', '#ffb2b7', '#8b9dff', '#5eead4'];

  return (
    <div className="p-8 space-y-8 pb-16 flex-1 min-w-0">

        {/* KPIs — all auto-calculated */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard label="ETF Book" value={totalBook} format="inr" icon="stacked_line_chart" />
          <KPICard
            label="Weighted TER"
            value={weightedTER}
            format="percent"
            accent="primary"
            sub="Blended expense ratio"
            icon="receipt_long"
          />
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

        {/* ETF Holdings Table */}
        <Card tier="low" className="p-8">
          <SectionHeader
            title="ETF Holdings"
            subtitle="Click the + button to add an ETF, — to remove"
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
              <p className="text-sm text-outline mt-4 mb-6">No ETFs added yet. Add your first ETF holding.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow"
              >
                Add First ETF
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_72px] gap-3 px-4 pb-2 border-b border-outline-variant/10">
                {['ETF', 'Units', 'Avg Cost', 'Cur Price', 'Value', 'Return', ''].map((h) => (
                  <p key={h} className="text-[9px] font-black uppercase tracking-widest text-outline">{h}</p>
                ))}
              </div>

              {etfs.map((e) => {
                const curPrice = e.current_price ?? e.avg_cost;
                const value = e.units * curPrice;
                const returnPct = e.avg_cost > 0 ? ((curPrice - e.avg_cost) / e.avg_cost) * 100 : 0;
                const isEditing = editingId === e.id;

                return (
                  <motion.div
                    key={e.id}
                    layout
                    className={cn(
                      'rounded-lg overflow-hidden transition-colors',
                      isEditing ? 'bg-surface-container-high/50 ring-1 ring-outline-variant/20' : 'hover:bg-surface-container-highest/20',
                    )}
                  >
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_72px] gap-3 px-4 py-3 items-center">
                      <div>
                        <p className="text-xs font-bold text-on-surface">{e.name}</p>
                        <p className="text-[9px] text-outline uppercase tracking-widest">{e.ticker}{e.theme ? ` · ${e.theme}` : ''}</p>
                      </div>
                      {isEditing ? (
                        <>
                          <input type="number" value={editDraft.units ?? e.units} onChange={(ev) => setEditDraft((d) => ({ ...d, units: Number(ev.target.value) }))}
                            className="bg-surface-container-highest/40 rounded px-2 py-1 text-xs text-on-surface focus:outline-none w-full" />
                          <input type="number" value={editDraft.avg_cost ?? e.avg_cost} onChange={(ev) => setEditDraft((d) => ({ ...d, avg_cost: Number(ev.target.value) }))}
                            className="bg-surface-container-highest/40 rounded px-2 py-1 text-xs text-on-surface focus:outline-none w-full" />
                          <input type="number" value={editDraft.current_price ?? e.current_price ?? ''} onChange={(ev) => setEditDraft((d) => ({ ...d, current_price: Number(ev.target.value) }))}
                            className="bg-surface-container-highest/40 rounded px-2 py-1 text-xs text-on-surface focus:outline-none w-full" />
                          <p className="text-xs text-outline">—</p>
                          <p className="text-xs text-outline">—</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-on-surface">{e.units.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</p>
                          <p className="text-xs text-on-surface">{formatINR(e.avg_cost)}</p>
                          <p className="text-xs text-on-surface">{formatINR(curPrice)}</p>
                          <p className="text-xs font-bold text-on-surface">{formatINR(value)}</p>
                          <p className={cn('text-xs font-black', returnPct >= 0 ? 'text-secondary' : 'text-tertiary')}>
                            {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                          </p>
                        </>
                      )}
                      <div className="flex gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleUpdate(e.id, editDraft)} className="text-secondary hover:opacity-80">
                              <span className="material-symbols-outlined text-sm">check</span>
                            </button>
                            <button onClick={() => { setEditingId(null); setEditDraft({}); }} className="text-outline hover:text-on-surface">
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(e.id); setEditDraft({ units: e.units, avg_cost: e.avg_cost, current_price: e.current_price }); }}
                              className="text-outline hover:text-primary-fixed-dim transition-colors" title="Edit">
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button onClick={() => handleDelete(e.id)}
                              className="text-outline hover:text-tertiary transition-colors" title="Remove">
                              <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Totals row */}
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

        {/* Thematic Allocation — auto-derived from ETF data */}
        {themes.length > 0 && (
          <Card tier="low" className="p-8">
            <SectionHeader
              title="Thematic Allocation"
              subtitle="Automatically derived from your ETF holdings"
              className="mb-8"
            />
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
        {showAddModal && (
          <AddETFModal onClose={() => setShowAddModal(false)} onSave={handleAdd} />
        )}
      </AnimatePresence>

    </div>
  );
}
