'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR, cn } from '@/lib/utils';


type SIP = {
  id: string;
  fund_name: string;
  fund_code?: string;
  amount: number;
  debit_date?: string;    // "YYYY-MM-DD"
  start_date?: string;    // "YYYY-MM-DD"
  status: 'active' | 'paused';
  total_invested: number;
  current_value: number;
  units: number;
  nav?: number;
};

function nextSIPDate(debitDate?: string): string {
  if (!debitDate) return '—';
  const day = new Date(debitDate).getDate();
  const today = new Date();
  const candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate <= today) candidate.setMonth(candidate.getMonth() + 1);
  return candidate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Auto-update total_invested: count how many SIP debits have occurred since start_date
function computeAutoInvested(sip: SIP): number {
  if (!sip.start_date || !sip.debit_date) return sip.total_invested;
  const start = new Date(sip.start_date);
  const debitDay = new Date(sip.debit_date).getDate();
  const today = new Date();
  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), debitDay);
  while (cur <= today) {
    count++;
    cur.setMonth(cur.getMonth() + 1);
  }
  return count * sip.amount;
}

/* ── Add SIP modal ──────────────────────────────────────────────── */
function AddSIPModal({ onClose, onSave }: { onClose: () => void; onSave: (sip: Partial<SIP>) => void }) {
  const [form, setForm] = useState({ fund_name: '', amount: '', debit_date: '', start_date: '' });

  function submit() {
    if (!form.fund_name || !form.amount) return;
    onSave({ fund_name: form.fund_name, amount: Number(form.amount), debit_date: form.debit_date || undefined, start_date: form.start_date || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-container-low rounded-2xl p-8 w-full max-w-md shadow-2xl border border-outline-variant/20"
      >
        <h2 className="text-base font-black text-on-surface mb-6">Add New SIP</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1.5">Fund Name *</label>
            <input
              type="text"
              placeholder="e.g. Parag Parikh Flexi Cap"
              value={form.fund_name}
              onChange={(e) => setForm((f) => ({ ...f, fund_name: e.target.value }))}
              className="w-full bg-surface-container-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
          </div>
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1.5">Monthly Amount (₹) *</label>
            <input
              type="number"
              placeholder="e.g. 10000"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full bg-surface-container-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
          </div>
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1.5">
              SIP Started On
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              className="w-full bg-surface-container-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1.5">
              Monthly Debit Date
            </label>
            <input
              type="date"
              value={form.debit_date}
              onChange={(e) => setForm((f) => ({ ...f, debit_date: e.target.value }))}
              className="w-full bg-surface-container-highest/40 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container [color-scheme:dark]"
            />
            <p className="text-[9px] text-outline mt-1">The day of month shown will repeat monthly (e.g. select any May 15 → debits every 15th)</p>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={submit}
            disabled={!form.fund_name || !form.amount}
            className="flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container disabled:opacity-40 transition-all"
          >
            Add SIP
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

/* ── SIP Row ────────────────────────────────────────────────────── */
function SIPRow({ sip, onUpdate, onDelete }: {
  sip: SIP;
  onUpdate: (id: string, updates: Partial<SIP>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    amount: sip.amount,
    debit_date: sip.debit_date ?? '',
    start_date: sip.start_date ?? '',
  });

  function save() {
    onUpdate(sip.id, {
      amount: draft.amount,
      debit_date: draft.debit_date || undefined,
      start_date: draft.start_date || undefined,
    });
    setEditing(false);
  }

  const autoInvested = computeAutoInvested(sip);

  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl border transition-all',
        editing
          ? 'bg-surface-container-high/40 border-outline-variant/30'
          : 'bg-surface-container-highest/20 border-transparent',
      )}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            sip.status === 'active' ? 'bg-secondary/10 text-secondary' : 'bg-outline/10 text-outline',
          )}>
            <span className="material-symbols-outlined text-base">
              {sip.status === 'active' ? 'autorenew' : 'pause_circle'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-on-surface truncate">{sip.fund_name}</p>
            {!editing && (
              <p className="text-[9px] text-outline font-bold uppercase tracking-widest mt-0.5">
                Started {fmtDate(sip.start_date)} · Next {nextSIPDate(sip.debit_date)}
              </p>
            )}
            {!editing && autoInvested > 0 && (
              <p className="text-[9px] text-secondary/80 font-bold mt-0.5">
                Auto-invested: {formatINR(autoInvested)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!editing && (
            <>
              <p className="text-xs font-black text-on-surface">{formatINR(sip.amount)}</p>
              <span className={cn(
                'text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
                sip.status === 'active'
                  ? 'bg-secondary/15 text-secondary'
                  : 'bg-outline/15 text-outline',
              )}>
                {sip.status}
              </span>
              <button
                onClick={() => { setDraft({ amount: sip.amount, debit_date: sip.debit_date ?? '', start_date: sip.start_date ?? '' }); setEditing(true); }}
                className="text-outline hover:text-primary-fixed-dim transition-colors"
                title="Edit SIP"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <button
                onClick={() => onUpdate(sip.id, { status: sip.status === 'active' ? 'paused' : 'active' })}
                className="text-outline hover:text-gold transition-colors"
                title={sip.status === 'active' ? 'Pause SIP' : 'Resume SIP'}
              >
                <span className="material-symbols-outlined text-sm">
                  {sip.status === 'active' ? 'pause' : 'play_arrow'}
                </span>
              </button>
              <button
                onClick={() => onDelete(sip.id)}
                className="text-outline hover:text-tertiary transition-colors"
                title="Delete SIP"
              >
                <span className="material-symbols-outlined text-sm">delete_outline</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit panel */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1.5">
                  Monthly Amount (₹)
                </label>
                <input
                  type="number"
                  value={draft.amount}
                  onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))}
                  className="w-full bg-surface-container-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1.5">
                  SIP Started On
                </label>
                <input
                  type="date"
                  value={draft.start_date}
                  onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
                  className="w-full bg-surface-container-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1.5">
                  Monthly Debit Date
                </label>
                <input
                  type="date"
                  value={draft.debit_date}
                  onChange={(e) => setDraft((d) => ({ ...d, debit_date: e.target.value }))}
                  className="w-full bg-surface-container-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container [color-scheme:dark]"
                />
                <p className="text-[8px] text-outline mt-1">Day of month repeats monthly</p>
              </div>

              <div className="col-span-full flex gap-2">
                <button
                  onClick={save}
                  className="flex-1 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest bg-surface-container-highest/30 text-outline hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function MFPage() {
  const [sips, setSips] = useState<SIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'schemes'>('overview');

  const fetchSIPs = useCallback(async () => {
    try {
      const res = await fetch('/api/sips');
      if (res.ok) setSips(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSIPs();
    // Listen for global refresh
    const handler = () => fetchSIPs();
    window.addEventListener('sova:refresh', handler);
    return () => window.removeEventListener('sova:refresh', handler);
  }, [fetchSIPs]);

  async function handleAdd(data: Partial<SIP>) {
    const res = await fetch('/api/sips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const created = await res.json();
      setSips((prev) => [...prev, created]);
    }
  }

  async function handleUpdate(id: string, updates: Partial<SIP>) {
    const res = await fetch(`/api/sips/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setSips((prev) => prev.map((s) => (s.id === id ? updated : s)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this SIP?')) return;
    await fetch(`/api/sips/${id}`, { method: 'DELETE' });
    setSips((prev) => prev.filter((s) => s.id !== id));
  }

  const activeSIPs = sips.filter((s) => s.status === 'active');
  const monthlySIP = activeSIPs.reduce((a, s) => a + s.amount, 0);
  const totalBookValue = sips.reduce((a, s) => a + computeAutoInvested(s), 0);

  // Simple XIRR approximation: (totalBookValue / totalInvested)^(1/years) - 1
  const totalInvested = sips.reduce((a, s) => {
    if (!s.start_date) return a + s.total_invested;
    const years = (Date.now() - new Date(s.start_date).getTime()) / (365.25 * 24 * 3600 * 1000);
    return a + computeAutoInvested(s) + years; // just pass through invested
  }, 0);
  const avgXIRR = totalBookValue > 0 && totalInvested > 0 ? 0 : 0; // Placeholder — needs NAV data

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'schedule', label: 'SIP Schedule', icon: 'autorenew' },
    { id: 'schemes', label: 'MF Schemes', icon: 'pie_chart' },
  ] as const;

  return (
    <div className="p-8 space-y-8 pb-16 flex-1 min-w-0">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard label="MF Book Value" value={totalBookValue} format="inr" icon="pie_chart" />
          <KPICard
            label="Monthly SIP"
            value={monthlySIP}
            format="inr"
            accent="primary"
            icon="autorenew"
            sub={`${activeSIPs.length} active SIPs`}
          />
          <KPICard
            label="Avg XIRR"
            value={avgXIRR}
            format="percent"
            accent="positive"
            sub="Needs NAV data to compute"
            icon="insights"
          />
          <KPICard label="Active Schemes" value={activeSIPs.length} format="number" icon="dataset" />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-surface-container-highest/20 rounded-xl w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                activeTab === t.id
                  ? 'bg-surface-container-low text-on-surface shadow-sm'
                  : 'text-outline hover:text-on-surface',
              )}
            >
              <span className="material-symbols-outlined text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <Card tier="low" className="p-8">
            <SectionHeader title="Fund Categories" subtitle="Allocation by investment style" className="mb-6" />
            {sips.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-4xl text-outline">pie_chart</span>
                <p className="text-sm text-outline mt-3">No SIPs added yet. Add your first SIP to see allocation.</p>
                <button
                  onClick={() => { setShowAddModal(true); setActiveTab('schedule'); }}
                  className="mt-4 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container"
                >
                  Add First SIP
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {sips.map((s, i) => {
                  const pct = monthlySIP > 0 ? Math.round((s.amount / monthlySIP) * 100) : 0;
                  const colors = ['#adc6ff', '#4edea3', '#ffb2b7', '#D4AF37', '#8b9dff', '#5eead4'];
                  const color = colors[i % colors.length];
                  return (
                    <div key={s.id}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] font-bold text-on-surface">{s.fund_name}</span>
                        <span className="text-[11px] font-black" style={{ color }}>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-container-highest/40 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.06 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Tab: SIP Schedule */}
        {activeTab === 'schedule' && (
          <Card tier="low" className="p-8">
            <SectionHeader
              title="SIP Schedule"
              subtitle="Persistent SIP data — pause, resume, or edit at any time"
              className="mb-6"
              right={
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary-fixed-dim hover:bg-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add SIP
                </button>
              }
            />

            {loading ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-3xl text-outline animate-spin">sync</span>
              </div>
            ) : sips.length === 0 ? (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-5xl text-outline">autorenew</span>
                <p className="text-sm text-outline mt-4 mb-6">No SIPs added yet. Add your first SIP to get started.</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow hover:scale-[1.02] transition-all"
                >
                  <span className="material-symbols-outlined text-sm mr-2">add</span>
                  Add Your First SIP
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {sips.map((s) => (
                    <SIPRow key={s.id} sip={s} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Total Monthly SIP</p>
                  <p className="text-base font-black text-on-surface">{formatINR(monthlySIP)}</p>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Tab: MF Schemes */}
        {activeTab === 'schemes' && (
          <Card tier="low" className="p-8">
            <SectionHeader
              title="MF Schemes"
              subtitle="All SIP-linked mutual fund schemes"
              className="mb-6"
              right={
                <button
                  onClick={() => { setShowAddModal(true); setActiveTab('schedule'); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary-fixed-dim hover:bg-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add SIP
                </button>
              }
            />

            {sips.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-4xl text-outline">pie_chart</span>
                <p className="text-sm text-outline mt-3">No schemes yet. Add a SIP from the Schedule tab.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-3 px-4 pb-2 border-b border-outline-variant/10">
                  {['Fund', 'SIP Amount', 'Auto-Invested', 'Next Debit', 'Status'].map((h) => (
                    <p key={h} className="text-[9px] font-black uppercase tracking-widest text-outline">{h}</p>
                  ))}
                </div>
                {sips.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-3 px-4 py-3 rounded-lg hover:bg-surface-container-highest/20 transition-colors items-center"
                  >
                    <div>
                      <p className="text-xs font-bold text-on-surface">{s.fund_name}</p>
                      <p className="text-[9px] text-outline mt-0.5">Since {fmtDate(s.start_date)}</p>
                    </div>
                    <p className="text-xs font-black text-on-surface">{formatINR(s.amount)}</p>
                    <p className="text-xs font-bold text-secondary">{formatINR(computeAutoInvested(s))}</p>
                    <p className="text-xs text-on-surface-variant">{nextSIPDate(s.debit_date)}</p>
                    <span className={cn(
                      'text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-center',
                      s.status === 'active' ? 'bg-secondary/15 text-secondary' : 'bg-outline/15 text-outline',
                    )}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

      {/* Add SIP Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddSIPModal onClose={() => setShowAddModal(false)} onSave={handleAdd} />
        )}
      </AnimatePresence>

    </div>
  );
}
