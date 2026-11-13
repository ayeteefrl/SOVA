'use client';
// SOVA's ways into Charts (Chart Hive). Shown to every signed-in user; non-members see a lock and an
// "Invite-only" tag and land on the invite-only page. All are plain <a> links: entering /charts is a full page
// load so the page gets the /charts Content-Security-Policy (connect-src to the data server).
import { cn } from '@/lib/utils';
import { chartHref, nseTickerFrom } from '@/lib/hive/symbol-param';
import { useHiveStatus } from './useHiveStatus';

export function ChartsSidebarLink({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const status = useHiveStatus();
  const locked = status ? !status.isMember : false;
  return (
    <a
      href="/charts"
      onClick={onNavigate}
      title={collapsed ? (locked ? 'Charts (invite-only)' : 'Charts') : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-3 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all relative',
        collapsed && 'justify-center',
        'text-outline hover:text-primary hover:bg-surface-container-high/20',
      )}
    >
      <span className="material-symbols-outlined text-sm relative shrink-0">{locked && collapsed ? 'lock' : 'candlestick_chart'}</span>
      {!collapsed && (
        <>
          <span className="relative">Charts</span>
          {locked && (
            <span className="ml-auto flex items-center gap-1 text-[8px] tracking-widest text-gold/80">
              <span className="material-symbols-outlined text-[11px]">lock</span>
              Invite-only
            </span>
          )}
        </>
      )}
    </a>
  );
}

export function ChartsHomeButton() {
  const status = useHiveStatus();
  const locked = status ? !status.isMember : false;
  return (
    <a
      href="/charts"
      title={locked ? 'Charts is invite-only' : 'Open Charts'}
      className="px-5 h-11 flex items-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-surface-container-highest/60 text-on-surface hover:bg-surface-container-highest transition-colors"
    >
      <span className="material-symbols-outlined text-base">{locked ? 'lock' : 'candlestick_chart'}</span>
      Charts
      {locked && <span className="text-[8px] text-gold/80">Invite-only</span>}
    </a>
  );
}

/** "Open chart" for an equity / ETF holding. Members and the owner only; nothing for everyone else. */
export function OpenChartButton({ ticker, className, size = 'md' }: { ticker?: string | null; className?: string; size?: 'sm' | 'md' }) {
  const status = useHiveStatus();
  const t = nseTickerFrom(ticker);
  if (!status?.isMember || !t) return null;
  return (
    <a
      href={chartHref(t)}
      title={`Open chart: ${t}`}
      aria-label={`Open chart for ${t}`}
      className={cn(
        size === 'md' ? 'w-7 h-7 flex items-center justify-center rounded-md' : 'inline-flex',
        'text-outline hover:text-primary-fixed-dim transition-colors',
        className,
      )}
    >
      <span className="material-symbols-outlined text-sm">candlestick_chart</span>
    </a>
  );
}

/** Whether to reserve room for the "Open chart" action (members only, so others keep today's layout). */
export function useChartActions() {
  return Boolean(useHiveStatus()?.isMember);
}

/** Owner only: a row in Settings → Security linking to the Charts access list. Renders nothing for anyone else. */
export function ChartsAccessSettingsRow() {
  const status = useHiveStatus();
  if (!status?.isOwner) return null;
  return (
    <div className="p-5 rounded-lg bg-surface-container-highest/20 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-black text-on-surface">Charts access</p>
        <p className="text-[11px] text-outline mt-1">Choose which SOVA accounts can open Charts (invite-only).</p>
      </div>
      <a
        href="/charts/access"
        className="px-4 h-9 inline-flex items-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-surface-container-highest/60 text-on-surface hover:bg-surface-container-highest transition-colors"
      >
        <span className="material-symbols-outlined text-sm">group</span>
        Manage
      </a>
    </div>
  );
}
