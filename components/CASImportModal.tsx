'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { casFormatINR, isPAN, isMobile, type CASHolding, type CASProvider } from '@/lib/cas-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'credentials' | 'otp' | 'fetching' | 'review' | 'importing' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: (count: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = { background: '#1a2035', border: '1px solid #2f3445' };
const OTP_RESEND_SECONDS = 30;

const FETCH_STEPS = [
  'Connecting to MFCentral…',
  'Verifying PAN…',
  'Fetching mutual fund folios…',
  'Calculating portfolio values…',
  'Almost done…',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: Step }) {
  const steps: Step[] = ['credentials', 'otp', 'review'];
  const idx = steps.indexOf(current);
  return (
    <div className="hidden sm:flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all duration-300',
            current === s ? 'bg-[#4d8eff] text-white shadow-[0_0_12px_rgba(77,142,255,0.5)]' :
            idx > i ? 'bg-[#4edea3]/20 text-[#4edea3]' :
            'bg-[#2f3445] text-[#424754]',
          )}>{idx > i ? '✓' : i + 1}</div>
          {i < 2 && (
            <div className={cn('w-6 h-px transition-all duration-500', idx > i ? 'bg-[#4edea3]/40' : 'bg-[#2f3445]')} />
          )}
        </div>
      ))}
    </div>
  );
}

function InputField({
  label, hint, value, onChange, placeholder, maxLength, type = 'text', error, autoFocus,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; maxLength?: number; type?: string; error?: string; autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-[#8c909f]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={cn(
          'w-full h-12 px-4 rounded-xl text-sm font-bold text-[#dde2f8] placeholder-[#424754] outline-none transition-all',
          'focus:ring-1 focus:ring-[#4d8eff]/60',
          error ? 'ring-1 ring-[#ffb2b7]/60' : '',
        )}
        style={fieldStyle}
      />
      {error ? (
        <p className="text-[10px] text-[#ffb2b7] font-semibold">{error}</p>
      ) : hint ? (
        <p className="text-[10px] text-[#424754]">{hint}</p>
      ) : null}
    </div>
  );
}

function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  function handleChange(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    onChange(next.join('').trimEnd());
    if (d && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      refs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  }

  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          autoFocus={i === 0}
          className={cn(
            'w-11 h-14 rounded-xl text-center text-xl font-black text-[#dde2f8] outline-none transition-all',
            'focus:ring-2 focus:ring-[#4d8eff]/70 focus:bg-[#1e2a44]',
            digits[i] ? 'bg-[#1e2a44] ring-1 ring-[#4d8eff]/40' : 'bg-[#1a2035]',
          )}
          style={{ border: '1px solid #2f3445' }}
        />
      ))}
    </div>
  );
}

