'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';

type Props = {
  data: number[];
  color?: string;
  height?: number;
};

export function Sparkline({ data, color = '#adc6ff', height = 28 }: Props) {
  const series = data.map((v, i) => ({ i, v }));
  const id = `spark-${color.replace('#', '')}-${data.length}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive
            animationDuration={900}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
