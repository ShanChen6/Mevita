'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { bucketLabel, bucketTitle } from './bucket';

/** Số phiếu chuyển tuyến theo thời gian — một chuỗi, không cần chú giải (tiêu đề đã gọi tên). */
export function ReferralsTrend({
  rows,
  unit,
}: {
  rows: { bucket: string; n: number }[];
  unit: 'day' | 'week' | 'month';
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="bucket"
            tickFormatter={(b: string) => bucketLabel(b, unit)}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            minTickGap={16}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            allowDecimals={false}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="bg-popover rounded-lg border px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold">{bucketTitle(String(label), unit)}</p>
                  <p className="tabular-nums">
                    {Number(payload[0]?.value).toLocaleString('vi-VN')} phiếu chuyển tuyến
                  </p>
                </div>
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="n"
            name="Phiếu chuyển tuyến"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
