'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from 'recharts';
import { Segmented } from '@/components/ui/Segmented';
import { formatINR } from '@/lib/utils';
import { useHoldings } from '@/components/HoldingsContext';

type DataPoint = { label: string; value: number; benchmark: number; isFYEnd: boolean };
type ViewMode = '₹' | '%';

const ranges = ['1M', '3M', '1Y', 'TTM', 'CUSTOM'] as const;
type Range = (typeof ranges)[number];

export function PerformanceChart() {
  const [range, setRange] = useState<Range>('TTM');
  const [viewMode, setViewMode] = useState<ViewMode>('₹');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [tradeSeries, setTradeSeries] = useState<DataPoint[]>([]);
  const [snapSeries, setSnapSeries] = useState<DataPoint[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const { needsKiteReconnect } = useHoldings();

  function loadData() {
    setIsFetching(true);
    Promise.all([
      fetch('/api/portfolio/snapshot?months=24', { signal: AbortSignal.timeout(8000) })
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null),
      fetch('/api/portfolio/performance', { signal: AbortSignal.timeout(8000) })
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null),
    ]).then(([snap, perf]) => {
      if (snap?.data?.length) setSnapSeries(snap.data);
      if (perf?.data?.some((d: DataPoint) => d.value > 0)) setTradeSeries(perf.data);
    }).finally(() => setIsFetching(false));
  }

  useEffect(() => {
    loadData();
    window.addEventListener('sova:refresh', loadData);
    return () => window.removeEventListener('sova:refresh', loadData);
  }, []);

  const getLabelMonthYear = (label: string): { year: number; month: number } => {
    const [month, yearStr] = label.split(' ');
    const monthMap: { [key: string]: number } = {
      JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
      JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
    };
    return { year: 2000 + parseInt(yearStr.replace("'", '')), month: monthMap[month] ?? 1 };
  };

  const getInputMonthYear = (dateStr: string): { year: number; month: number } => {
    const [year, month] = dateStr.split('-');
    return { year: parseInt(year), month: parseInt(month) };
  };

  // Real data only: daily snapshots > trade-based performance history
  const resolvedSeries = useMemo(() => {
    if (snapSeries.length > 0) return snapSeries;
    if (tradeSeries.some((d) => d.value > 0)) return tradeSeries;
    return [];
  }, [snapSeries, tradeSeries]);

  const slicedData = useMemo(() => {
    const all = resolvedSeries;
    if (range === '1M') return all.slice(-2);
    if (range === '3M') return all.slice(-3);
    if (range === 'TTM') return all.slice(-12);
    if (range === 'CUSTOM' && customStart && customEnd) {
      const startMY = getInputMonthYear(customStart);
      const endMY = getInputMonthYear(customEnd);
      return all.filter((d) => {
        const dataMY = getLabelMonthYear(d.label);
        const dataNum = dataMY.year * 100 + dataMY.month;
        return dataNum >= startMY.year * 100 + startMY.month && dataNum <= endMY.year * 100 + endMY.month;
      });
    }
    return all;
  }, [range, customStart, customEnd, resolvedSeries]);

  // Convert to % return series if toggle is active (base = first point)
  const data = useMemo(() => {
    if (viewMode === '₹' || slicedData.length === 0) return slicedData;
    const base = slicedData[0].value;
    if (base === 0) return slicedData;
    return slicedData.map((d) => ({ ...d, value: ((d.value - base) / base) * 100 }));
  }, [slicedData, viewMode]);

  const xAxisConfig = useMemo(() => {
    if (range === '1Y') return { ticks: data.filter((d) => d.isFYEnd).map((d) => d.label), interval: 0 as const, minTickGap: 0 };
    if (range === '3M' || range === '1M') return { ticks: undefined, interval: 0 as const, minTickGap: 0 };
    return { ticks: undefined, interval: Math.max(0, Math.floor(data.length / 6)) as any, minTickGap: 30 };
  }, [range, data]);

  const first = slicedData[0]?.value ?? 0;
  const last  = slicedData[slicedData.length - 1]?.value ?? 0;
  const deltaPct = first !== 0 ? ((last - first) / first) * 100 : 0;
  const positive = deltaPct >= 0;

  const minIdx = data.length > 0 ? data.reduce((acc, d, i) => (d.value < data[acc].value ? i : acc), 0) : 0;
  const maxIdx = data.length > 0 ? data.reduce((acc, d, i) => (d.value > data[acc].value ? i : acc), 0) : 0;
  const hasData = slicedData.some((d) => d.value > 0);

  const dataSource = snapSeries.length > 0 ? 'Daily snapshots' : 'Trade history';

  return (
    <div className="w-full">
      <div className="p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6">
        <div>
          <h4 className="text-lg font-extrabold tracking-tight text-on-surface">
            Total Portfolio Performance
          </h4>
          <p className="text-[11px] text-outline font-semibold uppercase tracking-widest mt-1">
            {dataSource} · portfolio value over time
          </p>
          <div className="mt-4 flex items-center gap-3">
            <p className="text-3xl font-black tracking-tighter text-on-surface">
              {formatINR(last, { compact: true })}
            </p>
            {hasData && (
              <span className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${positive ? 'bg-secondary-container/25 text-secondary' : 'bg-tertiary-container/20 text-tertiary'}`}>
                {positive ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* ₹ / % toggle */}
          <div className="flex rounded-lg overflow-hidden ring-1 ring-outline/20">
            {(['₹', '%'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${viewMode === m ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest/30 text-outline hover:text-on-surface'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <Segmented options={ranges} value={range} onChange={setRange} />
          {range === 'CUSTOM' && (
            <div className="flex gap-2 items-center">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-container-highest/60 border border-outline/20 text-on-surface outline-none focus:border-primary/40" />
              <span className="text-[10px] text-outline font-bold">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-container-highest/60 border border-outline/20 text-on-surface outline-none focus:border-primary/40" />
            </div>
          )}
        </div>
      </div>

      <div className="h-80 px-4 pb-6">
        {!hasData && range === 'CUSTOM' ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-outline font-semibold">No data for selected date range.</p>
          </div>
        ) : isFetching ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-[11px] text-outline font-semibold uppercase tracking-widest">Loading chart…</p>
          </div>
        ) : !hasData ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(77,142,255,0.1)' }}>
              <span className="material-symbols-outlined text-2xl" style={{ color: '#4d8eff' }}>link_off</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-on-surface">
                {needsKiteReconnect ? 'Connect Zerodha to see information' : 'Performance history building up'}
              </p>
              <p className="text-[10px] text-outline font-semibold mt-1 uppercase tracking-widest">
                {needsKiteReconnect
                  ? 'Link your Zerodha account to track portfolio performance over time'
                  : 'Daily snapshots will accumulate — check back tomorrow'}
              </p>
            </div>
            {needsKiteReconnect && (
              <a
                href="/api/auth/kite/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42' }}
              >
                <span className="material-symbols-outlined text-sm">add_link</span>
                Connect Zerodha
              </a>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="perfArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={positive ? '#4edea3' : '#ffb2b7'} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={positive ? '#4edea3' : '#ffb2b7'} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="perfLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#adc6ff" />
                  <stop offset="100%" stopColor={positive ? '#4edea3' : '#ffb2b7'} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#424754" strokeOpacity={0.15} strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false}
                ticks={xAxisConfig.ticks} interval={xAxisConfig.interval} minTickGap={xAxisConfig.minTickGap}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#8c909f', letterSpacing: '0.05em' }} />
              <YAxis tickLine={false} axisLine={false} width={viewMode === '%' ? 52 : 70}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#8c909f' }}
                tickFormatter={(v: number) => viewMode === '%' ? `${v.toFixed(1)}%` : formatINR(v, { compact: true })} />
              <Tooltip
                cursor={{ stroke: '#adc6ff', strokeOpacity: 0.3, strokeDasharray: '4 4' }}
                contentStyle={{ background: 'rgba(25,31,47,0.95)', border: '1px solid rgba(66,71,84,0.4)', borderRadius: 8, fontFamily: 'Manrope' }}
                labelStyle={{ color: '#8c909f', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}
                itemStyle={{ color: '#dde2f8', fontSize: 12, fontWeight: 700 }}
                formatter={(v: number) => [
                  viewMode === '%' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : formatINR(v, { compact: true }),
                  viewMode === '%' ? 'Return' : 'Portfolio Value',
                ]}
              />
              <Area type="monotone" dataKey="value" stroke="url(#perfLine)" strokeWidth={3}
                fill="url(#perfArea)" isAnimationActive animationDuration={1200}
                activeDot={{ r: 6, fill: '#adc6ff', stroke: '#0d1322', strokeWidth: 3 }} />
              <ReferenceDot x={data[minIdx]?.label} y={data[minIdx]?.value} r={5} fill="#ffb2b7" stroke="#0d1322" strokeWidth={2} isFront />
              <ReferenceDot x={data[maxIdx]?.label} y={data[maxIdx]?.value} r={5} fill="#4edea3" stroke="#0d1322" strokeWidth={2} isFront />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
