'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HoldingsTable } from '@/components/HoldingsTable';
import { ExposureCard } from '@/components/ExposureCard';

import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { useHoldings } from '@/components/HoldingsContext';
import { Holding, equityHoldings as defaultEquityHoldings } from '@/lib/data';
import { formatINR } from '@/lib/utils';

type ChartType = 'pie' | 'bar' | 'line';

const COLORS = [
  '#adc6ff', '#4edea3', '#8b9dff', '#ffb2b7', '#D4AF37', '#ff9b6e', '#c084fc', '#5eead4',
  '#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c', '#38bdf8', '#4ade80',
  '#e879f9', '#facc15', '#818cf8', '#f87171',
];

const activeShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 7}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 9} outerRadius={outerRadius + 12}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.35} />
    </g>
  );
};

export default function EquityPage() {
  const { equityHoldings, addHolding, removeHolding, updateHolding } = useHoldings();

  const [chartType, setChartType] = useState<ChartType>('pie');
  const [activeIdx, setActiveIdx] = useState<number | undefined>(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editHolding, setEditHolding] = useState<Holding | null>(null);

  const total = equityHoldings.reduce((a, b) => a + b.value, 0);
  const totalInvested = equityHoldings.reduce((a, b) => a + b.units * b.avgCost, 0);
  const dayChange = equityHoldings.reduce((a, b) => a + (b.value * b.daily) / 100, 0);
  const totalGain = total - totalInvested;
  const dayPct = (dayChange / total) * 100;
  const topGainer = equityHoldings.length > 0 ? [...equityHoldings].sort((a, b) => b.daily - a.daily)[0] : null;

  const topHolders = [...equityHoldings].sort((a, b) => b.value - a.value).slice(0, 6);
  const pieData = topHolders.map((h, i) => ({
    name: h.ticker || h.name,
    fullName: h.name,
    value: h.value,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 pb-16 overflow-x-hidden flex-1 min-w-0">

        {/* KPI row — 2 cols on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          <KPICard
            label="Invested"
            value={totalInvested}
            format="inr"
            icon="savings"
            sub={`${equityHoldings.length} positions`}
          />
          <KPICard label="Current Value" value={total} format="inr" icon="trending_up"
            sub={totalInvested > 0 ? `${((total / totalInvested - 1) * 100).toFixed(1)}% return` : undefined}
          />
          <KPICard
            label="Day P&L"
            value={dayChange}
            format="inr"
            accent={dayChange >= 0 ? 'positive' : 'negative'}
            delta={dayPct}
            icon="analytics"
          />
          <KPICard
            label="Unrealised Gain"
            value={totalGain}
            format="inr"
            accent={totalGain >= 0 ? 'positive' : 'negative'}
            sub="Book to market"
            icon="paid"
          />
        </div>

        {/* Exposure + Allocation row — stretched to equal height */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

          {/* Exposure card */}
          <Card tier="low" className="p-6 md:p-8">
            <ExposureCard />
          </Card>

          {/* Allocation of Holdings */}
          <Card tier="low" className="p-6 md:p-8 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-on-surface">
                  Allocation of Holdings
                </h3>
                <p className="text-[9px] text-outline font-bold uppercase tracking-widest mt-0.5">
                  Top 6 positions · equity sleeve
                </p>
              </div>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                className="text-[10px] font-bold uppercase tracking-widest bg-surface-container-highest/40 border border-outline/20 rounded px-3 py-1.5 text-on-surface hover:border-primary/40 transition-colors cursor-pointer"
              >
                <option value="pie">Pie Chart</option>
                <option value="bar">Bar Chart</option>
                <option value="line">Performance Line</option>
              </select>
            </div>

            {/* ── DONUT CHART — same style as home Asset Allocation ── */}
            {chartType === 'pie' && (
              <div className="flex-1 flex flex-col md:flex-row items-center gap-6 min-h-0">
                {/* Donut */}
                <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%" cy="50%"
                        innerRadius={52} outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        activeIndex={activeIdx}
                        activeShape={activeShape}
                        onMouseEnter={(_, i) => setActiveIdx(i)}
                        animationDuration={900}
                      >
                        {pieData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centre label */}
                  <DonutCenterLabel pieData={pieData} activeIdx={activeIdx} total={total} />
                </div>

                {/* Legend with mini progress bars */}
                <div className="flex-1 w-full space-y-1 overflow-y-auto">
                  {pieData.map((d, i) => {
                    const isActive = i === activeIdx;
                    const pct = ((d.value / total) * 100).toFixed(1);
                    return (
                      <button
                        key={d.name}
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => setActiveIdx(i)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                          isActive ? 'bg-surface-container-highest/40' : 'hover:bg-surface-container-high/20'
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
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface">{d.name}</p>
                            {d.fullName !== d.name && (
                              <p className="text-[9px] text-outline/60 truncate hidden sm:block">{d.fullName}</p>
                            )}
                          </div>
                          <div className="mt-1 h-1 rounded-full bg-surface-container-highest overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: `${pct}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.9, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] }}
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: d.color,
                                boxShadow: isActive ? `0 0 6px ${d.color}60` : 'none',
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-black" style={{ color: d.color }}>{pct}%</p>
                          <p className="text-[9px] text-outline font-bold">{formatINR(d.value, { compact: true })}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── BAR CHART ── */}
            {chartType === 'bar' && (
              <div className="flex-1 flex flex-col justify-center gap-2.5">
                {pieData.map((d, i) => {
                  const pct = (d.value / total) * 100;
                  return (
                    <div
                      key={d.name}
                      className="flex items-center gap-2"
                      onMouseEnter={() => setActiveIdx(i)}
                      onMouseLeave={() => setActiveIdx(undefined)}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-widest text-outline w-14 shrink-0 text-right">
                        {d.name}
                      </span>
                      <div className="flex-1 h-4 rounded bg-surface-container-highest/40 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}
                          className="h-full rounded"
                          style={{
                            backgroundColor: d.color,
                            opacity: activeIdx === null || activeIdx === i ? 1 : 0.35,
                          }}
                        />
                      </div>
                      <span className="text-[9px] font-black w-9 shrink-0" style={{ color: d.color }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── PERFORMANCE LINE — full PerformanceChart ── */}
            {chartType === 'line' && (
              <div className="flex-1 -mx-6 md:-mx-8 -mb-6 md:-mb-8 overflow-hidden rounded-b-xl min-h-[420px]">
                <PerformanceChart />
              </div>
            )}
          </Card>
        </div>

        {/* Holdings table */}
        <Card tier="low" className="p-4 md:p-8 overflow-x-auto">
          <SectionHeader
            title="Direct Equity Holdings"
            subtitle="Single-stock conviction positions across sectors"
            right={
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest bg-surface-container-highest/50 text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Add Equity
              </button>
            }
            className="mb-6"
          />
          <HoldingsTable
            holdings={equityHoldings}
            showSector
            onDelete={(id) => setDeleteConfirm(id)}
            onEdit={(h) => setEditHolding(h)}
          />
        </Card>

      {/* Modals */}
      <AnimatePresence>
        {showAddForm && (
          <AddEquityModal
            onAdd={(holding) => {
              addHolding(holding, 'equity');
              setShowAddForm(false);
            }}
            onClose={() => setShowAddForm(false)}
          />
        )}
        {deleteConfirm && (
          <DeleteConfirmModal
            holdingName={equityHoldings.find((h) => h.id === deleteConfirm)?.name ?? 'Equity'}
            onConfirm={() => {
              removeHolding(deleteConfirm, 'equity');
              setDeleteConfirm(null);
            }}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
        {editHolding && (
          <EditEquityModal
            holding={editHolding}
            onSave={(updates) => {
              updateHolding(editHolding.id, updates, 'equity');
              setEditHolding(null);
            }}
            onClose={() => setEditHolding(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Donut centre label — extracted to avoid IIFE in JSX
function DonutCenterLabel({ pieData, activeIdx, total }: { pieData: { name: string; fullName: string; value: number; color: string }[]; activeIdx: number | undefined; total: number }) {
  if (!pieData.length) return null;
  const d = pieData[Math.min(activeIdx ?? 0, pieData.length - 1)];
  const pct = ((d.value / total) * 100).toFixed(1);
  return (
    <motion.div
      key={activeIdx}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-3"
    >
      <span className="text-[9px] text-outline font-bold uppercase tracking-widest text-center leading-tight"
        style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
        {d.name}
      </span>
      <span className="text-2xl font-black leading-none mt-0.5"
        style={{ color: d.color, textShadow: `0 0 20px ${d.color}60, 0 1px 6px rgba(0,0,0,0.9)` }}>
        {pct}%
      </span>
      <span className="text-[9px] text-outline font-semibold mt-0.5"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
        {formatINR(d.value, { compact: true })}
      </span>
    </motion.div>
  );
}

const EQUITY_SECTORS = [
  'IT / Technology', 'Banking / Finance', 'Oil & Gas', 'FMCG', 'Pharma / Healthcare',
  'Auto', 'Infra / Construction', 'Metals / Mining', 'Consumer Durables', 'Telecom',
  'Media / Entertainment', 'Real Estate', 'Energy / Power', 'Chemicals', 'Textiles', 'Other',
];

// Add Equity Modal
function AddEquityModal({
  onAdd,
  onClose,
}: {
  onAdd: (holding: Holding) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [units, setUnits] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [sector, setSector] = useState('Other');
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [livePriceLoading, setLivePriceLoading] = useState(false);
  const [livePriceChange, setLivePriceChange] = useState<number | null>(null);

  async function fetchLive(sym: string) {
    if (!sym) return;
    setLivePriceLoading(true);
    setLivePrice(null);
    try {
      const symbol = sym.includes('.') ? sym : `${sym}.NS`;
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (data.stock?.price) {
        setLivePrice(data.stock.price);
        setLivePriceChange(data.stock.changePercent ?? null);
      }
    } catch {}
    setLivePriceLoading(false);
  }

  function handleSubmit() {
    if (!name || !ticker || !units || !avgCost) return;

    const unitsNum = parseFloat(units) || 0;
    const costNum = parseFloat(avgCost) || 0;
    const ltpVal = livePrice ?? costNum;
    const value = unitsNum * ltpVal;
    const totalPct = costNum > 0 ? ((ltpVal - costNum) / costNum) * 100 : 0;

    const newHolding: Holding = {
      id: `${ticker.toUpperCase()}-${Date.now()}`,
      name,
      ticker: ticker.toUpperCase(),
      units: unitsNum,
      avgCost: costNum,
      ltp: ltpVal,
      value,
      daily: livePriceChange ?? 0,
      total: totalPct,
      weight: 0,
      sector,
    };

    onAdd(newHolding);
  }

  const isValid = name && ticker && units && avgCost;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2f3445]/60">
          <h2 className="text-base font-black tracking-tight text-[#dde2f8] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D4AF37]">add_circle</span>
            Add Equity
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Reliance Industries"
              className="w-full rounded-lg px-4 py-2.5 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50"
              style={{ background: '#1a2035', border: '1px solid #2f3445' }}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
              NSE Ticker Symbol
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g., RELIANCE"
                className="flex-1 rounded-lg px-4 py-2.5 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50"
                style={{ background: '#1a2035', border: '1px solid #2f3445' }}
              />
              <button
                type="button"
                onClick={() => fetchLive(ticker)}
                disabled={!ticker || livePriceLoading}
                className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-40 transition-colors"
                style={{ background: '#1e2538', border: '1px solid #2f3445', color: '#adc6ff' }}
                title="Fetch live price from NSE"
              >
                {livePriceLoading
                  ? <span className="material-symbols-outlined text-sm animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span>
                  : <span className="material-symbols-outlined text-sm">bolt</span>}
              </button>
            </div>
            {livePrice != null && (
              <p className="text-[10px] font-bold mt-1.5 flex items-center gap-1.5">
                <span className="text-[#8c909f]">Live LTP:</span>
                <span className="text-[#adc6ff] font-black">₹{livePrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                {livePriceChange != null && (
                  <span className={livePriceChange >= 0 ? 'text-[#4edea3]' : 'text-[#ffb2b7]'}>
                    ({livePriceChange >= 0 ? '+' : ''}{livePriceChange.toFixed(2)}%)
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
                Units
              </label>
              <input
                type="number"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-4 py-2.5 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50"
                style={{ background: '#1a2035', border: '1px solid #2f3445' }}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8c909f]">
                  Avg Cost (₹)
                </label>
                {livePrice != null && (
                  <button
                    type="button"
                    onClick={() => setAvgCost(String(livePrice))}
                    className="text-[9px] font-black text-[#4d8eff] hover:text-[#adc6ff] transition-colors"
                  >
                    Use live ↑
                  </button>
                )}
              </div>
              <input
                type="number"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-4 py-2.5 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50"
                style={{ background: '#1a2035', border: '1px solid #2f3445' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">
              Sector
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full rounded-lg px-4 py-2.5 text-sm text-[#dde2f8] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50 [color-scheme:dark]"
              style={{ background: '#1a2035', border: '1px solid #2f3445' }}
            >
              {EQUITY_SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
              style={{
                background: isValid ? 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)' : '#424754',
                color: isValid ? '#001a42' : '#8c909f',
                boxShadow: isValid ? '0 0 24px rgba(173,198,255,0.2)' : 'none',
              }}
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Equity
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Edit Equity Modal
function EditEquityModal({
  holding,
  onSave,
  onClose,
}: {
  holding: Holding;
  onSave: (updates: Partial<Holding>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(holding.name);
  const [ticker, setTicker] = useState(holding.ticker ?? '');
  const [units, setUnits] = useState(String(holding.units));
  const [avgCost, setAvgCost] = useState(String(holding.avgCost));
  const [sector, setSector] = useState(holding.sector ?? 'Other');

  function handleSave() {
    const unitsNum = parseFloat(units) || 0;
    const costNum = parseFloat(avgCost) || 0;
    onSave({
      name,
      ticker: ticker.toUpperCase() || undefined,
      units: unitsNum,
      avgCost: costNum,
      sector,
      value: unitsNum * holding.ltp,
      total: costNum > 0 ? ((holding.ltp - costNum) / costNum) * 100 : 0,
    });
  }

  const fieldStyle = { background: '#1a2035', border: '1px solid #2f3445' };
  const inputCls = 'w-full rounded-lg px-4 py-2.5 text-sm text-[#dde2f8] placeholder:text-[#424754] focus:outline-none focus:ring-1 focus:ring-[#4d8eff]/50';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2f3445]/60">
          <h2 className="text-base font-black tracking-tight text-[#dde2f8] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#adc6ff]">edit</span>
            Edit Equity
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Live price reminder */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 ring-1 ring-primary/20">
            <span className="material-symbols-outlined text-sm text-primary-fixed-dim shrink-0">info</span>
            <p className="text-[10px] text-on-surface-variant">
              Current price: <span className="font-black text-primary-fixed-dim">₹{holding.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              {' '}· Value will recalculate from updated units × current price.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">Company Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={fieldStyle} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">NSE Ticker Symbol</label>
            <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} className={inputCls} style={fieldStyle} placeholder="e.g. RELIANCE" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">Units</label>
              <input type="number" value={units} onChange={(e) => setUnits(e.target.value)} className={inputCls} style={fieldStyle} />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">Avg Cost (₹)</label>
              <input type="number" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} className={inputCls} style={fieldStyle} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">Sector</label>
            <select value={sector} onChange={(e) => setSector(e.target.value)} className={inputCls + ' [color-scheme:dark]'} style={fieldStyle}>
              {EQUITY_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors" style={{ background: '#1e2538', border: '1px solid #2f3445' }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name || !units || !avgCost}
              className="flex-1 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40 hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.2)' }}
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  holdingName,
  onConfirm,
  onCancel,
}: {
  holdingName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-[#080e1d]/75 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl p-6 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)]"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <p className="text-sm font-black text-[#dde2f8] mb-2">Delete Equity?</p>
        <p className="text-[13px] text-[#8c909f] mb-6">
          Are you sure you want to remove <span className="font-bold text-[#dde2f8]">{holdingName}</span> from your portfolio? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors"
            style={{ background: '#1e2538', border: '1px solid #2f3445' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:scale-[1.01] transition-all"
            style={{ background: '#ffb2b7' }}
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}
