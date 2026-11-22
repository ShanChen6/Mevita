import type { Metadata } from 'next';
import { Check, Stethoscope, X } from 'lucide-react';

import { AppointmentStatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

export const metadata: Metadata = { title: 'Tiếp đón & Lịch hẹn' };

export default function ReceptionPage() {
  const rows = appointments.filter((a) => a.facility.id === facilities.muongKhuong.id);
  return (
    <>
      <PageHeader
        title="Tiếp đón & Lịch hẹn"
        description="Duyệt, huỷ lịch hoặc chuyển lịch hẹn thành phiếu khám."
        actions={
          <Input type="search" placeholder="Tìm theo mã lịch hẹn, tên, CCCD…" className="sm:w-72" />
        }
      />
      <WireframeNote task="2.3" />
      <Card className="py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Giờ hẹn</TableHead>
              <TableHead>Bệnh nhân</TableHead>
              <TableHead>Chuyên khoa</TableHead>
              <TableHead>Lý do khám</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="pr-4 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="pl-4">
                  <span className="font-medium tabular-nums">{formatTime(a.startAt)}</span>
                  <span className="text-muted-foreground block text-xs">
                    {formatDate(a.startAt)}
                  </span>
                </TableCell>
                <TableCell>
                  {a.patientName}
                  <span className="text-muted-foreground block font-mono text-xs">{a.code}</span>
                </TableCell>
                <TableCell>{a.specialty}</TableCell>
                <TableCell className="max-w-56 truncate">{a.reason}</TableCell>
                <TableCell>
                  <AppointmentStatusBadge status={a.status} />
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    {a.status === 'PENDING' && (
                      <Button size="sm" variant="outline">
                        <Check /> Duyệt
                      </Button>
                    )}
                    {a.status === 'CONFIRMED' && (
                      <Button size="sm">
                        <Stethoscope /> Tạo phiếu khám
                      </Button>
                    )}
                    {(a.status === 'PENDING' || a.status === 'CONFIRMED') && (
                      <Button size="icon" variant="ghost" aria-label="Huỷ lịch">
                        <X />
                      </Button>
                    )}
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
