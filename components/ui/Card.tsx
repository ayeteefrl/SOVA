'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { forwardRef, type ReactNode } from 'react';

type CardProps = HTMLMotionProps<'div'> & {
  tier?: 'low' | 'mid' | 'high' | 'lowest';
  glass?: boolean;
  glow?: 'none' | 'primary' | 'gold';
  animate?: boolean;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, tier = 'low', glass = false, glow = 'none', animate: anim = true, children, ...props },
  ref,
) {
  const tierClass = {
    lowest: 'bg-surface-container-lowest',
    low: 'bg-surface-container-low',
    mid: 'bg-surface-container',
    high: 'bg-surface-container-high',
  }[tier];

  const glowClass = {
    none: '',
    primary: 'hover:shadow-glow',
    gold: 'hover:shadow-glow-gold',
  }[glow];

  return (
    <motion.div
      ref={ref}
      initial={anim ? { opacity: 0, y: 12 } : undefined}
      whileInView={anim ? { opacity: 1, y: 0 } : undefined}
      viewport={anim ? { once: true, margin: '-40px' } : undefined}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'rounded-xl border border-outline-variant/5 shadow-elevated relative overflow-hidden transition-shadow',
        tierClass,
        glowClass,
        glass && 'glass-card',
        className,
      )}
      {...props}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-outline-variant/40 to-transparent pointer-events-none" />
      {children as ReactNode}
    </motion.div>
  );
});
