'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-surface flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset link');
      setValidating(false);
      return;
    }

    // Verify token validity
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (r.ok) setTokenValid(true);
        else setError('This reset link has expired or is invalid.');
        setValidating(false);
      })
      .catch(() => {
        setError('Failed to verify reset link');
        setValidating(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Both fields are required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to reset password');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gold/5 rounded-full blur-[100px] pointer-events-none" />

      {/* SOVA Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-10"
      >
        <div className="w-14 h-14 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-full h-full">
            <defs>
              <linearGradient id="sova-reset-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#adc6ff" />
                <stop offset="100%" stopColor="#D4AF37" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="#0d1322" />
            <path d="M8 22 L8 10 L16 18 L24 10 L24 22" fill="none" stroke="url(#sova-reset-g)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-2xl font-black tracking-tighter gradient-text-primary">SOVA</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-outline font-semibold mt-1">Private Wealth Terminal</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {validating ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm"
          >
            <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
              <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-[11px] text-outline font-semibold uppercase tracking-widest">Verifying reset link…</p>
            </div>
          </motion.div>
        ) : success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm"
          >
            <div
              className="rounded-2xl p-8 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7)]"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="material-symbols-outlined text-4xl text-secondary">check_circle</span>
                <h2 className="text-lg font-black tracking-tight text-on-surface">Password reset successfully</h2>
                <p className="text-[11px] text-outline font-semibold">Redirecting you to login…</p>
              </div>
            </div>
          </motion.div>
        ) : !tokenValid ? (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm"
          >
            <div
              className="rounded-2xl p-8 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7)]"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="material-symbols-outlined text-4xl text-tertiary">error</span>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-on-surface mb-1">Link expired</h2>
                  <p className="text-[11px] text-outline font-semibold">{error}</p>
                </div>
                <a
                  href="/login"
                  className="mt-4 inline-block px-6 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest"
                  style={{
                    background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                    color: '#001a42',
                  }}
                >
                  Back to Login
                </a>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <div
              className="rounded-2xl p-8 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7)]"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
            >
              <h1 className="text-lg font-black tracking-tight text-on-surface mb-1">Reset password</h1>
              <p className="text-[11px] text-outline font-semibold mb-7">Enter your new password below</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">
                    New Password
                  </label>
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 focus-within:ring-1 focus-within:ring-primary/40 transition-all"
                    style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                  >
                    <span className="material-symbols-outlined text-sm text-outline shrink-0">lock</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="••••••••"
                      className="flex-1 bg-transparent py-3 text-sm text-on-surface placeholder:text-outline/40 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-outline hover:text-on-surface transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">
                    Confirm Password
                  </label>
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 focus-within:ring-1 focus-within:ring-primary/40 transition-all"
                    style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                  >
                    <span className="material-symbols-outlined text-sm text-outline shrink-0">lock</span>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="••••••••"
                      className="flex-1 bg-transparent py-3 text-sm text-on-surface placeholder:text-outline/40 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="text-outline hover:text-on-surface transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showConfirm ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-tertiary/10 ring-1 ring-tertiary/25"
                    >
                      <span className="material-symbols-outlined text-sm text-tertiary shrink-0">error</span>
                      <p className="text-[11px] text-tertiary font-semibold">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-60 hover:scale-[1.01]"
                  style={{
                    background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                    color: '#001a42',
                    boxShadow: '0 0 24px rgba(173,198,255,0.2)',
                  }}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-[#001a42]/30 border-t-[#001a42] animate-spin" />
                      Resetting…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">lock_reset</span>
                      Reset Password
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="text-center text-[11px] text-outline font-semibold mt-6">
              Remember your password?{' '}
              <a href="/login" className="text-primary-fixed-dim hover:text-primary transition-colors font-bold">
                Back to login
              </a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <p className="mt-10 text-[9px] uppercase tracking-[0.3em] text-outline/50 font-semibold">
        ⟡ SOVA — Private Wealth Terminal
      </p>
    </div>
  );
}
