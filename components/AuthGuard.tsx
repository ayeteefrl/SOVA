'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const PUBLIC_PATHS = ['/login', '/register', '/reset-password'];

/* ── Inline login modal shown over blurred app ── */
function LoginOverlay() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
        const data = await res.json();
        setError(data.error || 'Invalid credentials. Please try again.');
        return;
      }
      window.location.reload();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
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
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6">
      {/* Blurred backdrop tint */}
      <div className="absolute inset-0 bg-surface/60 backdrop-blur-md" />

      {/* SOVA logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex flex-col items-center mb-8 z-10"
      >
        <div className="w-12 h-12 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-full h-full">
            <defs>
              <linearGradient id="sova-guard-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#adc6ff" />
                <stop offset="100%" stopColor="#D4AF37" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="#0d1322" />
            <path d="M8 22 L8 10 L16 18 L24 10 L24 22" fill="none" stroke="url(#sova-guard-g)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-xl font-black tracking-tighter gradient-text-primary">SOVA</p>
        <p className="text-[9px] uppercase tracking-[0.3em] text-outline font-semibold mt-0.5">Private Wealth Terminal</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {!showForgot ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 w-full max-w-sm"
          >
            <div
              className="rounded-2xl p-8 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.85)]"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.5)' }}
            >
              <h1 className="text-base font-black tracking-tight text-on-surface mb-0.5">Welcome back</h1>
              <p className="text-[11px] text-outline font-semibold mb-6">Sign in to access your portfolio</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-1.5">
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

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-1.5">
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

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                    className="text-[10px] font-bold text-outline hover:text-primary-fixed-dim transition-colors uppercase tracking-widest"
                  >
                    Forgot password?
                  </button>
                </div>

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
                      Signing in…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">login</span>
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-[11px] text-outline font-semibold mt-5">
                No account?{' '}
                <a href="/register" className="text-primary-fixed-dim hover:text-primary transition-colors font-bold">
                  Create one
                </a>
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="forgot"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 w-full max-w-sm"
          >
            <div
              className="rounded-2xl p-8 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.85)]"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.5)' }}
            >
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); }}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-outline hover:text-on-surface transition-colors mb-6"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back to login
              </button>

              <h2 className="text-base font-black tracking-tight text-on-surface mb-0.5">Reset password</h2>
              <p className="text-[11px] text-outline font-semibold mb-6">
                Enter your email and we&apos;ll send a reset link.
              </p>

              {forgotSent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-4 text-center"
                >
                  <span className="material-symbols-outlined text-4xl text-secondary">mark_email_read</span>
                  <p className="text-sm font-black text-on-surface">Check your inbox</p>
                  <p className="text-[11px] text-outline font-semibold leading-relaxed">
                    Reset link sent to{' '}
                    <span className="text-primary-fixed-dim">{forgotEmail}</span>
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-1.5">
                      Email Address
                    </label>
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 focus-within:ring-1 focus-within:ring-primary/40 transition-all"
                      style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                    >
                      <span className="material-symbols-outlined text-sm text-outline shrink-0">mail</span>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                        className="flex-1 bg-transparent py-3 text-sm text-on-surface placeholder:text-outline/40 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full h-11 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    style={{ background: '#1e2538', border: '1px solid #2f3445', color: '#adc6ff' }}
                  >
                    {forgotLoading ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">send</span>
                        Send Reset Link
                      </>
                    )}
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

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isPublic) {
      setChecked(true);
      setIsAuthenticated(true);
      return;
    }
    fetch('/api/auth/me')
      .then((r) => {
        setIsAuthenticated(r.ok);
        setChecked(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setChecked(true);
      });
  }, [pathname, isPublic]);

  if (!checked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {/* App blurred in background */}
        <div className="pointer-events-none select-none filter blur-sm opacity-40">
          {children}
        </div>
        {/* Login overlay */}
        <LoginOverlay />
      </>
    );
  }

  return <>{children}</>;
}
