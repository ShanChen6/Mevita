import Link from 'next/link';
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
import { formatTime } from '@/lib/format';
import { appointments, facilities, referrals } from '@/lib/mock-data';

export default function CommuneDashboardPage() {
  const today = appointments.filter(
    (a) => a.facility.id === facilities.muongKhuong.id && a.startAt.startsWith('2026-12-01'),
  );
  const outgoing = referrals.filter((r) => r.from.id === facilities.muongKhuong.id);

  return (
    <>
      <PageHeader
        title="Tổng quan ca trực"
        description={`${facilities.muongKhuong.name} · Thứ Ba, 01/12/2026`}
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
      <WireframeNote task="2.3, 3.1, 4.2" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Lịch hẹn hôm nay" value={today.length} icon={ClipboardList} />
        <StatCard
          label="Đã tiếp đón"
          value={today.filter((a) => a.status === 'CHECKED_IN').length}
          icon={UserCheck}
        />
        <StatCard
          label="Ca đang chuyển tuyến"
          value={outgoing.filter((r) => r.status === 'PENDING' || r.status === 'ACCEPTED').length}
          icon={Ambulance}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hàng chờ khám</CardTitle>
            <CardAction>
              <Button variant="link" size="sm" asChild>
                <Link href="/commune/appointments">Xem tất cả</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {today.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    <span className="tabular-nums">{formatTime(a.startAt)}</span> · {a.patientName}
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
