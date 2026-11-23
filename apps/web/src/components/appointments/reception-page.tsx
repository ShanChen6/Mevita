import { connection } from 'next/server';
import { Suspense } from 'react';
import { CalendarCheck, CheckCircle2, Clock, UserCheck } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { getFacilityAppointments } from '@/lib/data/appointments';
import type { AppointmentStatusValue } from '@/lib/data/types';
import { formatWeekday, vnDate, vnNoon } from '@/lib/format';
import { appointmentStatus } from '@/lib/labels';
import { AppointmentFilters } from './date-nav';
import { StaffBoard } from './staff-board';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Board({ searchParams }: { searchParams: SearchParams }) {
  // Phụ thuộc "hôm nay" — luôn render theo request, không dựng sẵn
  await connection();
  const sp = await searchParams;
  const today = vnDate();
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const status =
    typeof sp.status === 'string' && sp.status in appointmentStatus
      ? (sp.status as AppointmentStatusValue)
      : undefined;
  const [all, filtered] = await Promise.all([
    getFacilityAppointments(date),
    status ? getFacilityAppointments(date, status) : null,
  ]);
  const count = (...s: AppointmentStatusValue[]) => all.filter((a) => s.includes(a.status)).length;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tổng lịch hẹn"
          value={all.length}
          hint={`${formatWeekday(vnNoon(date))}, ${date.split('-').reverse().join('/')}`}
          icon={CalendarCheck}
        />
        <StatCard label="Chờ duyệt" value={count('PENDING')} icon={Clock} />
        <StatCard label="Đã xác nhận" value={count('CONFIRMED')} icon={CheckCircle2} />
        <StatCard
          label="Đã tiếp đón / khám"
          value={count('CHECKED_IN', 'COMPLETED')}
          icon={UserCheck}
        />
      </div>
      <div className="flex flex-col gap-3">
        <AppointmentFilters date={date} today={today} />
        <StaffBoard appointments={filtered ?? all} now={new Date().toISOString()} />
      </div>
    </>
  );
}

/** Trang tiếp đón & quản lý lịch hẹn — dùng chung cho Tuyến Xã và Tuyến Tỉnh. */
export function ReceptionPage({
  title,
  searchParams,
}: {
  title: string;
  searchParams: SearchParams;
}) {
  return (
    <>
      <PageHeader
        title={title}
        description="Duyệt, huỷ lịch hoặc tiếp đón và chuyển lịch hẹn thành phiếu khám."
      />
      <Suspense
        fallback={<div className="bg-muted/50 h-96 animate-pulse rounded-xl border" aria-busy />}
      >
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  );
}
