'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/utils';

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
};

export function Segmented<T extends string>({ options, value, onChange, className }: Props<T>) {
  const id = useId();
  return (
    <div
      className={cn(
        'inline-flex items-center bg-surface-container-highest/40 p-1 rounded-lg relative',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              'relative px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded transition-colors z-10',
              active ? 'text-primary-fixed-dim' : 'text-outline hover:text-on-surface',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="absolute inset-0 bg-surface-container-low rounded shadow-sm ring-1 ring-outline-variant/20"
              />
            )}
            <span className="relative">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}
