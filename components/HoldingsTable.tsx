'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Holding } from '@/lib/data';
import { cn, formatINR } from '@/lib/utils';
import { DeltaChip } from '@/components/ui/Chip';

type SortKey = 'name' | 'value' | 'invested' | 'ltp' | 'daily' | 'total' | 'weight';
type SortDir = 'asc' | 'desc';

export function HoldingsTable({
  holdings,
  showSector = false,
  onDelete,
}: {
  holdings: Holding[];
  showSector?: boolean;
  onDelete?: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    const filtered = holdings.filter((h) =>
      h.name.toLowerCase().includes(query.toLowerCase()) ||
      h.ticker?.toLowerCase().includes(query.toLowerCase()),
    );
    const getValue = (h: Holding, k: SortKey): number | string => {
      if (k === 'invested') return h.units * h.avgCost;
      if (k === 'ltp') return h.ltp;
      return h[k] as number | string;
    };
    return [...filtered].sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [holdings, sortKey, sortDir, query]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  const Header = ({ k, label, right = false }: { k: SortKey; label: string; right?: boolean }) => (
    <button
      onClick={() => toggleSort(k)}
      className={cn(
        'text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary-fixed-dim transition-colors flex items-center gap-1',
        right && 'ml-auto',
      )}
    >
      {label}
      <span className="material-symbols-outlined text-xs">
        {sortKey === k ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base pointer-events-none">
            search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter holdings…"
            className="w-full bg-surface-container-highest/30 rounded-lg pl-10 pr-4 py-2 text-xs placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-primary-container"
          />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-outline">
          {sorted.length} positions
        </p>
      </div>

      {/* ── Desktop Table (md+) ── */}
      <div className="hidden md:block overflow-x-auto -mx-4 px-4">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[2fr_0.6fr_0.75fr_0.75fr_0.8fr_0.8fr_0.7fr_0.7fr_0.55fr_auto] gap-3 px-4 py-3 border-b border-outline-variant/10">
            <Header k="name" label="Instrument" />
            <div className="text-right"><Header k="value" label="Units" right /></div>
            <div className="text-right"><Header k="value" label="Avg Cost" right /></div>
            <div className="text-right"><Header k="ltp" label="Curr. Price" right /></div>
            <div className="text-right"><Header k="invested" label="Invested" right /></div>
            <div className="text-right"><Header k="value" label="Value" right /></div>
            <div className="text-right"><Header k="daily" label="1D" right /></div>
            <div className="text-right"><Header k="total" label="Total" right /></div>
            <div className="text-right"><Header k="weight" label="Wt." right /></div>
            <div />
          </div>
          <div className="divide-y divide-outline-variant/5">
            {sorted.map((h, i) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="grid grid-cols-[2fr_0.6fr_0.75fr_0.75fr_0.8fr_0.8fr_0.7fr_0.7fr_0.55fr_auto] gap-3 px-4 py-4 items-center hover:bg-surface-container-highest/20 rounded-lg transition-colors group"
              >
                <div>
                  <p className="text-xs font-bold text-on-surface">{h.name}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-outline mt-0.5">
                    {h.ticker ?? (showSector ? h.sector : '')}
                  </p>
                </div>
                <p className="text-xs text-right font-semibold text-on-surface">{h.units.toLocaleString('en-IN')}</p>
                <p className="text-xs text-right text-on-surface-variant">
                  {formatINR(h.avgCost, { decimals: 1 })}
                </p>
                <p className={cn(
                  'text-xs text-right font-semibold',
                  h.ltp > h.avgCost ? 'text-secondary' : h.ltp < h.avgCost ? 'text-tertiary' : 'text-on-surface-variant',
                )}>
                  {formatINR(h.ltp, { decimals: 1 })}
                </p>
                <p className="text-xs text-right text-on-surface-variant">
                  {formatINR(h.units * h.avgCost, { compact: true })}
                </p>
                <p className="text-xs text-right font-black text-on-surface">
                  {formatINR(h.value, { compact: true })}
                </p>
                <div className="text-right flex justify-end">
                  <DeltaChip value={h.daily} />
                </div>
                <div className="text-right flex justify-end">
                  <DeltaChip value={h.total} />
                </div>
                <p className="text-xs text-right font-black text-primary-fixed-dim">
                  {h.weight.toFixed(1)}%
                </p>
                {onDelete && (
                  <button
                    onClick={() => onDelete(h.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-outline hover:text-tertiary opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile Cards (below md) ── */}
      <div className="md:hidden space-y-3">
        {sorted.map((h, i) => {
          const invested = h.units * h.avgCost;
          const gainValue = h.value - invested;
          return (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="rounded-xl p-4 space-y-3"
              style={{ background: '#141c30', border: '1px solid rgba(66,71,84,0.3)' }}
            >
              {/* Top row: name + delete */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-on-surface leading-tight">{h.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {h.ticker && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-outline">{h.ticker}</span>
                    )}
                    {showSector && h.sector && (
                      <span className="text-[9px] font-bold text-outline/60">{h.sector}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DeltaChip value={h.daily} />
                  {onDelete && (
                    <button
                      onClick={() => onDelete(h.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-outline hover:text-tertiary transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Price row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-0.5">Avg Cost</p>
                  <p className="text-xs font-semibold text-on-surface-variant">{formatINR(h.avgCost, { decimals: 1 })}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-0.5">LTP</p>
                  <p className={cn(
                    'text-xs font-black',
                    h.ltp > h.avgCost ? 'text-secondary' : h.ltp < h.avgCost ? 'text-tertiary' : 'text-on-surface-variant',
                  )}>
                    {formatINR(h.ltp, { decimals: 1 })}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-0.5">Units</p>
                  <p className="text-xs font-semibold text-on-surface">{h.units.toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Value row */}
              <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-0.5">Current Value</p>
                  <p className="text-sm font-black text-on-surface">{formatINR(h.value, { compact: true })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-0.5">Gain / Loss</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <p className={cn(
                      'text-sm font-black',
                      gainValue >= 0 ? 'text-secondary' : 'text-tertiary',
                    )}>
                      {gainValue >= 0 ? '+' : ''}{formatINR(gainValue, { compact: true })}
                    </p>
                    <DeltaChip value={h.total} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-0.5">Weight</p>
                  <p className="text-xs font-black text-primary-fixed-dim">{h.weight.toFixed(1)}%</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
