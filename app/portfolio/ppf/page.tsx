'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { createPortal } from 'react-dom';
import {
  getFY,
  processContributions,
  type Contribution,
  type ProcessedRow,
} from '@/lib/ppf';

const MAX_ANNUAL = 150000;

/* ── Date display helper ────────────────────────────────────────────── */
function fmtDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

/* ── Corpus growth projection ───────────────────────────────────────── */
function buildProjection(
  rows: ProcessedRow[],
  rate: number,
  maturityYear: number,
): { year: string; corpus: number; projected?: boolean }[] {
  if (rows.length === 0) return [];

  const historical: { year: string; corpus: number; projected?: boolean }[] = [];
  for (const row of rows) {
    if (row.rowType !== 'deposit') {
      historical.push({ year: row.fy.slice(3, 7), corpus: row.closing_balance });
    }
  }

  const last = rows[rows.length - 1];
  if (last.rowType === 'deposit') {
    const yr = last.fy.slice(3, 7);
    if (!historical.find(h => h.year === yr)) historical.push({ year: yr, corpus: last.closing_balance });
  }

  const lastHistYear = historical.length > 0
    ? parseInt(historical[historical.length - 1].year)
    : new Date().getFullYear();

  const result = [...historical];
  let balance = last.closing_balance;
  for (let yr = lastHistYear + 1; yr <= maturityYear; yr++) {
    balance = Math.round((balance + MAX_ANNUAL) * (1 + rate / 100));
    result.push({ year: String(yr), corpus: balance, projected: true });
  }
  return result;
}

/* ── Style constants ────────────────────────────────────────────────── */
const inputCls = 'w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 transition-all';
const inputStyle = { background: '#1a2035', border: '1px solid #2f3445' };
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2';

