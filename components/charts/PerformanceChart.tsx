'use client';

import { useState, useMemo } from 'react';
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
import { performanceSeries } from '@/lib/data';
import { Segmented } from '@/components/ui/Segmented';
import { formatINR } from '@/lib/utils';

const ranges = ['1M', '3M', '1Y', 'TTM', 'CUSTOM'] as const;
type Range = (typeof ranges)[number];

export function PerformanceChart() {
  const [range, setRange] = useState<Range>('TTM');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Parse month-year from label "APR '24" and input date "2024-04-01"
  const getLabelMonthYear = (label: string): { year: number; month: number } => {
    const [month, yearStr] = label.split(' ');
    const monthMap: { [key: string]: number } = {
      JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
      JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
    };
    const year = parseInt(yearStr.replace("'", ''));
    return {
      year: 2000 + year,
      month: monthMap[month] ?? 1,
    };
  };

  const getInputMonthYear = (dateStr: string): { year: number; month: number } => {
    const [year, month] = dateStr.split('-');
    return { year: parseInt(year), month: parseInt(month) };
  };

  const data = useMemo(() => {
    const all = performanceSeries;
    if (range === '1M') return all.slice(-2);
    if (range === '3M') return all.slice(-3);
    if (range === 'TTM') return all.slice(-12);
    if (range === 'CUSTOM' && customStart && customEnd) {
      const startMY = getInputMonthYear(customStart);
      const endMY = getInputMonthYear(customEnd);
      return all.filter((d) => {
        const dataMY = getLabelMonthYear(d.label);
        const dataNum = dataMY.year * 100 + dataMY.month;
        const startNum = startMY.year * 100 + startMY.month;
        const endNum = endMY.year * 100 + endMY.month;
        return dataNum >= startNum && dataNum <= endNum;
      });
    }
    // 1Y: show all 36 months for fiscal year comparison (Mar '24, Mar '25, Mar '26)
    return all;
  }, [range, customStart, customEnd]);

  // For 1Y show only fiscal year-end (March) ticks; for 3M show all; for TTM show every other
  const xAxisConfig = useMemo(() => {
    if (range === '1Y') {
      return {
        ticks: data.filter((d) => d.isFYEnd).map((d) => d.label),
        interval: 0 as const,
        minTickGap: 0,
      };
    }
    if (range === '3M' || range === '1M') {
      return { ticks: undefined, interval: 0 as const, minTickGap: 0 };
    }
    // TTM & CUSTOM — show every other month or less to avoid crowding
    return { ticks: undefined, interval: Math.max(0, Math.floor(data.length / 6)) as any, minTickGap: 30 };
  }, [range, data]);

  const first = data[0]?.value ?? 0;
  const last = data[data.length - 1]?.value ?? 0;
  const deltaPct = first !== 0 ? ((last - first) / first) * 100 : 0;
  const positive = deltaPct >= 0;

  const minIdx = data.length > 0 ? data.reduce((acc, d, i) => (d.value < data[acc].value ? i : acc), 0) : 0;
  const maxIdx = data.length > 0 ? data.reduce((acc, d, i) => (d.value > data[acc].value ? i : acc), 0) : 0;

  const hasData = data.length > 0;

  return (
    <div className="w-full">
      <div className="p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6">
        <div>
          <h4 className="text-lg font-extrabold tracking-tight text-on-surface">
            Total Portfolio Performance
          </h4>
          <p className="text-[11px] text-outline font-semibold uppercase tracking-widest mt-1">
            Aggregate growth across all investment vertical nodes
          </p>
          <div className="mt-4 flex items-center gap-3">
            <p className="text-3xl font-black tracking-tighter text-on-surface">
              {formatINR(last, { compact: true })}
            </p>
            <span
              className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-pill ${
                positive
                  ? 'bg-secondary-container/25 text-secondary'
                  : 'bg-tertiary-container/20 text-tertiary'
              }`}
            >
              {positive ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Segmented options={ranges} value={range} onChange={setRange} />
          {range === 'CUSTOM' && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-container-highest/60 border border-outline/20 text-on-surface outline-none focus:border-primary/40"
              />
              <span className="text-[10px] text-outline font-bold">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-surface-container-highest/60 border border-outline/20 text-on-surface outline-none focus:border-primary/40"
              />
            </div>
          )}
        </div>
      </div>
      <div className="h-80 px-4 pb-6">
        {!hasData && range === 'CUSTOM' ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-outline font-semibold">
              No data available for selected date range. Try adjusting your dates.
            </p>
          </div>
        ) : !hasData ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-outline font-semibold">Loading chart...</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="perfArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4edea3" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#4edea3" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="perfLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#adc6ff" />
                <stop offset="100%" stopColor="#4edea3" />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#424754"
              strokeOpacity={0.15}
              strokeDasharray="3 6"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              ticks={xAxisConfig.ticks}
              interval={xAxisConfig.interval}
              minTickGap={xAxisConfig.minTickGap}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#8c909f', letterSpacing: '0.05em' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={70}
              tickFormatter={(v: number) => formatINR(v, { compact: true })}
            />
            <Tooltip
              cursor={{ stroke: '#adc6ff', strokeOpacity: 0.3, strokeDasharray: '4 4' }}
              contentStyle={{
                background: 'rgba(25, 31, 47, 0.95)',
                border: '1px solid rgba(66, 71, 84, 0.4)',
                borderRadius: 8,
                fontFamily: 'Manrope',
              }}
              labelStyle={{
                color: '#8c909f',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
              itemStyle={{ color: '#dde2f8', fontSize: 12, fontWeight: 700 }}
              formatter={(v: number) => [formatINR(v, { compact: true }), 'Portfolio']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#perfLine)"
              strokeWidth={3}
              fill="url(#perfArea)"
              isAnimationActive
              animationDuration={1200}
              activeDot={{ r: 6, fill: '#adc6ff', stroke: '#0d1322', strokeWidth: 3 }}
            />
            <ReferenceDot
              x={data[minIdx]?.label}
              y={data[minIdx]?.value}
              r={5}
              fill="#ffb2b7"
              stroke="#0d1322"
              strokeWidth={2}
              isFront
            />
            <ReferenceDot
              x={data[maxIdx]?.label}
              y={data[maxIdx]?.value}
              r={5}
              fill="#4edea3"
              stroke="#0d1322"
              strokeWidth={2}
              isFront
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
