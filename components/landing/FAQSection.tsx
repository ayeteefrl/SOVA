'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const FAQS = [
  {
    q: 'Do you hold my money or execute trades?',
    a: 'No. SOVA is a read-only portfolio analytics terminal. We connect to your broker to read and display your data, but we never have the ability to touch, transfer, or trade your funds. Think of us as a dashboard, not a broker.',
  },
  {
    q: 'Is my financial data secure?',
    a: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We never sell, share, or monetise your personal or financial data. Your broker credentials are handled directly by your broker\'s OAuth — SOVA never sees your login password.',
  },
  {
    q: 'Is SOVA a brokerage or SEBI-registered entity?',
    a: 'No. SOVA is a portfolio analytics and tracking tool, not a brokerage. We are not SEBI-registered as a broker or investment advisor. We display information — all investment decisions remain entirely yours.',
  },
  {
    q: 'Which brokers does SOVA support?',
    a: 'Currently SOVA integrates with Zerodha via the official Kite Connect API. Manual holdings entry works for all brokers and asset types. More integrations (Groww, Upstox, AngelOne) are on the roadmap.',
  },
  {
    q: 'Is there a free tier? What\'s actually free?',
    a: 'Everything is free right now. SOVA is in its early stages and we want as many investors as possible to experience the full product without any barriers. All features — portfolio tracking, analytics, broker integrations, and exports — are available at no cost. In the future, some advanced features may move to a paid plan, but anything free today will stay accessible.',
  },
  {
    q: 'Can I export my portfolio data?',
    a: 'Yes. Holdings and trade history can be exported as CSV or PDF from the Activity section. Your data is yours — you can leave at any time and take everything with you.',
  },
];

function FAQItem({ faq, index }: { faq: typeof FAQS[0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
      className="rounded-xl overflow-hidden"
      style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.35)' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
      >
        <span className="text-sm font-bold text-on-surface">{faq.q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="material-symbols-outlined text-base text-outline shrink-0"
        >
          add
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="px-6 pb-5 text-[13px] text-on-surface-variant font-medium leading-relaxed"
              style={{ borderTop: '1px solid rgba(66,71,84,0.25)' }}
            >
              <div className="pt-4">{faq.a}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section id="faq" ref={ref} className="py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-outline mb-3">Questions</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-on-surface mb-4">
            Honest answers
          </h2>
          <p className="text-sm text-on-surface-variant font-medium">
            No hidden fees, no fine print surprises.
          </p>
        </motion.div>

        {inView && (
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FAQItem key={faq.q} faq={faq} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
