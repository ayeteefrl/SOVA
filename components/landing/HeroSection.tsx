'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const CurrencyCanvas = dynamic(() => import('./CurrencyCanvas'), { ssr: false });

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Canvas background — hidden on small screens to avoid overlapping content */}
      <div className="hidden sm:block">
        <CurrencyCanvas />
      </div>

      {/* Deep background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(77,142,255,0.10) 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 50% 70%, rgba(77,142,255,0.06) 0%, transparent 60%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{ background: 'rgba(77,142,255,0.08)', border: '1px solid rgba(77,142,255,0.2)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary-fixed-dim">
            Private Wealth Terminal · Free to Start
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[1.0] text-on-surface mb-6"
        >
          Let&apos;s see how your{' '}
          <motion.span
            className="relative"
            style={{
              background: 'linear-gradient(270deg, #adc6ff 0%, #4d8eff 25%, #4edea3 50%, #4d8eff 75%, #adc6ff 100%)',
              backgroundSize: '300% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'inline-block',
              paddingBottom: '0.2em',
              overflow: 'visible',
            }}
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          >
            money is growing
          </motion.span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-lg md:text-xl text-on-surface-variant font-medium max-w-xl mb-10 leading-relaxed"
        >
          A user-friendly private wealth tracking terminal. Know every rupee, every move, every day.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            href="/signup"
            className="group flex items-center gap-3 px-7 h-13 rounded-full text-[12px] font-black uppercase tracking-widest transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(77,142,255,0.4)]"
            style={{
              background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
              color: '#001a42',
              boxShadow: '0 0 28px rgba(77,142,255,0.3)',
              height: '52px',
            }}
          >
            Track your first portfolio
            <span className="w-6 h-6 rounded-full bg-[#001a42]/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <span className="material-symbols-outlined text-sm" style={{ color: '#001a42' }}>arrow_forward</span>
            </span>
          </Link>

          <a
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-outline hover:text-on-surface transition-colors"
          >
            See how it works
            <span className="material-symbols-outlined text-sm">south</span>
          </a>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.65 }}
          className="mt-5 flex items-center gap-2.5"
        >
          <div className="flex -space-x-2">
            {['AM', 'PK', 'RN'].map((i, idx) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                style={{
                  background: '#0d1322',
                  border: `2px solid ${['#4d8eff', '#D4AF37', '#4edea3'][idx]}`,
                  color: ['#4d8eff', '#D4AF37', '#4edea3'][idx],
                  zIndex: idx + 1,
                  position: 'relative',
                }}
              >
                {i}
              </div>
            ))}
          </div>
          <p className="text-[11px] font-semibold text-outline/55">
            <span className="text-primary-fixed-dim font-black">500+</span>
            {' '}investors already tracking
          </p>
        </motion.div>

        {/* Trust row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.75 }}
          className="flex flex-wrap justify-center items-center gap-4 md:gap-6 mt-8 text-[10px] font-bold uppercase tracking-widest text-outline/60"
        >
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs text-secondary">lock</span>
            No card required
          </span>
          <div className="w-px h-3 bg-outline/20" />
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs text-secondary">verified</span>
            Free forever tier
          </span>
          <div className="w-px h-3 bg-outline/20" />
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs text-secondary">security</span>
            Read-only access
          </span>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="material-symbols-outlined text-outline/40 text-sm">keyboard_arrow_down</span>
        </motion.div>
      </motion.div>
    </section>
  );
}
