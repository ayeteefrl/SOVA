'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';

type Props = {
  data: { label: string; value: number }[];
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
};

export function MiniBar({
  data,
  height = 120,
  positiveColor = '#4edea3',
  negativeColor = '#ffb2b7',
}: Props) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <Tooltip
            cursor={{ fill: 'rgba(173,198,255,0.05)' }}
            contentStyle={{
              background: 'rgba(25, 31, 47, 0.95)',
              border: '1px solid rgba(66, 71, 84, 0.4)',
              borderRadius: 8,
              fontFamily: 'Manrope',
              fontSize: 11,
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 2, 2]} isAnimationActive animationDuration={800}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? positiveColor : negativeColor} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
