'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  FileHeart,
  History,
  Loader2,
  Stethoscope,
} from 'lucide-react';

import { AppointmentStatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { staffAppointmentAction } from '@/lib/actions/appointments';
import type { PatientLookupResult } from '@/lib/data/types';
import { ageAt, formatDate, formatTime } from '@/lib/format';
import { bloodType, gender } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { StartEncounterForm } from './start-encounter-form';

interface Props {
  patient: PatientLookupResult;
  portal: 'commune' | 'province';
  /** Thời điểm hiện tại (ISO) — để tính tuổi, hạn BHYT nhất quán */
  now: string;
}

/** Thẻ tóm tắt bệnh nhân cho bác sĩ / quầy tiếp đón. */
export function PatientSummaryCard({ patient: p, portal, now }: Props) {
  const [encounter, setEncounter] = useState(p.openEncounter);
  const [appointment, setAppointment] = useState(p.todayAppointment);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const insuranceExpired = p.healthInsuranceExpiry && p.healthInsuranceExpiry < now;

  const checkIn = () =>
    startTransition(async () => {
      if (!appointment) return;
      const res = await staffAppointmentAction(appointment.id, 'check-in');
      if (!res.ok) return setError(res.message);
      setAppointment({ ...appointment, status: res.data.status });
      if (res.data.medicalRecord) {
        setEncounter({
          id: res.data.medicalRecord.id,
          code: res.data.medicalRecord.code,
          createdAt: now,
        });
      }
    });

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">{p.fullName}</CardTitle>
          {p.hasAccount && (
            <Badge variant="outline" className="gap-1">
              <BadgeCheck className="text-primary" /> Có tài khoản Mevita
            </Badge>
          )}
        </div>
        <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
          <span>
            {gender[p.gender]}, {ageAt(p.dateOfBirth, now)} tuổi ({formatDate(p.dateOfBirth)})
          </span>
          {p.nationalId && <span>CCCD {p.nationalId}</span>}
          {p.healthInsuranceNumber && <span>BHYT {p.healthInsuranceNumber}</span>}
          {p.phone && <span>SĐT {p.phone}</span>}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {p.allergies ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">Dị ứng:</span> {p.allergies}
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Chưa ghi nhận dị ứng.</p>
        )}

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Nhóm máu</dt>
            <dd className="font-medium">{bloodType[p.bloodType]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bệnh mạn tính</dt>
            <dd className="font-medium">{p.chronicConditions || 'Không'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hạn thẻ BHYT</dt>
            <dd className={cn('font-medium', insuranceExpired && 'text-destructive')}>
              {p.healthInsuranceExpiry ? formatDate(p.healthInsuranceExpiry) : '—'}
              {insuranceExpired && ' (đã hết hạn)'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Địa chỉ</dt>
            <dd>
              {[p.addressDetail, p.commune?.fullName, p.commune?.province.fullName]
                .filter(Boolean)
                .join(', ') || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Liên hệ khẩn cấp</dt>
            <dd>
              {p.emergencyContactName || p.emergencyContactPhone
                ? [p.emergencyContactName, p.emergencyContactPhone].filter(Boolean).join(' · ')
                : '—'}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <History className="size-4" aria-hidden /> Các lần khám trước{' '}
            <span className="text-muted-foreground font-normal">({p.totalVisits}, mọi cơ sở)</span>
          </p>
          {p.recentVisits.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có lần khám nào trên hệ thống.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {p.recentVisits.map((v) => {
                const primary = v.diagnoses.find((d) => d.isPrimary) ?? v.diagnoses[0];
                return (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="font-medium tabular-nums">{formatDate(v.visitAt)}</span>
                    <span className="min-w-0 flex-1">
                      {v.facility.name}
                      {!v.atThisFacility && (
                        <Badge variant="outline" className="ml-2">
                          Cơ sở khác
                        </Badge>
                      )}
                      <span className="text-muted-foreground block text-xs">
                        {v.doctor}
                        {v.specialty && ` · ${v.specialty}`} · {v.chiefComplaint}
                      </span>
                    </span>
                    {primary && (
                      <span className="flex items-center gap-1.5">
                        <Badge className="font-mono">{primary.icdCode}</Badge>
                        <span className="text-xs">{primary.name}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {appointment && (
          <div className="bg-primary/5 flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm">
            <CalendarClock className="text-primary size-4" aria-hidden />
            <span className="flex-1">
              Lịch hẹn hôm nay{' '}
              <span className="font-semibold tabular-nums">{formatTime(appointment.startAt)}</span>
              {appointment.specialty && ` · ${appointment.specialty.name}`} · {appointment.reason}
              <span className="text-muted-foreground ml-2 font-mono text-xs">
                {appointment.code}
              </span>
            </span>
            <AppointmentStatusBadge status={appointment.status} />
            {(appointment.status === 'PENDING' || appointment.status === 'CONFIRMED') && (
              <Button size="sm" onClick={checkIn} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Stethoscope />} Tiếp đón
              </Button>
            )}
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        {encounter ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
            <FileHeart className="size-4 text-emerald-700 dark:text-emerald-300" aria-hidden />
            <span className="flex-1">
              Đang có phiếu khám <span className="font-mono font-semibold">{encounter.code}</span>{' '}
              chưa ký
            </span>
            <Button size="sm" asChild>
              <Link href={`/${portal}/encounters/${encounter.id}`}>Tiếp tục khám</Link>
            </Button>
          </div>
        ) : !appointment || appointment.status === 'CHECKED_IN' ? (
          <StartEncounterForm
            patientId={p.id}
            onStarted={(r) => setEncounter({ ...r, createdAt: now })}
          />
        ) : null}

        <Button variant="outline" size="sm" className="self-start" asChild>
          <Link href={`/${portal}/patients/${p.id}`}>
            <History /> Xem toàn bộ lịch sử khám
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
