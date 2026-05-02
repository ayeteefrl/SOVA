import { cn } from '@/lib/utils';

export function SectionHeader({
  title,
  subtitle,
  right,
  overline,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  overline?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col md:flex-row md:items-center md:justify-between gap-3', className)}>
      <div>
        {overline && (
          <p className="text-[10px] uppercase tracking-[0.28em] text-gold font-bold mb-1">
            {overline}
          </p>
        )}
        <h4 className="text-lg font-extrabold tracking-tight text-on-surface">{title}</h4>
        {subtitle && (
          <p className="text-[11px] text-outline font-semibold uppercase tracking-widest mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
