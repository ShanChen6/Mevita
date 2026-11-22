import { Building2, Clock, MapPin, Stethoscope } from 'lucide-react';

import { AppointmentStatusBadge } from '@/components/shared/status-badge';
import { Card } from '@/components/ui/card';
import type { Appointment } from '@/lib/data/types';
import { formatShortDate, formatTime, formatWeekday } from '@/lib/format';
import { CancelAppointmentDialog } from './cancel-dialog';

export function doctorLabel(d: Appointment['doctor']) {
  if (!d) return null;
  const title = d.staffProfile?.academicTitle;
  return title ? `${title}. ${d.fullName}` : d.fullName;
}

/** Thẻ lịch hẹn của bệnh nhân. `cancellable` = còn tự huỷ được. */
export function AppointmentCard({
  appointment: a,
  cancellable,
}: {
  appointment: Appointment;
  cancellable: boolean;
}) {
  const when = `${formatTime(a.startAt)} · ${formatWeekday(a.startAt)}, ${formatShortDate(a.startAt)}`;
  return (
    <Card className="gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold tabular-nums">
          <Clock className="text-primary size-4" aria-hidden /> {when}
        </p>
        <AppointmentStatusBadge status={a.status} />
      </div>
      <div className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
        <p className="flex items-center gap-1.5">
          <Building2 className="size-3.5 shrink-0" aria-hidden /> {a.facility.name}
        </p>
        <p className="flex items-center gap-1.5">
          <Stethoscope className="size-3.5 shrink-0" aria-hidden />
          {a.specialty?.name}
          {a.doctor && ` · ${doctorLabel(a.doctor)}`}
        </p>
        <p className="flex items-center gap-1.5 sm:col-span-2">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {[
            a.facility.addressDetail,
            a.facility.commune.fullName,
            a.facility.commune.province.fullName,
          ]
            .filter(Boolean)
            .join(', ')}
        </p>
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">Lý do khám: </span>
        {a.reason}
      </p>
      {a.status === 'CANCELLED' && a.cancellationReason && (
        <p className="text-muted-foreground text-sm">
          {a.cancelledByPatient ? 'Bạn đã huỷ' : 'Cơ sở y tế đã huỷ'}: {a.cancellationReason}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Mã lịch hẹn <span className="text-foreground font-mono font-semibold">{a.code}</span>
        </p>
        {cancellable && (
          <CancelAppointmentDialog
            appointmentId={a.id}
            summary={`${when} tại ${a.facility.name}`}
          />
        )}
      </div>
    </Card>
  );
}
