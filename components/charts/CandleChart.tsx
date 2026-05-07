'use client';

import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DataPoint = { label: string; value: number };

type Props = {
  data: DataPoint[];
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
};

function compactINR(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function CandleChart({
  data,
  height = 220,
  positiveColor = '#4edea3',
  negativeColor = '#ffb2b7',
}: Props) {
  const hasData = data.some((d) => d.value !== 0);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
          barCategoryGap="30%"
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#6b7280', fontWeight: 700, fontFamily: 'Manrope' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            hide={!hasData}
            tick={{ fontSize: 9, fill: '#6b7280', fontWeight: 600, fontFamily: 'Manrope' }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={compactINR}
          />
          <ReferenceLine
            y={0}
            stroke="rgba(173,198,255,0.15)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <Tooltip
            cursor={{ fill: 'rgba(173,198,255,0.05)' }}
            contentStyle={{
              background: 'rgba(15,21,38,0.97)',
              border: '1px solid rgba(66,71,84,0.5)',
              borderRadius: 8,
              fontFamily: 'Manrope',
              fontSize: 11,
              padding: '8px 12px',
              color: '#ffffff',
            }}
            labelStyle={{ color: '#ffffff', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            formatter={(v: number) => [
              <span key="v" style={{ color: v >= 0 ? positiveColor : negativeColor, fontWeight: 800 }}>
                {compactINR(v)}
              </span>,
              <span key="n" style={{ color: '#D4AF37', fontWeight: 700 }}>P&amp;L</span>,
            ]}
          />
          <Bar dataKey="value" radius={[3, 3, 1, 1]} isAnimationActive animationDuration={900}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.value >= 0 ? positiveColor : negativeColor}
                fillOpacity={d.value === 0 ? 0.2 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
