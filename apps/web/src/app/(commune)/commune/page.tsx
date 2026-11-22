import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Ambulance, ClipboardList, Stethoscope, UserCheck } from 'lucide-react';

import {
  AppointmentStatusBadge,
  PriorityBadge,
  ReferralStatusBadge,
} from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFacilityAppointments } from '@/lib/data/appointments';
import { formatDate, formatTime, formatWeekday, vnDate } from '@/lib/format';
import { facilities, referrals } from '@/lib/mock-data';

async function Today() {
  // Nội dung phụ thuộc thời điểm request ("hôm nay") — không dựng sẵn lúc build
  await connection();
  const now = new Date().toISOString();
  const today = await getFacilityAppointments(vnDate());
  const queue = today.filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW');
  const outgoing = referrals.filter((r) => r.from.id === facilities.muongKhuong.id);

  return (
    <>
      <p className="text-muted-foreground -mt-4 text-sm">
        {formatWeekday(now)}, {formatDate(now)}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Lịch hẹn hôm nay" value={queue.length} icon={ClipboardList} />
        <StatCard
          label="Đã tiếp đón"
          value={today.filter((a) => a.status === 'CHECKED_IN' || a.status === 'COMPLETED').length}
          icon={UserCheck}
        />
        <StatCard
          label="Ca đang chuyển tuyến"
          value={outgoing.filter((r) => r.status === 'PENDING' || r.status === 'ACCEPTED').length}
          hint="Dữ liệu mẫu — Task 4.2"
          icon={Ambulance}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hàng chờ khám hôm nay</CardTitle>
            <CardAction>
              <Button variant="link" size="sm" asChild>
                <Link href="/commune/appointments">Tiếp đón</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {queue.length === 0 && (
              <p className="text-muted-foreground text-sm">Chưa có lịch hẹn nào hôm nay.</p>
            )}
            {queue.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    <span className="tabular-nums">{formatTime(a.startAt)}</span> ·{' '}
                    {a.patient.fullName}
                  </p>
                  <p className="text-muted-foreground">{a.reason}</p>
                </div>
                <AppointmentStatusBadge status={a.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chuyển tuyến đã gửi</CardTitle>
            <CardAction>
              <Button variant="link" size="sm" asChild>
                <Link href="/commune/referrals">Xem tất cả</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <WireframeNote task="4.2" />
            {outgoing.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{r.patient.fullName}</p>
                  <ReferralStatusBadge status={r.status} />
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={r.priority} />
                  <span>→ {r.to.name}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function CommuneDashboardPage() {
  return (
    <>
      <PageHeader
        title="Tổng quan ca trực"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/commune/encounters/new">
                <Stethoscope /> Khám bệnh mới
              </Link>
            </Button>
            <Button variant="destructive" asChild>
              <Link href="/commune/referrals/new">
                <Ambulance /> Chuyển tuyến khẩn cấp
              </Link>
            </Button>
          </>
        }
      />
      <Suspense
        fallback={<div className="bg-muted/50 h-80 animate-pulse rounded-xl border" aria-busy />}
      >
        <Today />
      </Suspense>
    </>
  );
}
