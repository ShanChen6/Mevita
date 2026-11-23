'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { APPOINTMENT_GROUPS as GROUPS, type AppointmentRow } from './appointment-groups';
import { bucketLabel, bucketTitle } from './bucket';

function TooltipBox({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  unit: 'day' | 'week' | 'month';
}) {
  if (!active || !payload?.length || !label) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{bucketTitle(label, unit)}</p>
      {[...payload].reverse().map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span className="flex-1">{p.name}</span>
          <span className="font-medium tabular-nums">{p.value.toLocaleString('vi-VN')}</span>
        </p>
      ))}
      <p className="text-muted-foreground mt-1 border-t pt-1 tabular-nums">
        Tổng {total.toLocaleString('vi-VN')}
      </p>
    </div>
  );
}

/** Lượt đặt lịch theo thời gian — cột chồng 3 nhóm trạng thái. */
export function AppointmentsChart({
  rows,
  unit,
}: {
  rows: AppointmentRow[];
  unit: 'day' | 'week' | 'month';
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          barCategoryGap="20%"
        >
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
          <Tooltip cursor={{ fill: 'var(--muted)' }} content={<TooltipBox unit={unit} />} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
          {GROUPS.map((g, i) => (
            <Bar
              key={g.key}
              dataKey={g.key}
              name={g.name}
              stackId="a"
              fill={g.color}
              stroke="var(--card)"
              strokeWidth={1}
              radius={i === GROUPS.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
