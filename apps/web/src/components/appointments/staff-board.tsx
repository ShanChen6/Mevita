'use client';

import { AlertTriangle, FileText } from 'lucide-react';

import { AppointmentStatusBadge } from '@/components/shared/status-badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StaffAppointment } from '@/lib/data/types';
import { ageAt, formatTime } from '@/lib/format';
import { gender } from '@/lib/labels';
import { doctorLabel } from './appointment-card';
import { QuickSearch } from './quick-search';
import { StaffAppointmentActions } from './staff-actions';

const matches = (a: StaffAppointment, q: string) =>
  !q ||
  [
    a.code,
    a.patient.fullName,
    a.patient.nationalId,
    a.patient.healthInsuranceNumber,
    a.patient.phone,
  ]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q));

/** Bảng lịch hẹn trong ngày cho quầy tiếp đón. `now` truyền từ server để tránh lệch khi hydrate. */
export function StaffBoard({
  appointments,
  now,
}: {
  appointments: StaffAppointment[];
  now: string;
}) {
  return (
    <QuickSearch>
      {(q) => {
        const rows = appointments.filter((a) => matches(a, q));
        return (
          <Card className="py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Giờ</TableHead>
                  <TableHead>Bệnh nhân</TableHead>
                  <TableHead>Chuyên khoa / Bác sĩ</TableHead>
                  <TableHead>Lý do khám</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="pr-4 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                      {appointments.length === 0
                        ? 'Không có lịch hẹn nào trong ngày.'
                        : 'Không tìm thấy lịch hẹn phù hợp.'}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((a) => (
                  <TableRow
                    key={a.id}
                    className={
                      a.status === 'CANCELLED' || a.status === 'NO_SHOW' ? 'opacity-60' : undefined
                    }
                  >
                    <TableCell className="pl-4 align-top font-semibold tabular-nums">
                      {formatTime(a.startAt)}
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <p className="font-medium">{a.patient.fullName}</p>
                      <p className="text-muted-foreground text-xs">
                        {gender[a.patient.gender]}, {ageAt(a.patient.dateOfBirth, a.startAt)} tuổi
                        {a.patient.phone && ` · ${a.patient.phone}`}
                      </p>
                      <p className="text-muted-foreground font-mono text-xs">{a.code}</p>
                      {a.patient.allergies && (
                        <p className="text-destructive mt-1 flex items-center gap-1 text-xs font-medium">
                          <AlertTriangle className="size-3" aria-hidden /> Dị ứng:{' '}
                          {a.patient.allergies}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      {a.specialty?.name}
                      {a.doctor && (
                        <span className="text-muted-foreground block text-xs">
                          {doctorLabel(a.doctor)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal align-top">
                      {a.reason}
                      {a.initialSymptoms && (
                        <span className="text-muted-foreground block text-xs">
                          {a.initialSymptoms}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <AppointmentStatusBadge status={a.status} />
                      {a.medicalRecord && (
                        <span className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                          <FileText className="size-3" aria-hidden /> {a.medicalRecord.code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 align-top">
                      <StaffAppointmentActions
                        id={a.id}
                        status={a.status}
                        started={a.startAt <= now}
                        summary={`${formatTime(a.startAt)} · ${a.patient.fullName}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        );
      }}
    </QuickSearch>
  );
}
