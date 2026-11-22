import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';

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
import { appointments } from '@/lib/mock-data';

export const metadata: Metadata = { title: 'Lịch hẹn của tôi' };

export default function MyAppointmentsPage() {
  const mine = appointments.filter((a) => a.patientId === 'pt-1');
  return (
    <>
      <PageHeader
        title="Lịch hẹn của tôi"
        actions={
          <Button asChild>
            <Link href="/patient/appointments/new">
              <CalendarPlus /> Đặt lịch mới
            </Link>
          </Button>
        }
      />
      <WireframeNote task="2.3">huỷ lịch, nhắc lịch</WireframeNote>
      <Card className="py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Thời gian</TableHead>
              <TableHead>Cơ sở y tế</TableHead>
              <TableHead>Chuyên khoa / Bác sĩ</TableHead>
              <TableHead>Mã lịch hẹn</TableHead>
              <TableHead className="pr-4">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mine.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="pl-4 font-medium">
                  {formatTime(a.startAt)} · {formatDate(a.startAt)}
                </TableCell>
                <TableCell>{a.facility.name}</TableCell>
                <TableCell>
                  {a.specialty}
                  {a.doctorName && <span className="text-muted-foreground"> · {a.doctorName}</span>}
                </TableCell>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell className="pr-4">
                  <AppointmentStatusBadge status={a.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
