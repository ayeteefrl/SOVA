import { cn } from '@/lib/utils';

type Variant = 'positive' | 'negative' | 'neutral' | 'gold' | 'primary';

export function Chip({
  children,
  variant = 'neutral',
  size = 'sm',
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const variantClass = {
    positive: 'bg-secondary-container/25 text-secondary',
    negative: 'bg-tertiary-container/20 text-tertiary',
    neutral: 'bg-surface-container-highest/40 text-on-surface-variant',
    gold: 'bg-gold/10 text-gold',
    primary: 'bg-primary/10 text-primary-fixed-dim',
  }[variant];

  const sizeClass = {
    sm: 'text-[9px] px-2 py-0.5',
    md: 'text-[10px] px-3 py-1',
  }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill font-extrabold uppercase tracking-widest whitespace-nowrap',
        variantClass,
        sizeClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DeltaChip({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const positive = value >= 0;
  return (
    <Chip variant={positive ? 'positive' : 'negative'} size={size}>
      <span className="text-[8px]">{positive ? '▲' : '▼'}</span>
      {Math.abs(value).toFixed(2)}%
    </Chip>
  );
}
