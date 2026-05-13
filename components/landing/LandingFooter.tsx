'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useInView } from 'react-intersection-observer';

export default function LandingFooter() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <footer ref={ref} className="relative overflow-hidden">
      {/* Final CTA */}
      <div className="relative py-24 px-6">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 rounded-full blur-[80px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mx-auto text-center relative z-10 rounded-3xl px-10 py-14"
          style={{
            background: 'rgba(15,21,38,0.7)',
            border: '1px solid rgba(77,142,255,0.22)',
            boxShadow: '0 0 80px rgba(77,142,255,0.10), 0 0 0 1px rgba(77,142,255,0.06) inset',
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary">
              Free to start · No card needed
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-on-surface mb-5 leading-tight">
            Your portfolio deserves<br />
            <span
              style={{
                background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 50%, #4edea3 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              a better terminal.
            </span>
          </h2>

          <p className="text-base text-on-surface-variant font-medium mb-10 max-w-md mx-auto leading-relaxed">
            Join investors who track their wealth with clarity. Set up in minutes, no broker connection required.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="group flex items-center gap-3 px-8 rounded-full text-[12px] font-black uppercase tracking-widest transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_48px_rgba(77,142,255,0.45)]"
              style={{
                background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                color: '#001a42',
                boxShadow: '0 0 28px rgba(77,142,255,0.28)',
                height: '52px',
              }}
            >
              Get started free
              <span className="material-symbols-outlined text-sm" style={{ color: '#001a42' }}>arrow_forward</span>
            </Link>
            <Link
              href="/sign-in"
              className="flex items-center px-6 h-13 rounded-full text-[11px] font-black uppercase tracking-widest text-on-surface transition-all hover:bg-surface-container-highest/40"
              style={{ border: '1px solid rgba(66,71,84,0.5)', height: '52px' }}
            >
              Sign In
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Footer links */}
      <div
        className="px-6 py-8 relative z-10"
        style={{ borderTop: '1px solid rgba(66,71,84,0.3)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-6 h-6">
              <img src="/sovalogo.svg" alt="SOVA" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-black tracking-tighter gradient-text-primary">SOVA</span>
          </Link>

          <p className="text-[10px] font-semibold text-outline/50 uppercase tracking-[0.2em]">
            ⟡ Private Wealth Terminal · Not a broker · Read-only access · Your money stays with your broker
          </p>

          <div className="flex items-center gap-5">
            {['Privacy', 'Terms', 'Support'].map((item) => (
              <span key={item} className="text-[10px] font-bold uppercase tracking-widest text-outline/50 hover:text-outline transition-colors cursor-pointer">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
