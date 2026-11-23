'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { VitalLog } from '@/lib/data/types';
import { formatTime } from '@/lib/format';

const series = [
  { key: 'pulse', name: 'Mạch (l/p)', color: 'var(--chart-1)' },
  { key: 'systolicBp', name: 'HA tâm thu (mmHg)', color: 'var(--chart-3)' },
  { key: 'spo2', name: 'SpO2 (%)', color: 'var(--chart-2)' },
] as const;

/** Biểu đồ biến thiên sinh tồn trên xe chuyển viện. */
export function VitalsChart({ data }: { data: VitalLog[] }) {
  const rows = data.map((d) => ({ ...d, time: formatTime(d.recordedAt) }));
  return (
    <div className="h-72 w-full" role="img" aria-label="Biểu đồ chỉ số sinh tồn theo thời gian">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis domain={[40, 200]} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