function HoldingRow({
  h, checked, onToggle,
}: { h: CASHolding; checked: boolean; onToggle: () => void }) {
  const gain = h.value - h.costValue;
  const gainPct = h.costValue > 0 ? (gain / h.costValue) * 100 : 0;
  return (
    <div
      onClick={onToggle}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all',
        checked ? 'bg-[#1e2a44] ring-1 ring-[#4d8eff]/30' : 'bg-[#1a2035]/60 hover:bg-[#1a2035]',
      )}
    >
      <div className={cn(
        'w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all',
        checked ? 'bg-[#4d8eff]' : 'border border-[#424754]',
      )}>
        {checked && <span className="material-symbols-outlined text-xs text-white" style={{ fontSize: 14 }}>check</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-black text-[#dde2f8] truncate">{h.name}</p>
        <p className="text-[10px] text-[#8c909f] mt-0.5 truncate">
          {h.amc && <span>{h.amc} · </span>}
          {h.folio && <span>Folio {h.folio} · </span>}
          <span>{h.units.toLocaleString('en-IN', { maximumFractionDigits: 3 })} units</span>
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12px] font-black text-[#dde2f8]">{casFormatINR(h.value)}</p>
        {h.costValue > 0 && (
          <p className={cn('text-[10px] font-bold', gain >= 0 ? 'text-[#4edea3]' : 'text-[#ffb2b7]')}>
            {gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main modal content ───────────────────────────────────────────────────────

function ModalContent({ onClose, onImported }: { onClose: () => void; onImported?: (count: number) => void }) {
  const [step, setStep] = useState<Step>('credentials');
  const [provider] = useState<CASProvider>('mfcentral');

  // Step 1
  const [pan, setPan] = useState('');
  const [mobile, setMobile] = useState('');
  const [credError, setCredError] = useState('');

  // Step 2
  const [requestId, setRequestId] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(OTP_RESEND_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 fetch
  const [fetchStep, setFetchStep] = useState(0);

  // Step 4 review
  const [holdings, setHoldings] = useState<CASHolding[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [investorName, setInvestorName] = useState('');

  // Step 5 import
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState('');

  // ── OTP countdown ──
  const startTimer = useCallback(() => {
    setResendTimer(OTP_RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Step 1: Send OTP ──
  async function handleSendOTP() {
    setCredError('');
    if (!isPAN(pan)) { setCredError('Enter a valid 10-character PAN (e.g. ABCDE1234F).'); return; }
    if (!isMobile(mobile)) { setCredError('Enter a valid 10-digit Indian mobile number.'); return; }

    const res = await fetch('/api/cas/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pan: pan.toUpperCase().trim(), mobile: mobile.trim(), provider }),
    });
    const data = await res.json();

    if (!res.ok) { setCredError(data.error ?? 'Failed to send OTP.'); return; }
    setRequestId(data.requestId);
    setMaskedMobile(data.maskedMobile);
    startTimer();
    setStep('otp');
  }

  // ── Step 2: Verify OTP ──
  async function handleVerifyOTP() {
    setOtpError('');
    if (otp.length < 6) { setOtpError('Enter the full 6-digit OTP.'); return; }

    setStep('fetching');
    setFetchStep(0);

    // Animate through fetch steps while the real request runs
    const interval = setInterval(() => {
      setFetchStep((s) => Math.min(s + 1, FETCH_STEPS.length - 1));
    }, 900);

    const res = await fetch('/api/cas/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, otp, provider }),
    });
    clearInterval(interval);

    const data = await res.json();
    if (!res.ok) {
      setOtp('');
      setOtpError(data.error ?? 'Invalid OTP. Please try again.');
      setStep('otp');
      return;
    }

    const fetchedHoldings: CASHolding[] = data.holdings ?? [];
    setHoldings(fetchedHoldings);
    setSelected(new Set(fetchedHoldings.map((_, i) => String(i))));
    setInvestorName(data.name ?? '');
    setStep('review');
  }

  // ── Step 3: Import selected ──
  async function handleImport() {
    setImportError('');
    const toImport = holdings.filter((_, i) => selected.has(String(i)));
    if (toImport.length === 0) return;

    setStep('importing');
    const res = await fetch('/api/cas/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdings: toImport }),
    });
    const data = await res.json();

    if (!res.ok) {
      setImportError(data.error ?? 'Import failed. Please try again.');
      setStep('review');
      return;
    }

    setImportedCount(data.imported ?? toImport.length);
    setStep('done');
    window.dispatchEvent(new Event('sova:refresh'));
    onImported?.(data.imported ?? toImport.length);
  }

  async function handleResend() {
    if (resendTimer > 0) return;
    setOtp('');
    setOtpError('');
    const res = await fetch('/api/cas/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pan: pan.toUpperCase().trim(), mobile: mobile.trim(), provider }),
    });
    if (res.ok) {
      const data = await res.json();
      setRequestId(data.requestId);
      startTimer();
    }
  }

  const totalSelected = holdings.filter((_, i) => selected.has(String(i)));
  const totalValue = totalSelected.reduce((s, h) => s + h.value, 0);
  const totalCost = totalSelected.reduce((s, h) => s + h.costValue, 0);
  const allSelected = selected.size === holdings.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(holdings.map((_, i) => String(i))));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-[210] bg-[#080e1d]/80 backdrop-blur-xl" onClick={onClose} />
      <div className="fixed inset-0 z-[211] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]"
          style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
        >
          {/* Top edge highlight */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-[#2f3445]/60">
            <div>
              <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#D4AF37]">account_balance</span>
                Import via PAN
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">
                Mutual Funds · CAS · MFCentral
              </p>
            </div>
            {(step === 'credentials' || step === 'otp' || step === 'review') && (
              <StepDots current={step} />
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <div className="p-8 max-h-[78vh] overflow-y-auto scrollbar-thin">
            <AnimatePresence mode="wait">

              {/* ── Step 1: PAN + Mobile ── */}
              {step === 'credentials' && (
                <motion.div key="credentials" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div className="p-4 rounded-xl flex items-start gap-3" style={fieldStyle}>
                    <span className="material-symbols-outlined text-[#D4AF37] mt-0.5 shrink-0" style={{ fontSize: 18 }}>info</span>
                    <p className="text-[11px] text-[#8c909f] leading-relaxed">
                      SOVA uses <span className="text-[#adc6ff] font-bold">MFCentral</span> — the official CAMS+KFintech platform — to securely fetch your complete mutual fund portfolio. Your credentials are never stored.
                    </p>
                  </div>

                  <InputField
                    label="PAN Card Number"
                    placeholder="ABCDE1234F"
                    value={pan}
                    onChange={(v) => { setPan(v.toUpperCase()); setCredError(''); }}
                    maxLength={10}
                    autoFocus
                    hint="Your 10-character Permanent Account Number"
                  />

                  <InputField
                    label="Registered Mobile Number"
                    placeholder="9XXXXXXXXX"
                    value={mobile}
                    onChange={(v) => { setMobile(v.replace(/\D/g, '').slice(0, 10)); setCredError(''); }}
                    maxLength={10}
                    type="tel"
                    hint="Mobile registered with your mutual fund folios"
                  />

                  {credError && (
                    <div className="p-3 rounded-xl bg-[#ffb2b7]/10 border border-[#ffb2b7]/20">
                      <p className="text-[11px] text-[#ffb2b7] font-semibold">{credError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleSendOTP}
                    disabled={pan.length < 10 || mobile.length < 10}
                    className="w-full h-13 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.01]"
                    style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.2)' }}
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    Send OTP
                  </button>

                  <p className="text-center text-[9px] text-[#424754] leading-relaxed">
                    An OTP will be sent to your CAMS/KFintech-registered mobile number.
                    SOVA does not store your PAN or mobile number.
                  </p>
                </motion.div>
              )}

              {/* ── Step 2: OTP ── */}
              {step === 'otp' && (
                <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-7">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-black text-[#dde2f8]">Enter the OTP</p>
                    <p className="text-[11px] text-[#8c909f]">
                      Sent to <span className="text-[#adc6ff] font-bold">{maskedMobile}</span> via MFCentral
                    </p>
                  </div>

                  <OTPInput value={otp} onChange={setOtp} />

                  {otpError && (
                    <div className="p-3 rounded-xl bg-[#ffb2b7]/10 border border-[#ffb2b7]/20 text-center">
                      <p className="text-[11px] text-[#ffb2b7] font-semibold">{otpError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleVerifyOTP}
                    disabled={otp.length < 6}
                    className="w-full h-13 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.01]"
                    style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.2)' }}
                  >
                    <span className="material-symbols-outlined text-sm">lock_open</span>
                    Verify & Fetch Portfolio
                  </button>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => { setStep('credentials'); setOtp(''); setOtpError(''); }}
                      className="text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
                    >
                      ← Change details
                    </button>
                    <button
                      onClick={handleResend}
                      disabled={resendTimer > 0}
                      className="text-[10px] font-black uppercase tracking-widest transition-colors disabled:text-[#424754] text-[#adc6ff] hover:text-[#dde2f8] disabled:cursor-not-allowed"
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Fetching ── */}
              {step === 'fetching' && (
                <motion.div key="fetching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-14 gap-6">
                  <div className="relative w-20 h-20">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 rounded-full"
                      style={{ border: '2px solid transparent', borderTopColor: '#4d8eff', borderRightColor: '#adc6ff30' }}
                    />
                    <div className="absolute inset-3 rounded-full flex items-center justify-center" style={{ background: 'rgba(77,142,255,0.1)' }}>
                      <span className="material-symbols-outlined text-2xl text-[#4d8eff]">account_balance</span>
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-black text-[#dde2f8]">Fetching your portfolio…</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={fetchStep}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="text-[11px] text-[#8c909f]"
                      >
                        {FETCH_STEPS[fetchStep]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <div className="w-48 h-1 rounded-full bg-[#2f3445] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #4d8eff, #adc6ff)' }}
                      initial={{ width: '5%' }}
                      animate={{ width: `${((fetchStep + 1) / FETCH_STEPS.length) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>
              )}

              {/* ── Review ── */}
              {step === 'review' && (
                <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  {/* Investor banner */}
                  <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: 'rgba(78,222,163,0.08)', border: '1px solid rgba(78,222,163,0.2)' }}>
                    <span className="material-symbols-outlined text-[#4edea3]" style={{ fontSize: 20 }}>person_check</span>
                    <div>
                      <p className="text-[11px] font-black text-[#4edea3]">Portfolio fetched successfully</p>
                      <p className="text-[10px] text-[#8c909f] mt-0.5">
                        {investorName && <span className="text-[#dde2f8] font-bold">{investorName} · </span>}
                        {holdings.length} mutual fund folios found
                      </p>
                    </div>
                  </div>

                  {/* Summary bar */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Selected', value: `${selected.size}/${holdings.length}` },
                      { label: 'Current Value', value: casFormatINR(totalValue) },
                      { label: 'Invested', value: casFormatINR(totalCost) },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-xl text-center" style={fieldStyle}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#8c909f]">{label}</p>
                        <p className="text-sm font-black text-[#dde2f8] mt-1">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Select all */}
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8c909f]">
                      Mutual Fund Folios
                    </p>
                    <button
                      onClick={toggleAll}
                      className="text-[10px] font-black uppercase tracking-widest text-[#adc6ff] hover:text-[#dde2f8] transition-colors"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Holdings list */}
                  {holdings.length === 0 ? (
                    <div className="py-10 text-center">
                      <span className="material-symbols-outlined text-4xl text-[#424754] block mb-3">folder_open</span>
                      <p className="text-sm font-black text-[#dde2f8]">No mutual fund holdings found</p>
                      <p className="text-[10px] text-[#8c909f] mt-1">Your PAN may not have any active MF folios.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                      {holdings.map((h, i) => (
                        <HoldingRow
                          key={i}
                          h={h}
                          checked={selected.has(String(i))}
                          onToggle={() => {
                            const next = new Set(selected);
                            next.has(String(i)) ? next.delete(String(i)) : next.add(String(i));
                            setSelected(next);
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {importError && (
                    <div className="p-3 rounded-xl bg-[#ffb2b7]/10 border border-[#ffb2b7]/20">
                      <p className="text-[11px] text-[#ffb2b7] font-semibold">{importError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleImport}
                    disabled={selected.size === 0}
                    className="w-full h-13 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.01]"
                    style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.2)' }}
                  >
                    <span className="material-symbols-outlined text-sm">cloud_done</span>
                    Import {selected.size} Holding{selected.size !== 1 ? 's' : ''}
                  </button>
                </motion.div>
              )}

              {/* ── Importing ── */}
              {step === 'importing' && (
                <motion.div key="importing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-14 gap-5">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-14 h-14 rounded-full"
                    style={{ border: '2px solid transparent', borderTopColor: '#4edea3', borderRightColor: 'rgba(78,222,163,0.2)' }}
                  />
                  <div className="text-center">
                    <p className="text-sm font-black text-[#dde2f8]">Saving to your portfolio…</p>
                    <p className="text-[11px] text-[#8c909f] mt-1">Adding {selected.size} holdings to Activity Ledger</p>
                  </div>
                </motion.div>
              )}

              {/* ── Done ── */}
              {step === 'done' && (
                <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-14 gap-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(78,222,163,0.15)' }}
                  >
                    <span className="material-symbols-outlined text-4xl text-[#4edea3]">check_circle</span>
                  </motion.div>
                  <div className="text-center space-y-1">
                    <p className="text-base font-black text-[#dde2f8]">Import Complete</p>
                    <p className="text-[11px] text-[#8c909f]">
                      <span className="text-[#4edea3] font-bold">{importedCount} holding{importedCount !== 1 ? 's' : ''}</span> added to your portfolio
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="px-8 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#dde2f8] hover:bg-[#2f3445] transition-colors"
                      style={fieldStyle}
                    >
                      Close
                    </button>
                    <button
                      onClick={() => { setPan(''); setMobile(''); setOtp(''); setStep('credentials'); setHoldings([]); setSelected(new Set()); }}
                      className="px-8 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#adc6ff] hover:text-[#dde2f8] transition-colors"
                      style={fieldStyle}
                    >
                      Import another PAN
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
}

// ─── Portal wrapper ───────────────────────────────────────────────────────────

export function CASImportModal({ open, onClose, onImported }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>{open && <ModalContent onClose={onClose} onImported={onImported} />}</AnimatePresence>,
    document.body,
  );
}
