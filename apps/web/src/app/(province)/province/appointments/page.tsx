import type { Metadata } from 'next';
import { Check, Stethoscope } from 'lucide-react';

import { AppointmentStatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatTime } from '@/lib/format';
import { appointments, facilities } from '@/lib/mock-data';

export const metadata: Metadata = { title: 'Lịch hẹn khám' };

export default function ProvinceAppointmentsPage() {
  const rows = appointments.filter((a) => a.facility.id === facilities.laoCaiGeneral.id);
  return (
    <>
      <PageHeader
        title="Lịch hẹn khám"
        description="Bệnh nhân đặt lịch khám chuyên khoa tại bệnh viện."
      />
      <WireframeNote task="2.3" />
      <Card className="py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Giờ hẹn</TableHead>
              <TableHead>Bệnh nhân</TableHead>
              <TableHead>Chuyên khoa / Bác sĩ</TableHead>
              <TableHead>Lý do</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="pr-4 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="pl-4 tabular-nums">
                  {formatTime(a.startAt)} · {formatDate(a.startAt)}
                </TableCell>
                <TableCell className="font-medium">{a.patientName}</TableCell>
                <TableCell>
                  {a.specialty}
                  {a.doctorName && (
                    <span className="text-muted-foreground block text-xs">{a.doctorName}</span>
                  )}
                </TableCell>
                <TableCell>{a.reason}</TableCell>
                <TableCell>
                  <AppointmentStatusBadge status={a.status} />
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline">
                      <Check /> Tiếp đón
                    </Button>
                    <Button size="sm">
                      <Stethoscope /> Khám
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