/* ── Edit Contribution Modal ─────────────────────────────────────────── */
function EditContributionModal({
  contribution, ppfRate, onClose, onSave,
}: {
  contribution: Contribution;
  ppfRate: number;
  onClose: () => void;
  onSave: (id: string, date: string, amount: number) => void;
}) {
  const [date, setDate] = useState(contribution.deposit_date);
  const [amount, setAmount] = useState(String(contribution.amount));
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const amt = Number(amount) || 0;
  function submit() {
    if (!date || amt <= 0 || amt > 150000) return;
    onSave(contribution.id, date, amt);
    onClose();
  }

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }} transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        onClick={e => e.stopPropagation()}
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
              {getFY(date || contribution.deposit_date)} · Rate {ppfRate}%
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
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className={inputCls + ' [color-scheme:dark]'} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Amount (₹, max 1,50,000)</label>
              <input type="number" max={150000} value={amount} onChange={e => setAmount(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
          </div>
          {amt > 0 && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl space-y-1" style={{ background: '#1a2035', border: '1px solid #2f3445' }}>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#8c909f]">Deposit Amount</p>
              <p className="text-lg font-black text-[#dde2f8]">₹{amt.toLocaleString('en-IN')}</p>
              <p className="text-[9px] text-[#8c909f] pt-1 leading-relaxed">
                Annual interest is calculated on the full FY balance using the monthly min-balance rule and credited on March 31.
              </p>
            </motion.div>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}>Cancel</button>
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

/* ── Page ───────────────────────────────────────────────────────────── */
export default function PPFPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [ppfRate, setPpfRate] = useState(7.1);
  const [rateSource, setRateSource] = useState('');
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newEntry, setNewEntry] = useState({ date: '', amount: '' });
  // null = auto-derive from first deposit; number = user has manually overridden
  const [maturityYearOverride, setMaturityYearOverride] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'fy' | 'date'>('fy');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const currentYear = new Date().getFullYear();

  // Persist maturity year override across sessions
  useEffect(() => {
    const saved = localStorage.getItem('ppf_maturity_override');
    if (saved) setMaturityYearOverride(parseInt(saved));
  }, []);

  const handleSetMaturityOverride = (val: number) => {
    setMaturityYearOverride(val);
    localStorage.setItem('ppf_maturity_override', String(val));
  };

  const fetchData = useCallback(async () => {
    const [contribRes, rateRes] = await Promise.all([fetch('/api/ppf'), fetch('/api/ppf/rate')]);
    if (contribRes.ok) setContributions(await contribRes.json());
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

  // Derive maturity year from the first deposit's FY + 15 (PPF 15-year lock-in rule).
  // PPF matures at the end of the 15th financial year from the year of account opening.
  // The user can override this by editing the "Years to Maturity" KPI.
  const firstDeposit = contributions.length > 0
    ? [...contributions].sort((a, b) => a.deposit_date.localeCompare(b.deposit_date))[0]
    : null;
  const openingFYStart = firstDeposit ? parseInt(getFY(firstDeposit.deposit_date).slice(3, 7)) : currentYear;
  const maturityYear = maturityYearOverride ?? (openingFYStart + 15);
  const yearsLeft = maturityYear - currentYear;

  const processedRows = processContributions(contributions, ppfRate);

  // Sort ledger rows: FY groups stay intact; only their order (and deposit order within) changes
  const sortedRows = (() => {
    const fyGroups = new Map<string, ProcessedRow[]>();
    for (const row of processedRows) {
      if (!fyGroups.has(row.fy)) fyGroups.set(row.fy, []);
      fyGroups.get(row.fy)!.push(row);
    }
    let fyKeys = Array.from(fyGroups.keys()).sort();
    if (sortField === 'fy' && sortDir === 'desc') fyKeys = fyKeys.reverse();
    if (sortField === 'date') {
      for (const [fy, rows] of fyGroups) {
        const deps = rows.filter(r => r.rowType === 'deposit')
          .sort((a, b) => sortDir === 'asc'
            ? a.deposit_date.localeCompare(b.deposit_date)
            : b.deposit_date.localeCompare(a.deposit_date));
        const rest = rows.filter(r => r.rowType !== 'deposit');
        fyGroups.set(fy, [...deps, ...rest]);
      }
    }
    return fyKeys.flatMap(fy => fyGroups.get(fy)!);
  })();

  const totalDeposited = processedRows.filter(r => r.rowType === 'deposit').reduce((a, c) => a + c.amount, 0);
  const totalInterest = processedRows.filter(r => r.rowType !== 'deposit').reduce((a, c) => a + c.interest_for_year, 0);
  const currentCorpus = processedRows[processedRows.length - 1]?.closing_balance ?? 0;
  const chartData = buildProjection(processedRows, ppfRate, maturityYear);
  const projectedMaturity = chartData[chartData.length - 1]?.corpus ?? 0;

  async function saveEdit(id: string, date: string, amt: number) {
    await fetch(`/api/ppf/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, deposit_date: date, interest_rate: ppfRate }),
    });
    setContributions(prev =>
      prev.map(x => x.id === id ? { ...x, amount: amt, deposit_date: date } : x)
        .sort((a, b) => a.deposit_date.localeCompare(b.deposit_date)),
    );
  }

  async function deleteContribution(id: string) {
    if (!confirm('Delete this contribution?')) return;
    await fetch(`/api/ppf/${id}`, { method: 'DELETE' });
    setContributions(prev => prev.filter(x => x.id !== id));
  }

  async function addContribution() {
    const amt = Number(newEntry.amount);
    if (!newEntry.date || amt <= 0) return;
    const res = await fetch('/api/ppf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fy: getFY(newEntry.date), deposit_date: newEntry.date, amount: amt, interest_for_year: 0, closing_balance: 0, interest_rate: ppfRate }),
    });
    if (res.ok) {
      const created = await res.json();
      setContributions(prev => [...prev, created].sort((a, b) => a.deposit_date.localeCompare(b.deposit_date)));
    }
    setAddingNew(false);
    setNewEntry({ date: '', amount: '' });
  }

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-8 pb-16 flex-1 min-w-0">

      {/* Rate banner — pinned at top */}
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-gold/8 border border-gold/20">
        <span className="material-symbols-outlined text-gold text-base">info</span>
        <p className="text-[10px] font-bold text-on-surface">
          PPF rate auto-refreshed daily · Current rate: <span className="text-gold font-black">{ppfRate}%</span>
          {rateSource ? ` · ${rateSource}` : ''} · Interest calculated on monthly min-balance (5th–last day) and credited annually on Mar 31.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-3xl text-outline animate-spin">sync</span>
        </div>
      ) : (
        <>
          {/* KPIs row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <KPICard label="Current Corpus" value={currentCorpus} format="inr" icon="account_balance" />
            <KPICard label="Total Deposited" value={totalDeposited} format="inr" icon="savings" sub="₹1.5L / year max" />
            <KPICard label="Interest Earned" value={totalInterest} format="inr" accent="positive" icon="toll" sub="Tax-free (EEE)" />
          </div>

          {/* KPIs row 2 */}
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
              sub={`At ₹1.5L/yr · ${maturityYear} maturity`}
            />
            {/* Maturity year auto-derived from first deposit's FY + 15. Editable to override. */}
            <KPICard
              label="Years to Maturity"
              value={yearsLeft}
              format="number"
              icon="hourglass_top"
              sub={`Matures ${maturityYear} · opened FY ${openingFYStart}-${String(openingFYStart + 1).slice(-2)}`}
              onChange={v => {
                const yrs = Math.max(1, Math.round(v));
                handleSetMaturityOverride(currentYear + yrs);
              }}
            />
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: 'lock', color: '#adc6ff', label: 'Lock-in', value: '15 years (extendable in 5-yr blocks)' },
              { icon: 'savings', color: '#4edea3', label: 'Partial Withdrawal', value: 'Available from Year 7 onwards' },
              { icon: 'receipt_long', color: '#D4AF37', label: 'Tax Benefit', value: 'EEE — Exempt at all three stages' },
            ].map(info => (
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
                subtitle={`Historical + projected at ${ppfRate}% through ${maturityYear}`}
                className="mb-6"
              />
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,71,84,0.15)" />
                    <XAxis dataKey="year" tick={{ fill: '#8c909f', fontSize: 9, fontWeight: 600 }} />
                    <YAxis tickFormatter={v => `₹${(v / 1e5).toFixed(1)}L`} tick={{ fill: '#8c909f', fontSize: 9 }} />
                    <Tooltip
                      formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Corpus']}
                      contentStyle={{ background: 'rgba(25,31,47,0.95)', border: '1px solid rgba(66,71,84,0.3)', borderRadius: 8 }}
                    />
                    <ReferenceLine x={String(currentYear)} stroke="rgba(173,198,255,0.3)" strokeDasharray="4 4"
                      label={{ value: 'Now', fill: '#adc6ff', fontSize: 9 }} />
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
              subtitle="All interest is computed from your actual deposit dates & amounts — not entered manually"
              right={
                <button onClick={() => setAddingNew(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary-fixed-dim hover:bg-primary/20 transition-colors">
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
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4" style={{ overflow: 'hidden' }}>
                  <div className="p-5 rounded-xl grid grid-cols-2 gap-4 mb-2" style={{ background: 'rgba(13,19,34,0.8)', border: '1px solid rgba(77,130,255,0.25)' }}>
                    <div>
                      <label className={labelCls}>Deposit Date</label>
                      <input type="date" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))}
                        className={inputCls + ' [color-scheme:dark]'} style={inputStyle} />
                    </div>
                    <div>
                      <label className={labelCls}>Amount (max ₹1,50,000)</label>
                      <input type="number" max={150000} value={newEntry.amount} onChange={e => setNewEntry(p => ({ ...p, amount: e.target.value }))}
                        className={inputCls} style={inputStyle} />
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <button onClick={addContribution} className="flex-1 h-10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all hover:scale-[1.01]"
                        style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 20px rgba(173,198,255,0.2)' }}>Save</button>
                      <button onClick={() => setAddingNew(false)} className="flex-1 h-10 rounded-lg text-[9px] font-black uppercase tracking-widest text-outline hover:text-on-surface transition-colors"
                        style={{ background: '#1e2538', border: '1px solid #2f3445' }}>Cancel</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {processedRows.length > 0 && (
              <div className="space-y-1">
                {/* Header with sort controls */}
                <div className="grid grid-cols-[1fr_1.2fr_1fr_1.4fr_1fr_56px] gap-3 px-4 pb-2 border-b border-outline-variant/10">
                  {(['FY', 'Date', 'Deposit', 'Est. Interest', 'Balance', ''] as const).map(h => {
                    const field = h === 'FY' ? 'fy' : h === 'Date' ? 'date' : null;
                    const active = field && sortField === field;
                    return field ? (
                      <button key={h} onClick={() => {
                        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setSortField(field); setSortDir('asc'); }
                      }} className="flex items-center gap-1 group">
                        <p className={`text-[9px] font-black uppercase tracking-widest transition-colors ${active ? 'text-primary-fixed-dim' : 'text-outline group-hover:text-on-surface-variant'}`}>{h}</p>
                        <span className={`material-symbols-outlined text-[10px] transition-colors ${active ? 'text-primary-fixed-dim' : 'text-outline/40 group-hover:text-outline'}`}>
                          {active && sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                      </button>
                    ) : (
                      <p key={h} className="text-[9px] font-black uppercase tracking-widest text-outline">{h}</p>
                    );
                  })}
                </div>

                {sortedRows.map(row => {
                  if (row.rowType === 'year-end-credited') {
                    // Green row — actual interest credited on Mar 31, computed from deposit data
                    return (
                      <div key={row.id}
                        className="grid grid-cols-[1fr_1.2fr_1fr_1.4fr_1fr_56px] gap-3 px-4 py-2.5 items-center rounded-lg"
                        style={{ background: 'rgba(78,222,163,0.04)', border: '1px solid rgba(78,222,163,0.1)' }}
                      >
                        <p className="text-[9px] font-bold text-outline">{row.fy}</p>
                        <p className="text-[9px] font-bold text-secondary/70 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px]">auto_awesome</span>
                          {fmtDate(row.deposit_date)}
                        </p>
                        <p className="text-[10px] text-outline/40">—</p>
                        <p className="text-xs font-bold text-secondary">+{formatINR(row.interest_for_year)}</p>
                        <p className="text-xs font-black text-on-surface">{formatINR(row.closing_balance)}</p>
                        <div />
                      </div>
                    );
                  }

                  if (row.rowType === 'ytd-accrued') {
                    // Amber row — estimated YTD interest for current FY, auto-updates each month
                    return (
                      <div key={row.id}
                        className="grid grid-cols-[1fr_1.2fr_1fr_1.4fr_1fr_56px] gap-3 px-4 py-2.5 items-center rounded-lg"
                        style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.2)' }}
                      >
                        <p className="text-[9px] font-bold text-outline">{row.fy}</p>
                        <p className="text-[9px] font-bold text-gold/70 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px]">schedule</span>
                          Est. YTD · {fmtDate(row.deposit_date)}
                        </p>
                        <p className="text-[10px] text-outline/40">—</p>
                        <div>
                          <p className="text-xs font-bold text-gold">+{formatINR(row.interest_for_year)}</p>
                          {row.projectedFullYearInterest !== undefined && row.projectedFullYearInterest !== row.interest_for_year && (
                            <p className="text-[8px] text-outline mt-0.5">
                              /{formatINR(row.projectedFullYearInterest)} full yr
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant">{formatINR(row.closing_balance)}</p>
                        <div />
                      </div>
                    );
                  }

                  // Deposit row
                  return (
                    <motion.div key={row.id} layout className="rounded-lg overflow-hidden">
                      <div className="grid grid-cols-[1fr_1.2fr_1fr_1.4fr_1fr_56px] gap-3 px-4 py-3 items-center rounded-lg transition-colors hover:bg-surface-container-highest/20">
                        <p className="text-[10px] font-bold text-outline">{row.fy}</p>
                        <p className="text-[10px] text-on-surface-variant">{fmtDate(row.deposit_date)}</p>
                        <p className="text-xs font-bold text-on-surface">{formatINR(row.amount)}</p>
                        <div>
                          <p className="text-xs font-bold text-gold">~{formatINR(Math.round(row.amount * row.interest_rate / 1200))}</p>
                          <p className="text-[8px] text-outline mt-0.5">per month</p>
                        </div>
                        <p className="text-xs text-on-surface-variant">{formatINR(row.closing_balance)}</p>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setEditingContribution(row)} className="text-outline hover:text-primary-fixed-dim transition-colors">
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button onClick={() => deleteContribution(row.id)} className="text-outline hover:text-tertiary transition-colors">
                            <span className="material-symbols-outlined text-sm">delete_outline</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Totals */}
                <div className="grid grid-cols-[1fr_1.2fr_1fr_1.4fr_1fr_56px] gap-3 px-4 pt-3 mt-2 border-t border-outline-variant/15">
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

      <AnimatePresence>
        {editingContribution && (
          <EditContributionModal
            contribution={editingContribution}
            ppfRate={ppfRate}
            onClose={() => setEditingContribution(null)}
            onSave={saveEdit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
