'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR, cn } from '@/lib/utils';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { createPortal } from 'react-dom';

const MATURITY_YEAR = 2033;
const MAX_ANNUAL = 150000;

/* ── Shared style helpers ─────────────────────────────────────────── */
const inputCls = 'w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 transition-all';
const inputStyle = { background: '#1a2035', border: '1px solid #2f3445' };
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2';

/* ── Edit Contribution Modal ──────────────────────────────────────── */
function EditContributionModal({
  contribution,
  ppfRate,
  prevBalance,
  onClose,
  onSave,
}: {
  contribution: { id: string; deposit_date: string; amount: number; fy: string };
  ppfRate: number;
  prevBalance: number;
  onClose: () => void;
  onSave: (id: string, date: string, amount: number) => void;
}) {
  const [date, setDate] = useState(contribution.deposit_date);
  const [amount, setAmount] = useState(String(contribution.amount));
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const amt = Number(amount) || 0;
  const interest = Math.round((prevBalance + amt) * (ppfRate / 100));
  const closing = prevBalance + amt + interest;

  function submit() {
    if (!date || !amount || amt <= 0 || amt > 150000) return;
    onSave(contribution.id, date, amt);
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
        className="relative w-full max-w-md bg-[#0f1526] rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4AF3730] to-transparent" />

        <div className="flex items-center justify-between px-8 py-6 border-b border-[#2f3445]/60">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#D4AF37] text-xl">edit</span>
              Edit Contribution
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">
              {contribution.fy} · Interest recalculated at {ppfRate}%
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Deposit Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className={inputCls + ' [color-scheme:dark]'} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Amount (₹, max 1,50,000)</label>
              <input type="number" max={150000} value={amount} onChange={(e) => setAmount(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          {amt > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl grid grid-cols-3 gap-3"
              style={{ background: '#1a2035', border: '1px solid #2f3445' }}
            >
              {[
                { label: 'Deposit', value: `₹${amt.toLocaleString('en-IN')}`, color: '#dde2f8' },
                { label: `Interest (${ppfRate}%)`, value: `+₹${interest.toLocaleString('en-IN')}`, color: '#4edea3' },
                { label: 'Closing Balance', value: `₹${closing.toLocaleString('en-IN')}`, color: '#adc6ff' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[#8c909f]">{item.label}</p>
                  <p className="text-[11px] font-black mt-0.5" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </motion.div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}>
              Cancel
            </button>
            <button onClick={submit} disabled={!date || amt <= 0 || amt > 150000}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-40 disabled:pointer-events-none"
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

type Contribution = {
  id: string;
  fy: string;
  deposit_date: string;
  amount: number;
  interest_for_year: number;
  closing_balance: number;
  interest_rate: number;
};

function buildProjection(history: Contribution[], rate: number): { year: string; corpus: number; projected?: boolean }[] {
  if (history.length === 0) return [];
  const last = history[history.length - 1];
  let balance = last.closing_balance;
  const result: { year: string; corpus: number; projected?: boolean }[] = history.map((c) => ({ year: c.fy.slice(3, 7), corpus: c.closing_balance }));
  for (let fy = new Date().getFullYear() + 1; fy <= MATURITY_YEAR; fy++) {
    balance = Math.round((balance + MAX_ANNUAL) * (1 + rate / 100));
    result.push({ year: String(fy), corpus: balance, projected: true });
  }
  return result;
}

function recalcContributions(contributions: Contribution[], rate: number): Contribution[] {
  let runningBalance = 0;
  return contributions.map((c) => {
    const interest = Math.round((runningBalance + c.amount) * (rate / 100));
    const closing = runningBalance + c.amount + interest;
    runningBalance = closing;
    return { ...c, interest_for_year: interest, closing_balance: closing, interest_rate: rate };
  });
}

export default function PPFPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [ppfRate, setPpfRate] = useState(7.1);
  const [rateSource, setRateSource] = useState('');
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newEntry, setNewEntry] = useState({ date: '', amount: '' });

  const fetchData = useCallback(async () => {
    const [contribRes, rateRes] = await Promise.all([
      fetch('/api/ppf'),
      fetch('/api/ppf/rate'),
    ]);
    if (contribRes.ok) {
      const data = await contribRes.json();
      setContributions(data);
    }
    if (rateRes.ok) {
      const rateData = await rateRes.json();
      setPpfRate(rateData.rate);
      setRateSource(rateData.source ?? '');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const handler = () => fetchData();
    window.addEventListener('sova:refresh', handler);
    return () => window.removeEventListener('sova:refresh', handler);
  }, [fetchData]);

  // Recalculate all contributions whenever rate changes
  const displayContributions = contributions.length > 0
    ? recalcContributions(contributions, ppfRate)
    : contributions;

  const totalDeposited = displayContributions.reduce((a, c) => a + c.amount, 0);
  const totalInterest = displayContributions.reduce((a, c) => a + c.interest_for_year, 0);
  const currentCorpus = displayContributions[displayContributions.length - 1]?.closing_balance ?? 0;
  const chartData = buildProjection(displayContributions, ppfRate);
  const projectedMaturity = chartData[chartData.length - 1]?.corpus ?? 0;
  const yearsLeft = MATURITY_YEAR - new Date().getFullYear();

  async function saveEdit(id: string, date: string, amt: number) {
    await fetch(`/api/ppf/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, deposit_date: date, interest_rate: ppfRate }),
    });
    setContributions((prev) => prev.map((x) => x.id === id ? { ...x, amount: amt, deposit_date: date } : x));
  }

  async function deleteContribution(id: string) {
    if (!confirm('Delete this contribution?')) return;
    await fetch(`/api/ppf/${id}`, { method: 'DELETE' });
    setContributions((prev) => prev.filter((x) => x.id !== id));
  }

  async function addContribution() {
    if (!newEntry.date || !newEntry.amount) return;
    const prevBalance = displayContributions[displayContributions.length - 1]?.closing_balance ?? 0;
    const amt = Number(newEntry.amount);
    const interest = Math.round((prevBalance + amt) * (ppfRate / 100));
    const closing = prevBalance + amt + interest;
    const d = new Date(newEntry.date);
    const fy = `FY ${d.getFullYear()}-${String(d.getFullYear() + 1).slice(-2)}`;

    const res = await fetch('/api/ppf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fy,
        deposit_date: newEntry.date,
        amount: amt,
        interest_for_year: interest,
        closing_balance: closing,
        interest_rate: ppfRate,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setContributions((prev) => [...prev, created]);
    }
    setAddingNew(false);
    setNewEntry({ date: '', amount: '' });
  }

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-8 pb-16 flex-1 min-w-0">

        {loading ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-3xl text-outline animate-spin">sync</span>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <KPICard label="Current Corpus" value={currentCorpus} format="inr" icon="account_balance" />
              <KPICard label="Total Deposited" value={totalDeposited} format="inr" icon="savings" sub="₹1.5L / year max" />
              <KPICard label="Interest Earned" value={totalInterest} format="inr" accent="positive" icon="toll" sub="Tax-free (EEE)" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <KPICard
                label="Current Rate"
                value={ppfRate}
                format="percent"
                accent="gold"
                icon="percent"
                sub={rateSource || 'Government declared · auto-updated'}
              />
              <KPICard
                label="Projected Maturity"
                value={projectedMaturity}
                format="inr"
                accent="primary"
                icon="flag"
                sub={`At ₹1.5L/yr · ${MATURITY_YEAR} maturity`}
              />
              <KPICard
                label="Years to Maturity"
                value={yearsLeft}
                format="number"
                icon="hourglass_top"
                sub={`Matures ${MATURITY_YEAR}`}
              />
            </div>

            {/* Rate banner */}
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-gold/8 border border-gold/20">
              <span className="material-symbols-outlined text-gold text-base">info</span>
              <p className="text-[10px] font-bold text-on-surface">
                PPF rate automatically refreshed daily from government sources.
                Current rate: <span className="text-gold font-black">{ppfRate}%</span>.
                All interest calculations update instantly when the rate changes.
              </p>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: 'lock', color: '#adc6ff', label: 'Lock-in', value: '15 years (extendable in 5-yr blocks)' },
                { icon: 'savings', color: '#4edea3', label: 'Partial Withdrawal', value: 'Available from Year 7 onwards' },
                { icon: 'receipt_long', color: '#D4AF37', label: 'Tax Benefit', value: 'EEE — Exempt at all three stages' },
              ].map((info) => (
                <Card key={info.label} tier="low" animate={false} className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${info.color}15` }}>
                    <span className="material-symbols-outlined text-base" style={{ color: info.color }}>{info.icon}</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-outline">{info.label}</p>
                    <p className="text-xs font-bold text-on-surface mt-0.5">{info.value}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Growth Chart */}
            {chartData.length > 0 && (
              <Card tier="low" className="p-8">
                <SectionHeader
                  title="Corpus Growth"
                  subtitle={`Historical + projected at ${ppfRate}% through ${MATURITY_YEAR}`}
                  className="mb-6"
                />
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,71,84,0.15)" />
                      <XAxis dataKey="year" tick={{ fill: '#8c909f', fontSize: 9, fontWeight: 600 }} />
                      <YAxis tickFormatter={(v) => `₹${(v / 1e6).toFixed(1)}M`} tick={{ fill: '#8c909f', fontSize: 9 }} />
                      <Tooltip
                        formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Corpus']}
                        contentStyle={{ background: 'rgba(25,31,47,0.95)', border: '1px solid rgba(66,71,84,0.3)', borderRadius: 8 }}
                      />
                      <ReferenceLine x={String(new Date().getFullYear())} stroke="rgba(173,198,255,0.3)" strokeDasharray="4 4" label={{ value: 'Now', fill: '#adc6ff', fontSize: 9 }} />
                      <Line type="monotone" dataKey="corpus" stroke="#adc6ff" strokeWidth={2}
                        dot={(props: { cx: number; cy: number; payload: { projected?: boolean } }) =>
                          props.payload.projected
                            ? <circle key={props.cx} cx={props.cx} cy={props.cy} r={2} fill="#adc6ff" fillOpacity={0.4} stroke="none" />
                            : <circle key={props.cx} cx={props.cx} cy={props.cy} r={3} fill="#adc6ff" stroke="#080e1d" strokeWidth={1.5} />
                        }
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Contribution Ledger */}
            <Card tier="low" className="p-8">
              <SectionHeader
                title="Contribution Ledger"
                subtitle={`Interest auto-recalculated at current rate (${ppfRate}%)`}
                right={
                  <button
                    onClick={() => setAddingNew(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary-fixed-dim hover:bg-primary/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Contribution
                  </button>
                }
                className="mb-6"
              />

              {contributions.length === 0 && !addingNew && (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-outline">savings</span>
                  <p className="text-sm text-outline mt-3 mb-5">No contributions logged yet.</p>
                  <button onClick={() => setAddingNew(true)}
                    className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary-fixed-dim hover:bg-primary/20 transition-colors">
                    Add First Contribution
                  </button>
                </div>
              )}

              <AnimatePresence>
                {addingNew && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                    <div className="p-5 rounded-xl bg-primary/8 ring-1 ring-primary/20 grid grid-cols-2 gap-4 mb-2">
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1">Deposit Date</label>
                        <input type="date" value={newEntry.date} onChange={(e) => setNewEntry((p) => ({ ...p, date: e.target.value }))}
                          className="w-full bg-surface-container-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container [color-scheme:dark]" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-outline mb-1">Amount (₹, max 1,50,000)</label>
                        <input type="number" max={150000} value={newEntry.amount} onChange={(e) => setNewEntry((p) => ({ ...p, amount: e.target.value }))}
                          className="w-full bg-surface-container-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container" />
                      </div>
                      <div className="col-span-2 flex gap-2">
                        <button onClick={addContribution} className="flex-1 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors">Save</button>
                        <button onClick={() => setAddingNew(false)} className="flex-1 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest bg-surface-container-highest/30 text-outline hover:text-on-surface transition-colors">Cancel</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {displayContributions.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_56px] gap-3 px-4 pb-2 border-b border-outline-variant/10">
                    {['FY', 'Date', 'Deposit', 'Interest', 'Closing Balance', ''].map((h) => (
                      <p key={h} className="text-[9px] font-black uppercase tracking-widest text-outline">{h}</p>
                    ))}
                  </div>
                  {displayContributions.map((c) => (
                    <motion.div key={c.id} layout className="rounded-lg overflow-hidden">
                      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_56px] gap-3 px-4 py-3 items-center rounded-lg transition-colors hover:bg-surface-container-highest/20">
                        <p className="text-[10px] font-bold text-outline">{c.fy}</p>
                        <p className="text-[10px] text-on-surface-variant">{c.deposit_date}</p>
                        <p className="text-xs font-bold text-on-surface">{formatINR(c.amount)}</p>
                        <p className="text-xs font-bold text-secondary">+{formatINR(c.interest_for_year)}</p>
                        <p className="text-xs font-black text-on-surface">{formatINR(c.closing_balance)}</p>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setEditingContribution(c)} className="text-outline hover:text-primary-fixed-dim transition-colors">
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button onClick={() => deleteContribution(c.id)} className="text-outline hover:text-tertiary transition-colors">
                            <span className="material-symbols-outlined text-sm">delete_outline</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_56px] gap-3 px-4 pt-3 mt-2 border-t border-outline-variant/15">
                    <p className="text-[9px] font-black uppercase tracking-widest text-outline col-span-2">Totals</p>
                    <p className="text-sm font-black text-on-surface">{formatINR(totalDeposited)}</p>
                    <p className="text-sm font-black text-secondary">{formatINR(totalInterest)}</p>
                    <p className="text-sm font-black gradient-text-primary">{formatINR(currentCorpus)}</p>
                    <div />
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

      {/* Edit Contribution Modal */}
      <AnimatePresence>
        {editingContribution && (
          <EditContributionModal
            contribution={editingContribution}
            ppfRate={ppfRate}
            prevBalance={(() => {
              const idx = displayContributions.findIndex((c) => c.id === editingContribution.id);
              return idx > 0 ? displayContributions[idx - 1].closing_balance : 0;
            })()}
            onClose={() => setEditingContribution(null)}
            onSave={saveEdit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
