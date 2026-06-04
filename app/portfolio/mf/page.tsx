'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR, cn } from '@/lib/utils';
import { createPortal } from 'react-dom';


type LumpSumEntry = {
  date: string;   // YYYY-MM-DD
  amount: number;
  note?: string;
};

type SIP = {
  id: string;
  fund_name: string;
  fund_code?: string;
  amount: number;
  debit_date?: string;
  start_date?: string;
  status: 'active' | 'paused';
  total_invested: number;
  current_value: number;
  units: number;
  nav?: number;
  lump_sum?: number;
  lump_sums?: LumpSumEntry[];
  missed_amount?: number;
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

function computeAutoInvested(sip: SIP): number {
  const amount = Number(sip.amount ?? 0);
  const legacyLump = Number(sip.lump_sum ?? 0);
  const arrayLump = (sip.lump_sums ?? []).reduce((a, ls) => a + Number(ls.amount), 0);
  const totalLump = legacyLump + arrayLump;
  const missed = Number(sip.missed_amount ?? 0);

  if (!sip.start_date || !sip.debit_date) return Math.max(0, totalLump - missed);

  const start = new Date(sip.start_date);
  const debitDay = new Date(sip.debit_date).getDate();
  const today = new Date();
  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), debitDay);
  while (cur <= today) {
    count++;
    cur.setMonth(cur.getMonth() + 1);
  }
  return Math.max(0, count * amount + totalLump - missed);
}

/* ── XIRR ───────────────────────────────────────────────────────────── */
function xirrCalc(cashflows: { amount: number; date: Date }[]): number | null {
  if (cashflows.length < 2) return null;
  const t0 = cashflows[0].date.getTime();
  const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
  let rate = 0.1;
  for (let i = 0; i < 200; i++) {
    let f = 0, df = 0;
    for (const cf of cashflows) {
      const t = (cf.date.getTime() - t0) / YEAR_MS;
      const base = Math.pow(1 + rate, t);
      f += cf.amount / base;
      df -= t * cf.amount / (base * (1 + rate));
    }
    if (Math.abs(df) < 1e-12) return null;
    const next = rate - f / df;
    if (Math.abs(next - rate) < 1e-8) return next;
    rate = next;
  }
  return null;
}

function computePortfolioXIRR(sips: SIP[]): number | null {
  const today = new Date();
  const cashflows: { amount: number; date: Date }[] = [];
  let totalCurrentValue = 0;

  for (const sip of sips) {
    const cv = Number(sip.current_value ?? 0);
    if (cv <= 0) continue;
    totalCurrentValue += cv;

    if (sip.start_date && sip.debit_date) {
      const start = new Date(sip.start_date);
      const debitDay = new Date(sip.debit_date).getDate();
      const cur = new Date(start.getFullYear(), start.getMonth(), debitDay);
      while (cur <= today) {
        cashflows.push({ amount: -Number(sip.amount), date: new Date(cur) });
        cur.setMonth(cur.getMonth() + 1);
      }
    }
    // Legacy single lump sum on start_date
    if (Number(sip.lump_sum ?? 0) > 0) {
      cashflows.push({
        amount: -Number(sip.lump_sum),
        date: sip.start_date ? new Date(sip.start_date) : today,
      });
    }
    // Dated lump sums
    for (const ls of sip.lump_sums ?? []) {
      cashflows.push({ amount: -Number(ls.amount), date: new Date(ls.date) });
    }
  }

  if (totalCurrentValue <= 0 || cashflows.length === 0) return null;
  cashflows.push({ amount: totalCurrentValue, date: today });
  cashflows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return xirrCalc(cashflows);
}

/* ── Transaction builder ────────────────────────────────────────────── */
type TxRow = {
  key: string;
  fund_name: string;
  date: Date;
  type: 'SIP' | 'Lump Sum';
  amount: number;
};

