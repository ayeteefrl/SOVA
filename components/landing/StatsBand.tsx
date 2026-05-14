'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const STATS = [
  { value: '5,000+', label: 'Assets Tracked', icon: 'trending_up', color: '#4d8eff' },
  { value: 'INR-First', label: 'Platform', icon: 'currency_rupee', color: '#D4AF37' },
  { value: '₹0', label: 'Brokerage Fees', icon: 'savings', color: '#4edea3' },
  { value: '256-bit', label: 'AES Encryption', icon: 'security', color: '#c084fc' },
];

export default function StatsBand() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section id="why-sova" ref={ref} className="py-20 px-6 relative overflow-hidden">
      {/* Separator line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16 bg-gradient-to-b from-transparent to-outline/20" />

      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-outline mb-3">Why SOVA</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-on-surface">
            Built for serious investors
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative rounded-2xl p-6 text-center overflow-hidden"
              style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.35)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                style={{ background: `linear-gradient(90deg, transparent, ${stat.color}55, transparent)` }}
              />
              <div
                className="w-10 h-10 rounded-xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: `${stat.color}12` }}
              >
                <span className="material-symbols-outlined text-base" style={{ color: stat.color }}>
                  {stat.icon}
                </span>
              </div>
              <p className="text-2xl font-black tracking-tighter text-on-surface mb-1" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
