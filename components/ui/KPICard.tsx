'use client';

import { useState } from 'react';
import { Card } from './Card';
import { AnimatedNumber } from './AnimatedNumber';
import { DeltaChip } from './Chip';
import { cn } from '@/lib/utils';
import { useFmt } from '@/components/SettingsContext';
import { motion } from 'framer-motion';

type Props = {
  label: string;
  value: number;
  format?: 'inr' | 'inr-compact' | 'number' | 'percent';
  delta?: number;
  sub?: string;
  accent?: 'neutral' | 'positive' | 'negative' | 'gold' | 'primary';
  icon?: string;
};

export function KPICard({ label, value, format = 'inr', delta, sub, accent = 'neutral', icon }: Props) {
  const fmt = useFmt();
  const [editMode, setEditMode] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [inputVal, setInputVal] = useState('');

  const accentText = {
    neutral: 'text-on-surface',
    positive: 'text-secondary',
    negative: 'text-tertiary',
    gold: 'text-gold',
    primary: 'text-primary-fixed-dim',
  }[accent];

  const labelColor = accent === 'gold' ? 'text-gold' : 'text-outline';

  const formatter = (n: number) => {
    if (format === 'inr') return fmt(n);
    if (format === 'inr-compact') return fmt(n, { compact: true });
    if (format === 'percent') return `${n.toFixed(2)}%`;
    return Math.round(n).toLocaleString('en-IN');
  };

  const handleEditClick = () => {
    setInputVal(String(localValue));
    setEditMode(true);
  };

  const handleSave = () => {
    const parsed = parseFloat(inputVal.replace(/[^0-9.-]/g, ''));
    if (!isNaN(parsed)) setLocalValue(parsed);
    setEditMode(false);
  };

  return (
    <Card tier="low" glow={accent === 'gold' ? 'gold' : 'primary'} className="p-6 group">
      <div
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
          accent === 'gold' ? 'bg-gold/5' : 'bg-primary/5',
        )}
      />
      <div className="flex items-start justify-between mb-2 relative">
        <p className={cn('text-[10px] uppercase tracking-[0.2em] font-bold', labelColor)}>
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleEditClick}
            className="text-[9px] font-black uppercase tracking-widest text-outline hover:text-primary-fixed-dim border border-outline/20 hover:border-primary-fixed-dim/40 px-2 py-0.5 rounded transition-colors"
          >
            Edit
          </button>
          {icon && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className={cn(
                'material-symbols-outlined text-lg opacity-40 group-hover:opacity-80 transition-opacity',
                accentText,
              )}
            >
              {icon}
            </motion.span>
          )}
        </div>
      </div>
      {editMode ? (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="number"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setEditMode(false);
            }}
            autoFocus
            className="w-full bg-surface-container-highest/60 border border-primary/30 rounded-lg px-3 py-1.5 text-lg font-extrabold tracking-tight text-on-surface outline-none focus:border-primary/60"
          />
        </div>
      ) : (
        <h3 className={cn('text-[1.65rem] font-extrabold tracking-tight leading-tight relative', accentText)}>
          <AnimatedNumber value={localValue} format={formatter} />
        </h3>
      )}
      <div className="mt-1 flex items-center gap-2 relative">
        {delta !== undefined && <DeltaChip value={delta} />}
        {sub && (
          <p className="text-[10px] font-bold text-outline uppercase tracking-widest">{sub}</p>
        )}
      </div>
    </Card>
  );
}