function buildTransactions(sips: SIP[]): TxRow[] {
  const rows: TxRow[] = [];
  const today = new Date();

  for (const sip of sips) {
    if (sip.start_date && sip.debit_date) {
      const start = new Date(sip.start_date);
      const debitDay = new Date(sip.debit_date).getDate();
      const cur = new Date(start.getFullYear(), start.getMonth(), debitDay);
      let idx = 0;
      while (cur <= today) {
        rows.push({ key: `${sip.id}-s${idx}`, fund_name: sip.fund_name, date: new Date(cur), type: 'SIP', amount: Number(sip.amount) });
        cur.setMonth(cur.getMonth() + 1);
        idx++;
      }
    }
    if (Number(sip.lump_sum ?? 0) > 0) {
      rows.push({ key: `${sip.id}-l0`, fund_name: sip.fund_name, date: sip.start_date ? new Date(sip.start_date) : today, type: 'Lump Sum', amount: Number(sip.lump_sum) });
    }
    for (const ls of sip.lump_sums ?? []) {
      rows.push({ key: `${sip.id}-la-${ls.date}`, fund_name: sip.fund_name, date: new Date(ls.date), type: 'Lump Sum', amount: Number(ls.amount) });
    }
  }

  // Sort ascending to compute running totals, then reverse for display
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0;
  const withTotals = rows.map((r) => { running += r.amount; return { ...r, runningTotal: running }; });
  return withTotals.reverse();
}

/* ── Shared input style ─────────────────────────────────────────────── */
const inputCls = 'w-full rounded-lg px-4 py-3 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 transition-all';
const inputStyle = { background: '#1a2035', border: '1px solid #2f3445' };
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2';

