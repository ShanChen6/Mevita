import Link from 'next/link';
import { Suspense } from 'react';
import { CalendarCheck, CalendarPlus, FileHeart, ShieldAlert, UserRoundCog } from 'lucide-react';

import { doctorName } from '@/components/patient/record-card';
import { AppointmentStatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getMyAppointments } from '@/lib/data/appointments';
import { getMyProfile, getMyRecords } from '@/lib/data/patient';
import type { PatientProfile } from '@/lib/data/types';
import { formatDate, formatTime } from '@/lib/format';

/** Các trường quan trọng còn thiếu trong hồ sơ — nhắc bệnh nhân bổ sung. */
function missingFields(p: PatientProfile) {
  return [
    !p.nationalId && 'số CCCD',
    !p.healthInsuranceNumber && 'mã thẻ BHYT',
    !p.commune && 'địa chỉ',
    p.bloodType === 'UNKNOWN' && 'nhóm máu',
    !p.emergencyContactPhone && 'người liên hệ khẩn cấp',
  ].filter((x): x is string => Boolean(x));
}

async function Overview() {
  const [profile, records] = await Promise.all([getMyProfile(), getMyRecords(undefined, 1)]);
  const last = records.items[0];
  const missing = missingFields(profile);

  return (
    <>
      <PageHeader
        title={`Xin chào, ${profile.fullName}`}
        description="Theo dõi lịch hẹn và hồ sơ sức khoẻ của bạn."
        actions={
          <Button asChild>
            <Link href="/patient/appointments/new">
              <CalendarPlus /> Đặt lịch khám
            </Link>
          </Button>
        }
      />

      {missing.length > 0 && (
        <Card className="flex-row items-center gap-4 border-amber-300 bg-amber-50 px-5 py-4 dark:bg-amber-500/10">
          <UserRoundCog
            className="size-5 shrink-0 text-amber-700 dark:text-amber-300"
            aria-hidden
          />
          <p className="flex-1 text-sm">
            Hồ sơ còn thiếu <span className="font-medium">{missing.join(', ')}</span>. Bổ sung để
            tiếp đón nhanh hơn.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/patient/profile">Cập nhật</Link>
          </Button>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Lần khám gần nhất"
          value={last ? formatDate(last.visitAt) : 'Chưa có'}
          icon={FileHeart}
        />
        <StatCard
          label="Dị ứng"
          value={profile.allergies || 'Không'}
          hint="Bác sĩ sẽ thấy cảnh báo này khi khám"
          icon={ShieldAlert}
        />
        <StatCard
          label="Bệnh mạn tính"
          value={profile.chronicConditions || 'Không'}
          icon={UserRoundCog}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lần khám gần nhất</CardTitle>
            {last && (
              <CardDescription>
                {formatTime(last.visitAt)} · {formatDate(last.visitAt)} · {last.facility.name}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {last ? (
              <>
                <p>
                  <span className="text-muted-foreground">Bác sĩ khám: </span>
                  {doctorName(last.doctor)}
                  {last.specialty && ` (${last.specialty.name})`}
                </p>
                <p>
                  <span className="text-muted-foreground">Chẩn đoán: </span>
                  {last.diagnoses.map((d) => `${d.icdCode} — ${d.name}`).join('; ')}
                </p>
                {last.treatmentPlan && (
                  <p>
                    <span className="text-muted-foreground">Lời dặn: </span>
                    {last.treatmentPlan}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Chưa có lần khám nào được lưu.</p>
            )}
            <Button variant="outline" size="sm" className="mt-2 self-start" asChild>
              <Link href="/patient/records">Xem lịch sử khám bệnh</Link>
            </Button>
          </CardContent>
        </Card>

        <UpcomingAppointments />
      </div>
    </>
  );
}

/** Lịch hẹn sắp tới (tối đa 3). */
async function UpcomingAppointments() {
  const upcoming = (await getMyAppointments('upcoming')).slice(0, 3);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="size-4" aria-hidden /> Lịch hẹn sắp tới
        </CardTitle>
        <CardDescription>
          Vui lòng đến trước giờ hẹn 15 phút và mang theo CCCD/thẻ BHYT.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {upcoming.length === 0 && (
          <p className="text-muted-foreground text-sm">Chưa có lịch hẹn nào sắp tới.</p>
        )}
        {upcoming.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="flex flex-col gap-0.5">
              <p className="font-medium tabular-nums">
                {formatTime(a.startAt)} · {formatDate(a.startAt)}
              </p>
              <p className="text-muted-foreground text-sm">
                {a.facility.name} — {a.specialty?.name}
              </p>
              <p className="text-muted-foreground font-mono text-xs">Mã: {a.code}</p>
            </div>
            <AppointmentStatusBadge status={a.status} />
          </div>
        ))}
        <Button variant="outline" size="sm" className="self-start" asChild>
          <Link href="/patient/appointments">Xem tất cả lịch hẹn</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Đang tải">
      <div className="bg-muted h-12 w-72 animate-pulse rounded-md" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted/50 h-24 animate-pulse rounded-xl border" />
        ))}
      </div>
      <div className="bg-muted/50 h-64 animate-pulse rounded-xl border" />
    </div>
  );
}

export default function PatientHomePage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}
