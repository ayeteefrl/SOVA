'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from 'recharts';
import { useState, useEffect } from 'react';
import { formatINR } from '@/lib/utils';
import { Segmented } from '@/components/ui/Segmented';
import { motion, AnimatePresence } from 'framer-motion';
import { PerformanceChart } from './PerformanceChart';
import { SectorBars } from './SectorBars';
import { useHoldings } from '@/components/HoldingsContext';

// ─── colour palettes ──────────────────────────────────────────────────────────
const equityColors = [
  '#adc6ff', '#4edea3', '#8b9dff', '#ffb2b7',
  '#D4AF37', '#ff9b6e', '#c084fc', '#5eead4',
];
const sectorColors = [
  '#adc6ff', '#4edea3', '#8b9dff', '#ffb2b7',
  '#D4AF37', '#6ffbbe', '#4d8eff', '#ff516a',
];
const allocationColors = ['#adc6ff', '#4edea3', '#8b9dff', '#ffb2b7', '#D4AF37'];

// ─── active shape ─────────────────────────────────────────────────────────────
const activeShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 8} outerRadius={outerRadius + 11}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.35} />
    </g>
  );
};

const chartTypes = ['PIE', 'LINE', 'SECTORS'] as const;
type ChartType = typeof chartTypes[number];

const pieViews = ['EQUITY', 'PORTFOLIO'] as const;
type PieView = typeof pieViews[number];