/* ── Add SIP Modal ──────────────────────────────────────────────────── */
function AddSIPModal({ onClose, onSave }: { onClose: () => void; onSave: (sip: Partial<SIP>) => void }) {
  const [form, setForm] = useState({ fund_name: '', amount: '', debit_date: '', start_date: '', lump_sum: '' });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function submit() {
    if (!form.fund_name || !form.amount) return;
    onSave({
      fund_name: form.fund_name,
      amount: Number(form.amount),
      debit_date: form.debit_date || undefined,
      start_date: form.start_date || undefined,
      lump_sum: form.lump_sum ? Number(form.lump_sum) : 0,
    });
    onClose();
  }

  const totalFirst = (Number(form.amount) || 0) + (Number(form.lump_sum) || 0);

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
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#2f3445]/60">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#D4AF37] text-xl">autorenew</span>
              Add New SIP
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">
              Set up a recurring monthly investment
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={labelCls}>Fund Name *</label>
            <input
              type="text"
              placeholder="e.g. Parag Parikh Flexi Cap"
              value={form.fund_name}
              onChange={(e) => setForm((f) => ({ ...f, fund_name: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Monthly Amount (₹) *</label>
              <input
                type="number"
                placeholder="e.g. 10000"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>One-time Lumpsum (₹)</label>
              <input
                type="number"
                placeholder="Optional upfront"
                value={form.lump_sum}
                onChange={(e) => setForm((f) => ({ ...f, lump_sum: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>SIP Started On</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className={inputCls + ' [color-scheme:dark]'}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Monthly Debit Date</label>
              <input
                type="date"
                value={form.debit_date}
                onChange={(e) => setForm((f) => ({ ...f, debit_date: e.target.value }))}
                className={inputCls + ' [color-scheme:dark]'}
                style={inputStyle}
              />
            </div>
          </div>
          <p className="text-[9px] text-[#424754] font-semibold -mt-2">
            Set the start date so auto-invested total is calculated correctly each month.
            The day of month in the debit date repeats monthly.
          </p>

          {totalFirst > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl flex items-center justify-between"
              style={{ background: '#1a2035', border: '1px solid #2f3445' }}
            >
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8c909f]">First Month Total</p>
                {Number(form.lump_sum) > 0 && (
                  <p className="text-[9px] text-[#424754] mt-0.5">
                    ₹{Number(form.amount).toLocaleString('en-IN')} SIP + ₹{Number(form.lump_sum).toLocaleString('en-IN')} lumpsum
                  </p>
                )}
              </div>
              <p className="text-2xl font-black text-[#4edea3]">₹{totalFirst.toLocaleString('en-IN')}</p>
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
              disabled={!form.fund_name || !form.amount}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-40 disabled:pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                color: '#001a42',
                boxShadow: '0 0 24px rgba(173,198,255,0.25)',
              }}
            >
              <span className="material-symbols-outlined text-sm">autorenew</span>
              Add SIP
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

/* ── Edit SIP Modal ─────────────────────────────────────────────────── */
function EditSIPModal({ sip, onClose, onSave }: { sip: SIP; onClose: () => void; onSave: (id: string, updates: Partial<SIP>) => void }) {
  const [form, setForm] = useState({
    fund_name: sip.fund_name,
    amount: String(sip.amount),
    debit_date: sip.debit_date ?? '',
    start_date: sip.start_date ?? '',
    lump_sum: String(sip.lump_sum ?? ''),
    missed_amount: Number(sip.missed_amount ?? 0) > 0 ? String(sip.missed_amount) : '',
  });
  const [lumpSums, setLumpSums] = useState<LumpSumEntry[]>(sip.lump_sums ?? []);
  const [newLS, setNewLS] = useState({ date: '', amount: '', note: '' });
  const [showLSForm, setShowLSForm] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function addLumpSum() {
    if (!newLS.date || !newLS.amount) return;
    setLumpSums((prev) => [...prev, { date: newLS.date, amount: Number(newLS.amount), note: newLS.note || undefined }]);
    setNewLS({ date: '', amount: '', note: '' });
    setShowLSForm(false);
  }

  function submit() {
    if (!form.fund_name || !form.amount) return;
    onSave(sip.id, {
      fund_name: form.fund_name,
      amount: Number(form.amount),
      debit_date: form.debit_date || undefined,
      start_date: form.start_date || undefined,
      lump_sum: form.lump_sum ? Number(form.lump_sum) : 0,
      missed_amount: form.missed_amount ? Number(form.missed_amount) : 0,
      lump_sums: lumpSums,
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
        className="relative w-full max-w-md bg-[#0f1526] rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#2f3445]/60">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#adc6ff] text-xl">edit</span>
              Edit SIP
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">
              Update SIP details and schedule
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={labelCls}>Fund Name</label>
            <input
              type="text"
              value={form.fund_name}
              onChange={(e) => setForm((f) => ({ ...f, fund_name: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Monthly Amount (₹)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>One-time Lumpsum (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={form.lump_sum}
                onChange={(e) => setForm((f) => ({ ...f, lump_sum: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>SIP Started On</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className={inputCls + ' [color-scheme:dark]'}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Monthly Debit Date</label>
              <input
                type="date"
                value={form.debit_date}
                onChange={(e) => setForm((f) => ({ ...f, debit_date: e.target.value }))}
                className={inputCls + ' [color-scheme:dark]'}
                style={inputStyle}
              />
            </div>
          </div>
          <p className="text-[9px] text-[#424754] font-semibold -mt-2">
            The day of month in the debit date repeats every month.
          </p>

          {/* Additional Lump Sums */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#111827', border: '1px solid #2f3445' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8c909f]">Additional Lump Sums</p>
                <p className="text-[9px] text-[#424754] mt-0.5">Add extra one-time investments with their exact dates.</p>
              </div>
              <button
                onClick={() => setShowLSForm((v) => !v)}
                className="text-[9px] font-black uppercase tracking-widest text-[#adc6ff] hover:text-white transition-colors ml-4 shrink-0"
              >
                + Add
              </button>
            </div>
            {lumpSums.length > 0 && (
              <div className="space-y-1.5">
                {lumpSums.map((ls, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#1a2035' }}>
                    <div>
                      <span className="text-[10px] font-bold text-[#dde2f8]">₹{Number(ls.amount).toLocaleString('en-IN')}</span>
                      <span className="text-[9px] text-[#8c909f] ml-2">{new Date(ls.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {ls.note && <span className="text-[9px] text-[#424754] ml-2">· {ls.note}</span>}
                    </div>
                    <button onClick={() => setLumpSums((prev) => prev.filter((_, j) => j !== i))} className="text-[#ffb2b7] hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {showLSForm && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Date *</label>
                    <input type="date" value={newLS.date} onChange={(e) => setNewLS((f) => ({ ...f, date: e.target.value }))} className={inputCls + ' [color-scheme:dark]'} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls}>Amount (₹) *</label>
                    <input type="number" placeholder="e.g. 19999" value={newLS.amount} onChange={(e) => setNewLS((f) => ({ ...f, amount: e.target.value }))} className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <input type="text" placeholder="Note (optional)" value={newLS.note} onChange={(e) => setNewLS((f) => ({ ...f, note: e.target.value }))} className={inputCls} style={inputStyle} />
                <button
                  onClick={addLumpSum}
                  disabled={!newLS.date || !newLS.amount}
                  className="w-full h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42' }}
                >
                  Confirm Lump Sum
                </button>
              </div>
            )}
          </div>

          {/* Missed / irregular correction */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#111827', border: '1px solid #2f3445' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8c909f]">Missed / Irregular Deduction</p>
                <p className="text-[9px] text-[#424754] mt-0.5">
                  Total amount of installments that were skipped or failed. Subtracted from auto-calc permanently — set once, stays correct every month.
                </p>
              </div>
              {form.missed_amount && (
                <button
                  onClick={() => setForm((f) => ({ ...f, missed_amount: '' }))}
                  className="text-[9px] font-black uppercase tracking-widest text-[#ffb2b7] hover:text-white transition-colors ml-4 shrink-0"
                >
                  × Clear
                </button>
              )}
            </div>
            <input
              type="number"
              placeholder="e.g. 2500 for one missed installment"
              value={form.missed_amount}
              onChange={(e) => setForm((f) => ({ ...f, missed_amount: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            />
            {form.missed_amount && (
              <p className="text-[9px] font-semibold text-[#ffb2b7]">
                ₹{Number(form.missed_amount).toLocaleString('en-IN')} will be permanently deducted from the auto-calculated total.
              </p>
            )}
          </div>

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
              disabled={!form.fund_name || !form.amount}
              className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-40 disabled:pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                color: '#001a42',
                boxShadow: '0 0 24px rgba(173,198,255,0.25)',
              }}
            >
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

/* ── SIP Row ────────────────────────────────────────────────────────── */
function SIPRow({ sip, onUpdate, onDelete, onEdit }: {
  sip: SIP;
  onUpdate: (id: string, updates: Partial<SIP>) => void;
  onDelete: (id: string) => void;
  onEdit: (sip: SIP) => void;
}) {
  const autoInvested = computeAutoInvested(sip);

  return (
    <motion.div
      layout
      className="rounded-xl bg-surface-container-highest/20 hover:bg-surface-container-highest/30 transition-colors"
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
            <p className="text-[9px] text-outline font-bold uppercase tracking-widest mt-0.5">
              Started {fmtDate(sip.start_date)} · Next {nextSIPDate(sip.debit_date)}
            </p>
            {autoInvested > 0 && (
              <p className="text-[9px] text-secondary/80 font-bold mt-0.5">
                Auto-invested: {formatINR(autoInvested)}
                {Number(sip.lump_sum ?? 0) > 0 && (
                  <span className="text-gold"> (incl. {formatINR(Number(sip.lump_sum))} lumpsum)</span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <p className="text-xs font-black text-on-surface">{formatINR(Number(sip.amount))}</p>
          <span className={cn(
            'text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
            sip.status === 'active'
              ? 'bg-secondary/15 text-secondary'
              : 'bg-outline/15 text-outline',
          )}>
            {sip.status}
          </span>
          <button
            onClick={() => onEdit(sip)}
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
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function MFPage() {
  const [sips, setSips] = useState<SIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSIP, setEditingSIP] = useState<SIP | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'schemes' | 'history'>('overview');

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
  const monthlySIP = activeSIPs.reduce((a, s) => a + Number(s.amount ?? 0), 0);
  const totalBookValue = sips.reduce((a, s) => a + computeAutoInvested(s), 0);

  const xirr = computePortfolioXIRR(sips);
  const transactions = buildTransactions(sips);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'schedule', label: 'SIP Schedule', icon: 'autorenew' },
    { id: 'schemes', label: 'MF Schemes', icon: 'pie_chart' },
    { id: 'history', label: 'Transaction History', icon: 'receipt_long' },
  ] as const;

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-8 pb-16 flex-1 min-w-0">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard label="MF Book Value" value={totalBookValue} format="inr" icon="pie_chart" />
        <KPICard
          label="Monthly SIP"
          value={monthlySIP}
          format="inr"
          accent="primary"
          icon="autorenew"
          sub={`${activeSIPs.length} active SIP${activeSIPs.length !== 1 ? 's' : ''}`}
        />
        <KPICard
          label="Avg XIRR"
          value={xirr != null ? xirr * 100 : 0}
          format="percent"
          accent={xirr != null && xirr > 0 ? 'positive' : 'neutral'}
          sub={xirr != null ? 'Based on current NAV' : 'Needs current NAV data'}
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
          <SectionHeader title="Fund Allocation" subtitle="Monthly SIP split by fund" className="mb-6" />
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
                const pct = monthlySIP > 0 ? Math.round((Number(s.amount) / monthlySIP) * 100) : 0;
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
            subtitle="Pause, resume, or edit at any time"
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
              <p className="text-sm text-outline mt-4 mb-6">No SIPs added yet.</p>
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
                  <SIPRow
                    key={s.id}
                    sip={s}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onEdit={(sip) => setEditingSIP(sip)}
                  />
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
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-3 px-4 pb-2 border-b border-outline-variant/10">
                {['Fund', 'SIP / Month', 'Lumpsum', 'Auto-Invested', 'Next Debit', 'Status'].map((h) => (
                  <p key={h} className="text-[9px] font-black uppercase tracking-widest text-outline">{h}</p>
                ))}
              </div>
              {sips.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-3 px-4 py-3 rounded-lg hover:bg-surface-container-highest/20 transition-colors items-center"
                >
                  <div>
                    <p className="text-xs font-bold text-on-surface">{s.fund_name}</p>
                    <p className="text-[9px] text-outline mt-0.5">Since {fmtDate(s.start_date)}</p>
                  </div>
                  <p className="text-xs font-black text-on-surface">{formatINR(Number(s.amount))}</p>
                  <p className="text-xs font-bold text-gold">{Number(s.lump_sum ?? 0) > 0 ? formatINR(Number(s.lump_sum)) : '—'}</p>
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
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-3 px-4 pt-3 mt-2 border-t border-outline-variant/15 items-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-outline col-span-3">Portfolio Total</p>
                <p className="text-sm font-black text-secondary">{formatINR(totalBookValue)}</p>
                <div /><div />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Transaction History */}
      {activeTab === 'history' && (
        <Card tier="low" className="p-8">
          <SectionHeader
            title="Transaction History"
            subtitle="All SIP installments and lump sum investments"
            className="mb-6"
          />
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-outline">receipt_long</span>
              <p className="text-sm text-outline mt-3">No transactions yet. Add a SIP to see history.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[120px_2fr_100px_120px_130px] gap-3 px-4 pb-2 border-b border-outline-variant/10">
                {['Date', 'Fund', 'Type', 'Amount', 'Cumulative'].map((h) => (
                  <p key={h} className="text-[9px] font-black uppercase tracking-widest text-outline">{h}</p>
                ))}
              </div>
              {(transactions as (TxRow & { runningTotal: number })[]).map((tx) => (
                <div
                  key={tx.key}
                  className="grid grid-cols-[120px_2fr_100px_120px_130px] gap-3 px-4 py-2.5 rounded-lg hover:bg-surface-container-highest/20 transition-colors items-center"
                >
                  <p className="text-[10px] font-bold text-on-surface-variant">
                    {tx.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs font-bold text-on-surface truncate">{tx.fund_name}</p>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit ${
                    tx.type === 'SIP' ? 'bg-primary/10 text-primary-fixed-dim' : 'bg-gold/10 text-gold'
                  }`}>
                    {tx.type}
                  </span>
                  <p className="text-xs font-black text-on-surface">{formatINR(tx.amount)}</p>
                  <p className="text-xs font-bold text-secondary">{formatINR(tx.runningTotal)}</p>
                </div>
              ))}
              {/* Footer total */}
              <div className="grid grid-cols-[120px_2fr_100px_120px_130px] gap-3 px-4 pt-3 mt-1 border-t border-outline-variant/15 items-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-outline col-span-4">Total Invested</p>
                <p className="text-sm font-black text-secondary">{formatINR(totalBookValue)}</p>
              </div>
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

      {/* Edit SIP Modal */}
      <AnimatePresence>
        {editingSIP && (
          <EditSIPModal
            sip={editingSIP}
            onClose={() => setEditingSIP(null)}
            onSave={handleUpdate}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
