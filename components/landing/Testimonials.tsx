'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const TESTIMONIALS = [
  {
    quote: "I've tried every portfolio tracker available in India. SOVA is the first one that actually feels like it was built for someone who takes their investments seriously. The Zerodha integration is flawless — I get my live P&L the moment markets open.",
    name: 'Arjun Mehta',
    role: 'Senior Software Engineer',
    location: 'Bengaluru',
    initials: 'AM',
    color: '#4d8eff',
  },
  {
    quote: "The sector exposure breakdown and rebalancing tool alone are worth it. I used to juggle three different apps every morning. Now it's just SOVA. The INR-first design makes a genuine difference when you're tracking crores, not dollars.",
    name: 'Priya Kapoor',
    role: 'Investment Analyst',
    location: 'Mumbai',
    initials: 'PK',
    color: '#D4AF37',
  },
  {
    quote: "Finally a dark-mode wealth terminal that doesn't look like generic SaaS. The design is stunning and the data is always accurate. What convinced me was that SOVA never touches my money — it's read-only. That trust matters.",
    name: 'Rohan Nair',
    role: 'Entrepreneur',
    location: 'Pune',
    initials: 'RN',
    color: '#4edea3',
  },
];

export default function Testimonials() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section id="how-it-works" ref={ref} className="py-20 px-6 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-outline mb-3">From the community</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-on-surface">
            Trusted by real investors
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: i * 0.12 }}
              className="relative rounded-2xl p-7 flex flex-col gap-5 overflow-hidden"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.35)' }}
            >
              {/* Top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                style={{ background: `linear-gradient(90deg, transparent, ${t.color}50, transparent)` }}
              />

              {/* Quote mark */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${t.color}12` }}
              >
                <span className="material-symbols-outlined text-sm" style={{ color: t.color }}>format_quote</span>
              </div>

              {/* Quote text */}
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid rgba(66,71,84,0.35)' }}>
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-black shrink-0"
                  style={{
                    background: `${t.color}20`,
                    color: t.color,
                    border: `1.5px solid ${t.color}50`,
                    boxShadow: `0 0 14px ${t.color}28`,
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-[12px] font-black text-on-surface">{t.name}</p>
                  <p className="text-[10px] text-outline font-semibold">{t.role} · {t.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
