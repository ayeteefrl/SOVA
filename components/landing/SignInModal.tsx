'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Props {
  onClose: () => void;
}

export default function SignInModal({ onClose }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function startResendTimer() {
    setResendCountdown(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCountdown((p) => {
        if (p <= 1) { clearInterval(timerRef.current!); return 0; }
        return p - 1;
      });
    }, 1000);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Invalid credentials. Please try again.');
        return;
      }
      router.push('/home');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
    } catch { /* silent */ }
    setForgotSent(true);
    setForgotLoading(false);
    startResendTimer();
  }

  async function handleResend() {
    if (resendCountdown > 0) return;
    setForgotLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
    } catch {}
    setForgotLoading(false);
    startResendTimer();
  }

  const inputWrap = 'flex items-center gap-2 rounded-lg px-3 focus-within:ring-1 focus-within:ring-primary/40 transition-all';
  const inputStyle = { background: '#1a2035', border: '1px solid #2f3445' };
  const inputCls = 'flex-1 bg-transparent py-3 text-sm text-on-surface placeholder:text-outline/40 outline-none';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#080e1d]/80 backdrop-blur-md"
        onClick={onClose}
      />

      <AnimatePresence mode="wait">
        {!showForgot ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-sm"
          >
            {/* Logo */}
            <div className="flex flex-col items-center mb-7">
              <Link href="/" onClick={onClose} className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9">
                  <img src="/sovalogo.svg" alt="SOVA" className="w-full h-full object-contain" />
                </div>
                <span className="text-xl font-black tracking-tighter gradient-text-primary">SOVA</span>
              </Link>
              <p className="text-[10px] uppercase tracking-[0.3em] text-outline font-semibold">Private Wealth Terminal</p>
            </div>

            <div
              className="rounded-2xl p-8 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.45)' }}
            >
              {/* shimmer */}
              <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-[#adc6ff1a] to-transparent" />

              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-black tracking-tight text-on-surface">Welcome back</h2>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-highest/40 transition-colors">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <p className="text-[11px] text-outline font-semibold mb-7">Sign in to your portfolio terminal</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">Email Address</label>
                  <div className={inputWrap} style={inputStyle}>
                    <span className="material-symbols-outlined text-sm text-outline shrink-0">mail</span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading}
                      placeholder="you@example.com" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">Password</label>
                  <div className={inputWrap} style={inputStyle}>
                    <span className="material-symbols-outlined text-sm text-outline shrink-0">lock</span>
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      required disabled={loading} placeholder="••••••••" className={inputCls} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="text-outline hover:text-on-surface transition-colors shrink-0">
                      <span className="material-symbols-outlined text-sm">{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-tertiary/10 ring-1 ring-tertiary/25 overflow-hidden">
                      <span className="material-symbols-outlined text-sm text-tertiary shrink-0">error</span>
                      <p className="text-[11px] text-tertiary font-semibold">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-end">
                  <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                    className="text-[10px] font-bold text-outline hover:text-primary-fixed-dim transition-colors uppercase tracking-widest">
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full h-11 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-60 hover:scale-[1.01]"
                  style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.2)' }}>
                  {loading ? (
                    <><span className="w-4 h-4 rounded-full border-2 border-[#001a42]/30 border-t-[#001a42] animate-spin" />Signing in…</>
                  ) : (
                    <><span className="material-symbols-outlined text-sm">login</span>Sign In</>
                  )}
                </button>
              </form>

              <p className="text-center text-[11px] text-outline font-semibold mt-5">
                No account?{' '}
                <Link href="/signup" onClick={onClose} className="text-primary-fixed-dim hover:text-primary transition-colors font-bold">
                  Create one
                </Link>
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="forgot"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-sm"
          >
            <div
              className="rounded-2xl p-8 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.45)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => { setShowForgot(false); setForgotSent(false); }}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-outline hover:text-on-surface transition-colors">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>Back to sign in
                </button>
                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-highest/40 transition-colors">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <h2 className="text-lg font-black tracking-tight text-on-surface mb-1">Reset password</h2>
              <p className="text-[11px] text-outline font-semibold mb-7">Enter your email and we&apos;ll send a reset link.</p>

              {forgotSent ? (
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="material-symbols-outlined text-4xl text-secondary">mark_email_read</span>
                  <p className="text-sm font-black text-on-surface">Check your inbox</p>
                  <p className="text-[11px] text-outline font-semibold leading-relaxed">
                    Reset link sent to <span className="text-primary-fixed-dim">{forgotEmail}</span>
                  </p>
                  {resendCountdown > 0 ? (
                    <p className="text-[10px] text-outline font-semibold">
                      Resend in <span className="text-primary-fixed-dim font-black tabular-nums">{resendCountdown}s</span>
                    </p>
                  ) : (
                    <button onClick={handleResend} disabled={forgotLoading}
                      className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary-fixed-dim transition-colors disabled:opacity-40 flex items-center gap-1">
                      {forgotLoading
                        ? <span className="w-3 h-3 rounded-full border border-primary/30 border-t-primary animate-spin" />
                        : <span className="material-symbols-outlined text-xs">send</span>}
                      Send again
                    </button>
                  )}
                </motion.div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">Email Address</label>
                    <div className={inputWrap} style={inputStyle}>
                      <span className="material-symbols-outlined text-sm text-outline shrink-0">mail</span>
                      <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                        required placeholder="you@example.com" className={inputCls} />
                    </div>
                  </div>
                  <button type="submit" disabled={forgotLoading}
                    className="w-full h-11 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    style={{ background: '#1e2538', border: '1px solid #2f3445', color: '#adc6ff' }}>
                    {forgotLoading
                      ? <><span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />Sending…</>
                      : <><span className="material-symbols-outlined text-sm">send</span>Send Reset Link</>}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
