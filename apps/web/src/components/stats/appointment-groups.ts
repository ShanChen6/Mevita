import type { StatsOverview } from '@/lib/data/types';

/** Gộp 6 trạng thái lịch hẹn thành 3 nhóm có ý nghĩa vận hành. */
export const APPOINTMENT_GROUPS = [
  { key: 'done', name: 'Đã khám', color: 'var(--series-1)', statuses: ['COMPLETED', 'CHECKED_IN'] },
  {
    key: 'waiting',
    name: 'Chờ khám',
    color: 'var(--series-3)',
    statuses: ['PENDING', 'CONFIRMED'],
  },
  {
    key: 'missed',
    name: 'Huỷ / không đến',
    color: 'var(--series-2)',
    statuses: ['CANCELLED', 'NO_SHOW'],
  },
] as const;

export type AppointmentRow = { bucket: string; done: number; waiting: number; missed: number };

export function toAppointmentRows(trend: StatsOverview['appointmentsTrend']): AppointmentRow[] {
  const map = new Map<string, AppointmentRow>();
  for (const r of trend) {
    const row = map.get(r.bucket) ?? { bucket: r.bucket, done: 0, waiting: 0, missed: 0 };
    const g = APPOINTMENT_GROUPS.find((x) => (x.statuses as readonly string[]).includes(r.status));
    if (g) row[g.key] += r.n;
    map.set(r.bucket, row);
  }
  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}
