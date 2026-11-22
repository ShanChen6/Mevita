import Link from 'next/link';
import { CalendarCheck, CalendarPlus, FileHeart, ShieldAlert } from 'lucide-react';

import { AppointmentStatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatTime } from '@/lib/format';
import { appointments, medicalRecords, MOCK_NOW, patients } from '@/lib/mock-data';

export default function PatientHomePage() {
  const me = patients[0]!;
  const upcoming = appointments.filter(
    (a) => a.patientId === me.id && a.startAt >= MOCK_NOW.slice(0, 10) && a.status !== 'COMPLETED',
  );
  const lastVisit = medicalRecords[0]!;

  return (
    <>
      <PageHeader
        title={`Xin chào, ${me.fullName}`}
        description="Theo dõi lịch hẹn và hồ sơ sức khoẻ của bạn."
        actions={
          <Button asChild>
            <Link href="/patient/appointments/new">
              <CalendarPlus /> Đặt lịch khám
            </Link>
          </Button>
        }
      />
      <WireframeNote task="2.2, 2.3" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Lịch hẹn sắp tới" value={upcoming.length} icon={CalendarCheck} />
        <StatCard label="Lần khám đã lưu" value={medicalRecords.length} icon={FileHeart} />
        <StatCard
          label="Dị ứng"
          value={me.allergies.length ? me.allergies.join(', ') : 'Không'}
          hint="Bác sĩ sẽ thấy cảnh báo này khi khám"
          icon={ShieldAlert}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lịch hẹn sắp tới</CardTitle>
            <CardDescription>
              Vui lòng đến trước giờ hẹn 15 phút và mang theo CCCD/thẻ BHYT.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {upcoming.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium">
                    {formatTime(a.startAt)} · {formatDate(a.startAt)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {a.facility.name} — {a.specialty}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">Mã: {a.code}</p>
                </div>
                <AppointmentStatusBadge status={a.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lần khám gần nhất</CardTitle>
            <CardDescription>
              {formatDate(lastVisit.visitAt)} · {lastVisit.facility.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Bác sĩ khám: </span>
              {lastVisit.doctorName} ({lastVisit.specialty})
            </p>
            <p>
              <span className="text-muted-foreground">Chẩn đoán: </span>
              {lastVisit.diagnoses.map((d) => `${d.code} — ${d.name}`).join('; ')}
            </p>
            <Button variant="outline" size="sm" className="mt-2 self-start" asChild>
              <Link href="/patient/records">Xem lịch sử khám bệnh</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
