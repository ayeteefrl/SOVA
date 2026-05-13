'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, phone: phone ? `+91${phone.replace(/\s/g, '')}` : undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/6 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-secondary/4 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-[160px] pointer-events-none" />

      {/* Back to landing */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute top-6 left-6"
      >
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-outline hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back
        </Link>
      </motion.div>

      {/* SOVA Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-10"
      >
        <Link href="/" className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10">
            <img src="/sovalogo.svg" alt="SOVA" className="w-full h-full object-contain" />
          </div>
          <span className="text-2xl font-black tracking-tighter gradient-text-primary">SOVA</span>
        </Link>
        <p className="text-[10px] uppercase tracking-[0.3em] text-outline font-semibold">Private Wealth Terminal</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm"
          >
            <div
              className="rounded-2xl p-10 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7)] flex flex-col items-center gap-4 text-center"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
            >
              <div className="w-16 h-16 rounded-full bg-secondary/10 ring-1 ring-secondary/25 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-secondary">mark_email_read</span>
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-on-surface mb-1">Check your inbox</h2>
                <p className="text-[11px] text-outline font-semibold leading-relaxed">
                  We sent a confirmation link to<br />
                  <span className="text-primary-fixed-dim font-bold">{email}</span>
                </p>
              </div>
              <p className="text-[10px] text-outline/60 font-semibold leading-relaxed max-w-[260px]">
                Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
              </p>
              <Link
                href="/sign-in"
                className="mt-2 w-full h-11 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                style={{
                  background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                  color: '#001a42',
                  boxShadow: '0 0 24px rgba(173,198,255,0.2)',
                }}
              >
                <span className="material-symbols-outlined text-sm">login</span>
                Go to Sign In
              </Link>
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
              <h1 className="text-lg font-black tracking-tight text-on-surface mb-1">Create your account</h1>
              <p className="text-[11px] text-outline font-semibold mb-7">Start tracking your wealth today</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">
                    Email Address
                  </label>
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 focus-within:ring-1 focus-within:ring-primary/40 transition-all"
                    style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                  >
                    <span className="material-symbols-outlined text-sm text-outline shrink-0">mail</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="you@example.com"
                      className="flex-1 bg-transparent py-3 text-sm text-on-surface placeholder:text-outline/40 outline-none"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">
                    Mobile Number <span className="normal-case tracking-normal text-outline/50 font-semibold">(optional)</span>
                  </label>
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 focus-within:ring-1 focus-within:ring-primary/40 transition-all"
                    style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                  >
                    <span className="text-[11px] font-black text-outline shrink-0">+91</span>
                    <div className="w-px h-4 bg-[#2f3445] shrink-0" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      disabled={loading}
                      placeholder="98765 43210"
                      className="flex-1 bg-transparent py-3 text-sm text-on-surface placeholder:text-outline/40 outline-none"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">
                    Password
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
                      placeholder="Min. 8 characters"
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
                    <span className="material-symbols-outlined text-sm text-outline shrink-0">lock_clock</span>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="Re-enter password"
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

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-tertiary/10 ring-1 ring-tertiary/25 overflow-hidden"
                    >
                      <span className="material-symbols-outlined text-sm text-tertiary shrink-0">error</span>
                      <p className="text-[11px] text-tertiary font-semibold">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                      Creating account…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">person_add</span>
                      Create Account
                    </>
                  )}
                </button>

                <p className="text-[10px] text-center text-outline/50 font-semibold leading-relaxed">
                  By creating an account you agree to our{' '}
                  <span className="text-outline">Terms of Service</span> and{' '}
                  <span className="text-outline">Privacy Policy</span>.
                </p>
              </form>
            </div>

            <p className="text-center text-[11px] text-outline font-semibold mt-6">
              Already have an account?{' '}
              <Link href="/sign-in" className="text-primary-fixed-dim hover:text-primary transition-colors font-bold">
                Sign In
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-10 text-[9px] uppercase tracking-[0.3em] text-outline/50 font-semibold"
      >
        ⟡ SOVA — Private Wealth Terminal
      </motion.p>
    </div>
  );
}
