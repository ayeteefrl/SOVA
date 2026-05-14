'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const STEPS = [
  {
    step: '01',
    title: 'Create your free account',
    description: 'Sign up in seconds — no credit card, no broker login required. Your account is ready the moment you confirm your email.',
    icon: 'person_add',
    color: '#4d8eff',
  },
  {
    step: '02',
    title: 'Add your holdings',
    description: 'Log any asset manually — stocks, mutual funds, ETFs, gold, PPF, real estate. Or connect Zerodha via Kite Connect for automatic live sync.',
    icon: 'add_chart',
    color: '#D4AF37',
  },
  {
    step: '03',
    title: 'Track everything live',
    description: 'Net worth, day P&L, sector exposure, and performance update live during market hours. Every number you need, in one terminal.',
    icon: 'monitoring',
    color: '#4edea3',
  },
  {
    step: '04',
    title: 'Rebalance with precision',
    description: 'Set your target allocation. The rebalance tool tells you exactly what to buy or sell. No spreadsheets, no mental arithmetic.',
    icon: 'balance',
    color: '#c084fc',
  },
];

export default function HowItWorks() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.08 });

  return (
    <section id="how-it-works" ref={ref} className="py-20 px-6 relative">
      {/* Connector line top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16 bg-gradient-to-b from-transparent to-outline/20" />

      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-outline mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-on-surface mb-4">
            Up and running in minutes
          </h2>
          <p className="text-sm text-on-surface-variant font-medium max-w-md mx-auto">
            No complex setup. No financial jargon. Just clear steps from account creation to a live portfolio view.
          </p>
        </motion.div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative rounded-2xl p-6 overflow-hidden"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.35)' }}
            >
              {/* Top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                style={{ background: `linear-gradient(90deg, transparent, ${step.color}55, transparent)` }}
              />

              {/* Step number */}
              <div className="flex items-center justify-between mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${step.color}12` }}
                >
                  <span className="material-symbols-outlined text-base" style={{ color: step.color }}>
                    {step.icon}
                  </span>
                </div>
                <span
                  className="text-[11px] font-black tabular-nums"
                  style={{ color: `${step.color}60` }}
                >
                  {step.step}
                </span>
              </div>

              <h3 className="text-[13px] font-black text-on-surface mb-2 leading-snug">
                {step.title}
              </h3>
              <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                {step.description}
              </p>

              {/* Connector arrow (not on last) */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <span className="material-symbols-outlined text-sm text-outline/30">chevron_right</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* CTA beneath steps */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex justify-center mt-10"
        >
          <a
            href="/signup"
            className="flex items-center gap-2 px-6 h-11 rounded-full text-[11px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(77,142,255,0.35)]"
            style={{
              background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
              color: '#001a42',
              boxShadow: '0 0 20px rgba(77,142,255,0.25)',
            }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: '#001a42' }}>rocket_launch</span>
            Get started free
          </a>
        </motion.div>
      </div>
    </section>
  );
}