// ─── component ────────────────────────────────────────────────────────────────
export function AllocationDonut() {
  const { equityHoldings, mutualFundHoldings, etfHoldings } = useHoldings();
  const [chartType, setChartType] = useState<ChartType>('PIE');
  const [pieView, setPieView] = useState<PieView>('EQUITY');
  const [active, setActive] = useState(0);

  useEffect(() => { setActive(0); }, [pieView]);

  // ─── derive allocation from live holdings ────────────────────────────────────
  const equityTotal = equityHoldings.reduce((s, h) => s + h.value, 0);
  const mfTotal = mutualFundHoldings.reduce((s, h) => s + h.value, 0);
  const etfTotal = etfHoldings.reduce((s, h) => s + h.value, 0);
  const portfolioTotal = equityTotal + mfTotal + etfTotal;

  const allocation = [
    { name: 'Equity', value: equityTotal, color: allocationColors[0] },
    { name: 'Mutual Funds', value: mfTotal, color: allocationColors[1] },
    { name: 'ETF', value: etfTotal, color: allocationColors[2] },
  ].filter((a) => a.value > 0);

  const equityData = equityHoldings.map((h, i) => ({
    name: h.ticker ?? h.name,
    fullName: h.name,
    value: h.value,
    color: equityColors[i % equityColors.length],
    tickers: [h.ticker ?? h.name],
    sector: h.sector,
  }));

  // group equity holdings by sector
  const sectorMap: Record<string, { value: number; tickers: string[] }> = {};
  equityHoldings.forEach((h) => {
    const s = h.sector ?? 'Other';
    if (!sectorMap[s]) sectorMap[s] = { value: 0, tickers: [] };
    sectorMap[s].value += h.value;
    if (h.ticker) sectorMap[s].tickers.push(h.ticker);
  });
  const sectorTotal = equityTotal;
  const sectorData = Object.entries(sectorMap).map(([sector, { value, tickers }], i) => ({
    name: sector,
    fullName: sector,
    value: sectorTotal > 0 ? (value / sectorTotal) * 100 : 0,
    color: sectorColors[i % sectorColors.length],
    tickers,
  }));

  // pick dataset for pie
  const pieData = pieView === 'EQUITY' ? equityData
    : allocation.map((a, i) => ({
        ...a, tickers: [] as string[], fullName: a.name, color: allocationColors[i % allocationColors.length],
      }));
  const pieTotal = pieView === 'EQUITY' ? equityTotal : portfolioTotal;

  if (!pieData.length) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-sm font-extrabold uppercase tracking-widest text-on-surface">Asset Allocation</h4>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[11px] text-outline italic">Connect Zerodha to see allocation data.</p>
        </div>
      </div>
    );
  }

  const current = pieData[Math.min(active, pieData.length - 1)];
  const pct = pieTotal > 0 ? ((current.value / pieTotal) * 100).toFixed(1) : '0.0';

  return (
    <div className="h-full flex flex-col">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h4 className="text-sm font-extrabold uppercase tracking-widest text-on-surface">
            Asset Allocation
          </h4>
          <p className="text-[9px] text-outline font-bold uppercase tracking-widest mt-0.5">
            {chartType === 'PIE'
              ? pieView === 'EQUITY' ? 'Equity sleeve · individual holdings' : 'Full portfolio · asset classes'
              : chartType === 'LINE' ? 'Portfolio growth over time'
              : 'Sector exposure breakdown'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {chartType === 'PIE' && (
            <Segmented options={pieViews} value={pieView} onChange={setPieView} />
          )}
          <Segmented options={chartTypes} value={chartType} onChange={setChartType} />
        </div>
      </div>

      {/* Chart area */}
      <AnimatePresence mode="wait">
        {chartType === 'PIE' && (
          <motion.div
            key="pie"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col md:flex-row items-center gap-8"
            onMouseLeave={() => setActive(0)}
          >
            {/* Donut */}
            <div className="relative w-52 h-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={88}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    activeIndex={active}
                    activeShape={activeShape}
                    onMouseEnter={(_, i) => setActive(i)}
                    animationDuration={900}
                  >
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Centre label */}
              <motion.div
                key={`${pieView}-${active}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-3"
              >
                <span className="text-[9px] text-outline font-bold uppercase tracking-widest text-center" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
                  {current.name}
                </span>
                <span className="text-2xl font-black" style={{ color: current.color, textShadow: `0 0 20px ${current.color}60, 0 1px 6px rgba(0,0,0,0.9)` }}>
                  {pct}%
                </span>
                <span className="text-[9px] text-outline font-semibold mt-0.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  {formatINR(current.value, { compact: true })}
                </span>
              </motion.div>
            </div>

            {/* Legend */}
            <div className="flex-1 w-full space-y-1.5 overflow-y-auto max-h-56">
              {pieData.map((d, i) => {
                const isActive = i === active;
                const p = ((d.value / pieTotal) * 100).toFixed(1);
                const tickers = (d as any).tickers as string[];
                return (
                  <button
                    key={d.name}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => setActive(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${
                      isActive
                        ? 'bg-surface-container-highest/40'
                        : 'hover:bg-surface-container-high/20'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 transition-all"
                      style={{
                        backgroundColor: d.color,
                        boxShadow: isActive ? `0 0 10px ${d.color}` : 'none',
                        transform: isActive ? 'scale(1.4)' : 'scale(1)',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface">
                          {d.name}
                        </p>
                        {isActive && tickers.length > 0 && pieView === 'EQUITY' && (
                          <AnimatePresence>
                            <motion.p
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="text-[9px] text-outline/70 font-medium truncate"
                            >
                              {tickers.join(' · ')}
                            </motion.p>
                          </AnimatePresence>
                        )}
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-surface-container-highest overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${p}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: i * 0.06, ease: [0.4, 0, 0.2, 1] }}
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: d.color,
                            boxShadow: isActive ? `0 0 6px ${d.color}60` : 'none',
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-black text-on-surface">{p}%</p>
                      <p className="text-[9px] text-outline font-bold">
                        {formatINR(d.value, { compact: true })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {chartType === 'LINE' && (
          <motion.div
            key="line"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex-1 -mx-8 -mb-6"
          >
            <PerformanceChart />
          </motion.div>
        )}

        {chartType === 'SECTORS' && (
          <motion.div
            key="sectors"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col md:flex-row gap-8"
            onMouseLeave={() => setActive(0)}
          >
            {sectorData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[11px] text-outline italic">No sector data available.</p>
              </div>
            ) : (
              <>
                {/* Sector donut */}
                <div className="relative w-52 h-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorData}
                        cx="50%" cy="50%"
                        innerRadius={52} outerRadius={88}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        activeIndex={active}
                        activeShape={activeShape}
                        onMouseEnter={(_, i) => setActive(i)}
                        animationDuration={900}
                      >
                        {sectorData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <motion.div
                    key={`sector-${active}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-3"
                  >
                    {(() => {
                      const s = sectorData[Math.min(active, sectorData.length - 1)];
                      return (
                        <>
                          <span className="text-[9px] text-outline font-bold uppercase tracking-widest text-center" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
                            {s.name}
                          </span>
                          <span className="text-2xl font-black" style={{ color: s.color, textShadow: `0 0 20px ${s.color}60, 0 1px 6px rgba(0,0,0,0.9)` }}>
                            {s.value.toFixed(1)}%
                          </span>
                          {s.tickers.length > 0 && (
                            <span className="text-[8px] text-outline/70 font-semibold mt-1 text-center leading-tight">
                              {s.tickers.join(' · ')}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </motion.div>
                </div>

                {/* Sector legend */}
                <div className="flex-1 w-full space-y-1.5 overflow-y-auto max-h-56">
                  {sectorData.map((s, i) => {
                    const isActive = i === active;
                    return (
                      <button
                        key={s.name}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => setActive(i)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                          isActive ? 'bg-surface-container-highest/40' : 'hover:bg-surface-container-high/20'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0 transition-all"
                          style={{
                            backgroundColor: s.color,
                            boxShadow: isActive ? `0 0 10px ${s.color}` : 'none',
                            transform: isActive ? 'scale(1.4)' : 'scale(1)',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface">
                              {s.name}
                            </p>
                            {s.tickers.map((t) => (
                              <span
                                key={t}
                                className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded transition-all"
                                style={{
                                  background: isActive ? `${s.color}25` : `${s.color}10`,
                                  color: isActive ? s.color : `${s.color}80`,
                                  boxShadow: isActive ? `0 0 6px ${s.color}40` : 'none',
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                          <div className="mt-1.5 h-1 rounded-full bg-surface-container-highest overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: `${s.value}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, delay: i * 0.07, ease: [0.4, 0, 0.2, 1] }}
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: s.color,
                                boxShadow: isActive ? `0 0 6px ${s.color}60` : 'none',
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-black text-on-surface">{s.value.toFixed(1)}%</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
